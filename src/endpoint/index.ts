import path from "path";
import { static as expressStatic } from "express";
import nunjucks from "nunjucks";
import mcache from "memory-cache";
import showdown from "showdown";
import { defineEndpoint } from "@directus/extensions-sdk";
import slugify from "slugify";
import { minify } from "html-minifier-terser";
import compression from "compression";

const converter = new showdown.Converter();
const config = require("./config");

const min = (content) =>
  config.minify
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

type Endpoint = ReturnType<typeof defineEndpoint>;

const endpoint: Endpoint = async (router, { services, getSchema }) => {
  log(`${config.extensionName} extension loading`);

  const { ItemsService, MetaService, AuthenticationService } = services;
  const schema = await getSchema();
  const itemService = new ItemsService(config.collection, { schema });

  // RENDERING

  const renderIndex = async (page: number | typeof NaN, tag?: string) => {
    const limit = 10;
    const allItems = await itemService.readByQuery({
      sort: [{ column: "date", order: "desc" }],
      fields: ["id", "tags"],
      filter: {
        ...config.index.filter,
        ...(tag ? { tags: { _contains: tag } } : {}),
      },
    });
    const totalPages = Math.ceil(allItems.length / limit);
    if (isNaN(page) || page > totalPages) {
      return null;
    }
    const tags = [];
    allItems.forEach((i) =>
      i.tags.forEach((tag) => {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      })
    );
    tags.sort();

    log(`Rendering index page ${page}`);
    const query = {
      limit,
      page,
      sort: [{ column: "date", order: "desc" }],
      fields: config.index.fields,
      filter: {
        ...config.index.filter,
        ...(tag ? { tags: { _contains: tag } } : {}),
      },
    };
    const items = await itemService.readByQuery(query);
    const body = min(
      nunjucks.render(config.index.view, {
        items,
        tag,
        tags,
        page,
        total_pages: totalPages,
        config,
      })
    );
    mcache.put(tag ? `index-${tag}-${page}` : `index-${page}`, body);
    return body;
  };

  const renderRss = async () => {
    log(`Rendering rss feed`);
    const query = {
      sort: [{ column: "date", order: "desc" }],
      fields: config.rss.fields,
      filter: config.rss.filter,
    };
    const items = await itemService.readByQuery(query);
    const body = nunjucks.render(config.rss.view, {
      items,
      config,
    });
    mcache.put("rss", body);
    return body;
  };

  const renderItem = async (slug?: string) => {
    log(`Rendering item ${slug}`);
    const query = {
      limit: 1,
      fields: config.item.fields,
      filter: config.item.filter(slug),
    };
    let item = (await itemService.readByQuery(query))?.[0];
    if (!item) {
      return null;
    }
    config?.item?.beforeRender(item, { schema, services });
    const body = min(
      nunjucks.render(config.item.view, {
        item,
        config,
      })
    );
    mcache.put(slug, body);
    return body;
  };

  const renderItems = async () => {
    const query = {
      sort: [{ column: "date", order: "desc" }],
      fields: [config.item.slugField],
      filter: config.item.filter(),
    };
    const items = await itemService.readByQuery(query);
    items.map((item) => renderItem(item[config.item.slugField]));
  };

  const renderIndexes = async () => {
    const limit = 10;
    const allItems = await itemService.readByQuery({
      sort: [{ column: "date", order: "desc" }],
      fields: ["id", "tags"],
      filter: config.index.filter,
    });
    const totalPages = Math.ceil(allItems.length / limit);
    Array(totalPages)
      .fill(0)
      .map((a, i) => renderIndex(i + 1));
  };

  // NUNJUCKS

  // Set up nunjucks env
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
  config.nunjucks(nunjucks, env, config);

  // CACHING

  log("Warming caches");
  renderIndexes();
  renderRss();
  renderItems();

  const invalidateCache = (key?: string) => {
    renderIndexes();
    renderRss();
    if (key) {
      renderItem(key);
    } else {
      renderItems();
    }
  };

  // HOOKS
  const onChange = async function (context) {
    const schema = await getSchema();
    const keys = Array.isArray(context.item) ? context.item : [context.item];
    for (let key of keys) {
      const service = new ItemsService(context.collection, {
        schema,
      });
      const item = await service.readOne(key);
      // Ensure published items have a slug
      const slugField = config.item.slugField;
      let slug = item[slugField];
      if (item.published && item.name && !slug) {
        slug = slugify(`${item.date}-${item.name}`, { lower: true });
        await service.updateOne(key, { [slugField]: slug });
        console.log(
          `Updated slug (${slugField}) of ${context.collection} ${key} to ${slug}`
        );
      }
      // Recreate cached outputs of changed items
      invalidateCache(slug);
    }
  };

  global.hooks = {
    "items.create": onChange,
    "items.update": onChange,
    weekly: () => {
      log("Running weekly job");
      invalidateCache();
    },
  };

  // AUTH

  // Auth on Directus
  // router.use(async (req, res, next) => {
  //   const schema = await getSchema();
  //   // First check we are authed on directus
  //   if (!req.cookies.directus_refresh_token) {
  //     const authService = new AuthenticationService({ schema });
  //     try {
  //       const auth = await authService.refresh(
  //         req.cookies.directus_refresh_token
  //       );
  //       res.cookie("directus_refresh_token", auth.refreshToken, {
  //         maxAge: auth.expires,
  //         httpOnly: true,
  //       });
  //       // @ts-expect-error
  //       req.authed = true;
  //     } catch (e) {
  //       console.log(e);
  //     }
  //   }
  //   next();
  // });

  // ROUTES
  router.use(compression());

  router.use((req, res, next) => {
    try {
      next();
    } catch (e) {
      error(e);
      res.send("woop");
    }
  });

  router.get("/index.xml", async (req, res) => {
    res.setHeader("content-type", "application/atom+xml");
    return res.send(mcache.get("rss") || (await renderRss()));
  });

  router.get("/:page?", async (req, res, next) => {
    const page = Number(req.params.page || 1);
    const body = mcache.get(`index-${page}`) || (await renderIndex(page));
    if (!body) {
      return next();
    }
    return res.send(body);
  });

  router.get("/tags/:tag/:page?", async (req, res, next) => {
    const page = Number(req.params.page || 1);
    const tag = req.params.tag;
    const body =
      mcache.get(`index-${tag}-${page}`) || (await renderIndex(page, tag));
    if (!body) {
      return next();
    }
    return res.send(body);
  });

  router.get("/posts/:slug", async (req, res, next) => {
    const body =
      mcache.get(req.params.slug) || (await renderItem(req.params.slug));
    if (!body) {
      return next();
    }
    return res.send(body);
  });

  router.use("/static", expressStatic(path.join(__dirname, "static")));

  router.use(function (req, res, next) {
    error("Page not found", req.params);
    res.status(404).send(
      nunjucks.render(config["404"].view, {
        config,
      })
    );
  });

  log(`${config.extensionName} extension ready`);
};

export default endpoint;
