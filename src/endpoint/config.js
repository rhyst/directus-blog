const nunjucks = (nunjucks, env, config) => {
  env.addGlobal("customFunction", () => "hello world");
};

module.exports = {
  extensionName: "blog", // Should match folder name /extensions/endpoints/<extensionName> and /extensions/hooks/<extensionName>
  title: "My Site", // Website title for HTML title tag
  baseUrl: "/blog", // Base URL of the blog
  // DB info
  collection: "post", // Directus collection to source blog items from
  index: {
    view: "index.njk", // Nunjucks template for rendering index
    fields: ["date", "name", "summary", "content", "slug", "tags"], // Item fields to select for passing to template
    filter: (req) => ({ published: { _eq: true }, indexed: { _eq: true } }), // Filter items that are passed to template
  },
  rss: {
    view: "rss.njk", // Nunjucks template for rendering rss
    fields: ["date", "name", "summary", "content", "slug"], // Item fields to select for passing to template
    filter: { published: { _eq: true }, indexed: { _eq: true } }, // Filter items that are passed to template
  },
  item: {
    view: "item.njk", // Nunjucks template for rendering single item
    fields: ["date", "name", "content", "slug"], // Item fields to select for passing to template
    slugField: "slug", // Field that the item slug is stored in
    // Filter items that are passed to template
    // <slug> can be null
    filter: (slug) => ({
      ...(slug ? { slug: { _eq: slug } } : {}),
      published: { _eq: true },
    }),
    // Callback before item is rendered
    beforeRender: (item, { ItemsService }) => {
      // Example of pulling content from another collection
      if (item?.link?.length) {
        const contentFields = { collectionName: "someField" };
        const link = item.link[0];
        const linkedService = new ItemsService("post", { schema });
        const contentField = contentFields[link.collection];
        const linked = await linkedService.readOne(link.item, {
          fields: [contentField],
        });
        item.content = linked[contentField];
      }
    },
  },
  404: {
    view: "404.njk",
  },
  // For RSS
  authorName: "",
  authorEmail: "",
  // Output
  minify: true,
  // Add custom nunjucks stuff
  nunjucks,
};
