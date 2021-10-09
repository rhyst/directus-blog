const nunjucks = (nunjucks, env) => {
  env.addGlobal("customFunction", () => "hello world");
};

module.exports = async (router, extensionContext, utils) => {
  const schema = await extensionContext.getSchema();

  const slugify = async (context) => {
    const keys = Array.isArray(context.item) ? context.item : [context.item];
    for (let key of keys) {
      const service = new extensionContext.services.ItemsService(
        context.collection,
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
        console.log(`Updated slug of ${context.collection} ${key} to ${slug}`);
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
    ],
    notFound: {
      view: "404.njk",
    },
    hooks: {
      "items.create": slugify,
      "items.update": slugify,
    },
    // Any other custom values
    // The entire config object is passed to all templates
    title: "My Site", // Website title for HTML title tag
    authorName: "", // For default RSS template
    authorEmail: "", // For default RSS template
  };
};
