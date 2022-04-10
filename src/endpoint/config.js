const nunjucks = (nunjucks, env) => {
  env.addGlobal("customFunction", () => "hello world");
};

module.exports = async (router, extensionContext, utils) => {
  const schema = await extensionContext.getSchema();

  const slugify = async (meta) => {
    if (meta.collection === "post") {
      const keys = meta.keys || [meta.key];
      for (let key of keys) {
        const service = new extensionContext.services.ItemsService(
          meta.collection,
          {
            schema,
          }
        );
        const item = await service.readOne(key);
        if (item.name && !item.slug) {
          const slug = utils.slugify(`${item.date}-${item.name}`, {
            lower: true,
          });
          await service.updateOne(key, { slug });
          console.log(`Updated slug of ${meta.collection} ${key} to ${slug}`);
        }
      }
    }
  };

  return {
    extensionName: "blog",
    baseUrl: "/blog",
    collection: "post",
    routes: [
      {
        view: "rss.njk",
        url: "/index.xml",
        filters: { published: { _eq: true }, indexed: { _eq: true } },
        beforeResponse: (_, __, res) =>
          res.setHeader("content-type", "application/atom+xml"),
        minify: false,
      },
      {
        view: "index.njk",
        url: "/:page(\\d{0,})",
        limit: 10,
        filters: { published: { _eq: true }, indexed: { _eq: true } },
      },
      {
        view: "index.njk",
        url: ["/tags/:tags_contains", "/tags/:tags_contains/:page(\\d{0,})"],
        limit: 10,
        filters: { published: { _eq: true }, indexed: { _eq: true } },
      },
      {
        view: "item.njk",
        url: "/posts/:slug",
        filters: { published: { _eq: true } },
      },
      {
        view: "index.njk",
        url: ["drafts", "/drafts/:page(\\d{0,})"],
        limit: 10,
        filters: { published: { _eq: false }, indexed: { _eq: true } },
        auth: true,
      },
      {
        view: "item.njk",
        url: "/drafts/posts/:slug",
        filters: { published: { _eq: false } },
        auth: true,
      },
      {
        view: "tags.njk",
        url: ["/tags", "/tags/:page(\\d{0,})"],
        limit: 10,
        query: async (route, req) => {
          const page = req.params.page || 1;
          const db = extensionContext.database;
          const totalRows = await db.raw(
            "select count(*) as count from (SELECT count(*) from post join json_each(post.tags) as tag group by tag.value) as rows"
          );
          const totalPages = Math.ceil(totalRows.pop().count / route.limit);
          // Get paginated as parameterised query so we're not passing the query param "page" directly into sql
          const tags = await db
            .from("post")
            .select(db.raw("count(*) as count, tag.value"))
            .joinRaw("join json_each(post.tags) as tag")
            .groupBy("tag.value")
            .limit(route.limit)
            .offset((page - 1) * route.limit);
          return { items: tags, totalPages };
        },
      },
    ],
    notFound: {
      view: "404.njk",
    },
    hooks: (hooks) => {
      hooks.action("items.create", slugify);
      hooks.action("items.update", slugify);
    },
    // Any other custom values
    // The entire config object is passed to all templates
    title: "My Site", // Website title for HTML title tag
    authorName: "", // For default RSS template
    authorEmail: "", // For default RSS template
    contentSecurityPolicy: "",
  };
};
