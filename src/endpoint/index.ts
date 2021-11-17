import path from "path";
import { static as expressStatic } from "express";
import nunjucks from "nunjucks";
import mcache from "memory-cache";
import showdown from "showdown";
import { defineEndpoint } from "@directus/extensions-sdk";
import slugify from "slugify";
import { minify } from "html-minifier-terser";
import compression from "compression";
import { parse, compile } from "path-to-regexp";

type RouteConfig = {
  url: string;
  view: string;
  collection?: string;
  limit?: number;
  sort?: { column: string; order: "desc" | "asc" }[];
  fields?: string[];
  filters?: Record<string, unknown>;
  filter?: (req: Express.Request) => Record<string, unknown>;
  minify?: boolean;
  // events
  beforeQuery?: (query: Record<string, unknown>, req: Express.Request) => void;
  beforeRender?: (item: Record<string, unknown>, req: Express.Request) => void;
  beforeResponse?: (
    body: string,
    req: Express.Request,
    res: Express.Response
  ) => void;
  [key: string]: unknown;
};

type Config = {
  extensionName: string;
  baseUrl: string;
  staticUrl?: string;
  staticDir?: string;
  collection?: string;
  nunjucks?: (nunjucks, env, config: Config) => void;
  routes: RouteConfig[];
  notFound: RouteConfig;
  hooks: (hooks: { filter; action; init; schedule }) => void;
  cache: boolean;
  pageParam: string;
  [key: string]: unknown;
};

type Endpoint = ReturnType<typeof defineEndpoint>;

const converter = new showdown.Converter();

const log = (text: string, object?: any, emoji: string = "📜") => {
  const now = new Date();
  console.log(
    `${("0" + now.getHours()).slice(-2)}:${("0" + now.getMinutes()).slice(
      -2
    )}:${("0" + now.getSeconds()).slice(
      -2
    )} ${emoji} ${text[0].toUpperCase()}${text.slice(1)}`
  );
  if (object) {
    console.log(object);
  }
};

const error = (text: string, object?: any) => log(text, object, "🚨");

const endpoint: Endpoint = async (router, extensionContext) => {
  const config = (await require("./config")(router, extensionContext, {
    slugify,
  })) as Config;
  log(`${config.extensionName} extension loading`);
  const pageParam = config.pageParam || "page";

  const { ItemsService, MetaService, AuthenticationService } =
    extensionContext.services;
  const schema = await extensionContext.getSchema();
  const metaService = new MetaService({
    schema,
    accountability: { admin: true },
  });

  // COMMON

  const getFilters = (route, params) => ({
    ...(route.filters || {}),
    ...Object.entries(params).reduce((filter, [key, value]) => {
      const field = key.split("_")[0];
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

  const render = async (route: RouteConfig, req) => {
    log(`Rendering ${req.url}`);
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
    if (req.params[pageParam] && req.params[pageParam] > totalPages) {
      return null;
    }
    let items = await itemService.readByQuery(query);
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
      })
    );
    if (config.cache !== false) {
      mcache.put(req.url, body);
    }
    return body;
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
        return params[0].values.map((val) => ({ [params[0].key]: val }));
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
    setTimeout(() => {
      log("Warming caches");
      config.routes.forEach((route) => renderRoute(route));
    }, 5000);
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

  // AUTH
  const auth = (route) => async (req, res, next) => {
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

  router.use((req, res, next) => {
    try {
      next();
    } catch (e) {
      error(e);
      res.send("Error");
    }
  });

  config.routes.forEach((route) => {
    router.get(route.url, auth(route), async (req, res, next) => {
      const body = mcache.get(req.url) || (await render(route, req));
      route.beforeResponse?.(body, req, res);
      if (!body) return next();
      return res.send(body);
    });
  });

  router.use(
    config.staticUrl || "/static",
    expressStatic(config.staticDir || path.join(__dirname, "static"))
  );

  router.use((req, res, next) => {
    error(`Page not found ${req.url}`);
    res.status(404).send(
      nunjucks.render(config.notFound.view, {
        config,
      })
    );
  });
};

export default endpoint;
