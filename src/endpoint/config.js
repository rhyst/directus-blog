const nunjucks = (nunjucks, env, config) => {
  env.addGlobal("customFunction", () => "hello world");
};

module.exports = {
  // Extension info
  extensionName: "blog", // Should match folder name /extensions/endpoints/<extensionName> and /extensions/hooks/<extensionName>
  // Site info
  title: "My Site",
  baseUrl: "/blog",
  // DB info
  collection: "post",
  indexFields: ["date", "name", "summary", "content", "slug"],
  indexFilter: { published: { _eq: true }, indexed: { _eq: true } },
  itemFields: ["date", "name", "content", "slug"],
  itemFilter: (slug) => ({
    slug: { _eq: slug },
    published: { _eq: true },
  }),
  // For RSS
  authorName: "",
  authorEmail: "",
  // Output
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
  minify: true,
  // Add custom nunjucks stuff
  nunjucks,
};
