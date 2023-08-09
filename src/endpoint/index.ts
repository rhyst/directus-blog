import type { Config, RouteConfig } from "../types.d.ts";
import {
  NextFunction,
  Request,
  Response,
  static as expressStatic,
} from "express";
import { compile, parse } from "path-to-regexp";

import compression from "compression";
import { defineEndpoint } from "@directus/extensions-sdk";
import { dirname } from "path";
import { fileURLToPath } from "url";
import mcache from "memory-cache";
import { minify } from "html-minifier-terser";
import nunjucks from "nunjucks";
import path from "path";
import showdown from "showdown";
import { showdownToc } from "./toc";
import slugify from "slugify";

declare type NunjucksModule = typeof import("nunjucks");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const log = (text: string, object?: any, emoji: string = "📜") => {
  const upperText =
    text?.length > 0 ? `${text[0]!.toUpperCase()}${text.slice(1)}` : "";
  const now = new Date();
  console.log(
    `${("0" + now.getHours()).slice(-2)}:${("0" + now.getMinutes()).slice(
      -2
    )}:${("0" + now.getSeconds()).slice(-2)} ${emoji} ${upperText}`
  );
  if (object) {
    console.log(object);
  }
};

const error = (text: string, object?: any) => log(text, object, "🚨");

export default defineEndpoint(async (router, extensionContext) => {
  const config = (await (
    await import(__dirname + "/config.js")
  ).default(router, extensionContext, {
    slugify,
  })) as unknown as Config;

  log(`Starting ${config.extensionName} extension`, null, "🚀");

  const converter = new showdown.Converter({
    extensions: [showdownToc(config.tocOptions ?? {})],
  });

  const pageParam = config.pageParam || "page";

  const { ItemsService, MetaService, AuthenticationService } =
    extensionContext.services;
  const schema = await extensionContext.getSchema();
  const metaService = new MetaService({
    schema,
    accountability: { admin: true },
  });

  // COMMON

  const getFilters = (route: RouteConfig, params: Record<string, any>) => ({
    ...(route.filters || {}),
    ...Object.entries(params).reduce((filter, [key, value]) => {
      const field = key.split("_")[0]!;
      const match = key.split("_")[1];
      if (field === pageParam) return filter;
      return { ...filter, [field]: { [`_${match || "eq"}`]: value } };
    }, {}),
  });

  const min = (route: RouteConfig, content: string) =>
    route.minify !== false
      ? minify(content, {
          collapseBooleanAttributes: true,
          collapseWhitespace: true,
          minifyCSS: true,
          minifyJS: true,
          removeAttributeQuotes: true,
          removeComments: true,
          removeEmptyAttributes: true,
        })
      : content;

  // RENDERING

  const defaultQuery = async (route: RouteConfig, req: Request) => {
    const collection = route.collection || config.collection;
    const itemService = new ItemsService(collection, { schema });
    const page = req.params[pageParam] || 1;
    const query = {
      limit: route.limit || -1,
      sort: route.sort || ["-date"],
      fields: route.fields ? route.fields : ["*"],
      page,
      filter: route.filter?.(req) || getFilters(route, req.params),
    };
    route.beforeQuery?.(query, req);
    let { filter_count } = await metaService.getMetaForQuery(collection, {
      ...query,
      meta: ["filter_count"],
    });
    const totalPages = Math.ceil(filter_count / (route.limit || -1));
    if (
      req.params[pageParam] &&
      parseInt(req.params[pageParam]!, 10) > totalPages
    ) {
      return { items: [], totalPages };
    }
    const items = await itemService.readByQuery(query);
    return { items, totalPages };
  };

  const render = async (route: RouteConfig, req: Request) => {
    log(`Rendering ${req.url}`);
    try {
      const page = req.params[pageParam] || 1;
      let { items, totalPages } = await (route.query || defaultQuery)(
        route,
        req
      );
      if (!items?.length) return null;
      route?.beforeRender?.(items, req);
      const item = items.length === 1 ? items[0] : null;
      const body = min(
        route,
        nunjucks.render(route.view, {
          item,
          items,
          page,
          totalPages,
          config,
          route,
          req,
        })
      );
      if (config.cache !== false) {
        mcache.put(req.url, body);
      }
      return body;
    } catch (e) {
      error("Error rendering page", e);
      return "";
    }
  };

  // NUNJUCKS

  const env = nunjucks.configure(path.join(__dirname, "views"));
  const safe = env.getFilter("safe");
  // Add default markdown conversion
  env.addFilter("md", (str) =>
    safe(converter.makeHtml(nunjucks.renderString(str || "", { config })))
  );
  // Add date converter for rss feed
  env.addFilter(
    "rssdate",
    (dateString) => new Date(dateString).toISOString().split(".")[0] + "Z"
  );
  config.nunjucks?.(nunjucks, env, config);

  // CACHING

  const getParamCombos = (
    params: { key: string; values: string[] }[]
  ): { [key: string]: string }[] => {
    const f = (
      params: { key: string; values: string[] }[]
    ): { [key: string]: string }[] => {
      if (params.length === 1) {
        return params[0]!.values.map((val) => ({ [params[0]!.key]: val }));
      }
      for (let i = 0; i < params.length; i++) {
        const urlPartials = f(params.slice(1));
        return urlPartials.reduce(
          (acc, curr) => [
            ...acc,
            ...params[i].values.map((val) => ({
              ...curr,
              [params[i].key]: val,
            })),
          ],
          []
        );
      }
      return [{}];
    };
    return f(params);
  };

  const renderRoute = async (route: RouteConfig, keys?: string[]) => {
    try {
      const collection = route.collection || config.collection;
      const query = {
        limit: -1,
        fields: ["*"],
        filter: route.filters || {},
      };
      const itemService = new ItemsService(collection, { schema });
      const items = await (keys
        ? itemService.readMany(keys, query)
        : itemService.readByQuery(query));
      const urls = Array.isArray(route.url) ? route.url : [route.url];
      urls.forEach((urlPattern: string) => {
        log(`Prerendering pages for ${urlPattern}`);
        const params = parse(urlPattern).filter(
          (p) => typeof p !== "string"
        ) as {
          name: string;
        }[];
        const values = params.map((p) => {
          if (p.name === pageParam)
            return { key: pageParam, values: ["__page__"] };
          return {
            key: p.name,
            values: Array.from(
              new Set(items.map((i) => i[p.name.replace(/_.*/, "")]).flat())
            ) as string[],
          };
        });
        const toString = compile(urlPattern);
        getParamCombos(values).forEach(async (params) => {
          try {
            if (params[pageParam]) {
              let { filter_count } = await metaService.getMetaForQuery(
                collection,
                {
                  limit: route.limit || -1,
                  filter: getFilters(route, params),
                  meta: ["filter_count"],
                }
              );
              const totalPages = Math.ceil(filter_count / (route.limit || -1));
              for (let page = 1; page <= totalPages; page++) {
                const paramsWithPage = { ...params, [pageParam]: page };
                const url = toString(paramsWithPage);
                render(route, { url, params: paramsWithPage });
              }
              params[pageParam] = "";
            }
            const url = toString(params);
            render(route, { url, params });
          } catch (e) {
            error("Error caching item", e);
            error("Params", params);
          }
        });
      });
    } catch (e) {
      error("Error during cache", e);
    }
  };

  if (config.cache !== false) {
    log("Warming caches");
    config.routes.forEach((route) => renderRoute(route));
  }

  // HOOKS
  const invalidateCache = async (meta) => {
    const keys = meta.keys || [meta.key];
    config.routes.forEach((route) => {
      const collection = route.collection || config.collection;
      if (collection === meta.collection) {
        renderRoute(route, keys);
      }
    });
  };

  /**
   * Uses provided hooks extension to integrate hooks into this extension
   */
  if (global.hooks) {
    config.hooks(global.hooks);

    global.hooks.action("items.create", async (meta) => {
      log("Item create hook received");
      if (config.cache !== false) {
        await invalidateCache(meta);
      }
    });
    global.hooks.action("items.update", async (meta) => {
      log("Item update hook received");
      if (config.cache !== false) {
        await invalidateCache(meta);
      }
    });
  }

  // AUTH
  const auth =
    (route: RouteConfig) =>
    async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<Response | void> => {
      if (route.auth) {
        // First check we are authed on directus
        if (!req.cookies.directus_refresh_token) {
          const authService = new AuthenticationService({ schema });
          try {
            const auth = await authService.refresh(
              req.cookies.directus_refresh_token
            );
            res.cookie("directus_refresh_token", auth.refreshToken, {
              maxAge: auth.expires,
              httpOnly: true,
            });
            next();
          } catch (e) {
            return res.send(403);
          }
        }
      }
      next();
    };

  // ROUTES
  router.use(compression());

  router.use((_, res, next) => {
    res.set("content-security-policy", config.contentSecurityPolicy || "");
    try {
      next();
    } catch (e) {
      error("An error occured", e);
      res.send("Error");
    }
  });

  config.routes.forEach((route) => {
    router.get(route.url, auth(route), async (req, res, next) => {
      const body = (await mcache.get(req.url)) || (await render(route, req));
      route.beforeResponse?.(body, req, res);
      if (!body) return next();
      return res.send(body);
    });
  });

  router.use(
    config.staticUrl || "/static",
    expressStatic(config.staticDir || path.join(__dirname, "static"))
  );

  router.use((req, res) => {
    error(`Page not found ${req.url}`);
    res.status(404).send(
      nunjucks.render(config.notFound.view, {
        config,
      })
    );
  });
});
