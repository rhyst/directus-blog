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

// Utility functions

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

const log = (text: string) => {
  const now = new Date();
  console.log(
    `${("0" + now.getHours()).slice(-2)}:${("0" + now.getMinutes()).slice(
      -2
    )}:${("0" + now.getSeconds()).slice(
      -2
    )} 📜 ${text[0].toUpperCase()}${text.slice(1)}`
  );
};

type Endpoint = ReturnType<typeof defineEndpoint>;

const endpoint: Endpoint = async (router, { services, getSchema }) => {
  log(`${config.extensionName} extension loading`);

  const { ItemsService, MetaService, AuthenticationService } = services;
  const schema = await getSchema();
  const itemService = new ItemsService(config.collection, { schema });
  const metaService = new MetaService({
    schema,
    accountability: { admin: true },
  });

  // RENDERING

  const renderIndex = async (page?: number) => {
    const limit = 10;
    const { filter_count } = await metaService.getMetaForQuery(
      config.collection,
      {
        fields: ["id"],
        filter: config.indexFilter,
        meta: ["filter_count"],
      }
    );
    const totalPages = Math.ceil(filter_count / limit);

    const renderPage = async (page) => {
      log(`Rendering index page ${page}`);
      const query = {
        limit,
        page,
        sort: [{ column: "date", order: "desc" }],
        fields: config.indexFields,
        filter: config.indexFilter,
      };
      const items = await itemService.readByQuery(query);
      const body = min(
        nunjucks.render("index.njk", {
          items,
          page,
          total_pages: totalPages,
          config,
        })
      );
      mcache.put(`index-${page}`, body);
      return body;
    };
    if (page) {
      return renderPage(page);
    } else {
      Array(totalPages)
        .fill(0)
        .map((a, i) => renderPage(i + 1));
    }
  };

  const renderRss = async () => {
    log(`Rendering rss feed`);
    const query = {
      sort: [{ column: "date", order: "desc" }],
      fields: config.indexFields,
      filter: config.indexFilter,
    };
    const items = await itemService.readByQuery(query);
    const body = nunjucks.render("rss.njk", {
      items,
      config,
    });
    mcache.put("rss", body);
    return body;
  };

  const renderItem = async (slug?: string) => {
    log(`Rendering item ${slug}`);
    try {
      const query = {
        limit: 1,
        fields: config.itemFields,
        filter: config.itemFilter(slug),
      };
      const item = (await itemService.readByQuery(query))[0];
      config?.beforeRender(item, { schema, services });
      const body = min(
        nunjucks.render("item.njk", {
          item,
          config,
        })
      );
      mcache.put(slug, body);
      return body;
    } catch (e) {
      console.error(e);
      return "woops";
    }
  };

  const renderItems = async () => {
    const query = {
      sort: [{ column: "date", order: "desc" }],
      fields: ["slug"],
      filter: config.itemFilter(),
    };
    const items = await itemService.readByQuery(query);
    items.map((item) => renderItem(item.slug));
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
  renderIndex();
  renderRss();
  renderItems();

  const invalidateCache = (key?: string) => {
    renderIndex();
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
      let slug = item.slug;
      if (item.published && item.name && !item.slug) {
        slug = slugify(`${item.date}-${item.name}`, { lower: true });
        await service.updateOne(key, { slug });
        console.log(`Updated slug of ${context.collection} ${key} to ${slug}`);
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

  router.get("/index.xml", async (req, res) => {
    try {
      res.setHeader("content-type", "application/atom+xml");
      return res.send(mcache.get("rss") || (await renderRss()));
    } catch (e) {
      console.error(e);
      return res.send("woops");
    }
  });

  router.get("/:page?", async (req, res) => {
    try {
      const page = Number(req.params.page) || 1;
      return res.send(mcache.get(`index-${page}`) || (await renderIndex(page)));
    } catch (e) {
      console.error(e);
      return res.send("woops");
    }
  });

  router.get("/posts/:slug", async (req, res) => {
    try {
      return res.send(
        mcache.get(req.params.slug) || (await renderItem(req.params.slug))
      );
    } catch (e) {
      console.error(e);
      return res.send("woops");
    }
  });

  router.use("/static", expressStatic(path.join(__dirname, "static")));

  router.use(function (req, res, next) {
    res.status(404).send("Not found");
  });

  log(`${config.extensionName} extension ready`);
};

export default endpoint;
