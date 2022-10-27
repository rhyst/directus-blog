# Directus Blog Extension

A directus extension to add a blog endpoint. It aims to be simple to configure for most personal blog use cases.

## Usage

### Install

Compatible with Directus 9.x.x.

Install the extension by downloading the release archive and unzipping it into your directus extensions folders:

- Copy `endpoints/blog/index.js` to `<directus_root>/extensions/endpoints/blog/index.js`
- Copy `endpoints/blog/config.js` to `<directus_root>/extensions/endpoints/blog/config.js`
- Copy `hooks/blog/index.js` to `<directus_root>/extensions/hooks/blog/index.js`

Then restart directus.

By default the blog will be available at `<directus_url>/blog` but you may need to configure the extension first.

### Configure

Configuration is done in `config.js`. The options are:

| Option                  | Type                                      | Default              | Description                                                                                                                                                                  |
| ----------------------- | ----------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extensionName`         | `string`                                  | `'blog'`             | The name os the extension. This must match the name of the directory the extension is in.                                                                                    |
| `baseUrl`               | `string`                                  | `'/blog'`            | The base url of the website. This will be `<directus_url>/blog` unless you have other routing in place. The config example should be changed to a full url.                  |
| `staticUrl`             | `string`                                  | `'/static'`          | The url to serve static assets at.                                                                                                                                           |
| `staticDir`             | `string`                                  | `'<dirname>/static'` | The directory to serve static assets from.                                                                                                                                   |
| `collection`            | `string`                                  | `'post'`             | The directus collection to source items from. Can be overwritten in each route config                                                                                        |
| `routes`                | `RouteConfig[]`                           |                      | An array of route configurations. See below for the configuration options.                                                                                                   |
| `notFound`              | `RouteConfig`                             |                      | Route configuration for the 404 page.                                                                                                                                        |
| `hooks`                 | `(hookFunction) => void`                  |                      | A function that is provided with the directus hook registration functions                                                                                                    |
| `cache`                 | `boolean`                                 | `true`               | Disable caching by setting this to false.                                                                                                                                    |
| `pageParam`             | `string`                                  | `'page'`             | Set the paramter that is treated as the numeric page parameter                                                                                                               |
| `contentSecurityPolicy` | `string`                                  | `''`                 | Set the Content-Security-Header policy for the blog. Directus sets a restrictive policy which is unneccesary for a static blog so this by default overwrites it to be blank. |
| `nunjucks`              | `(nunjucks, nunjucksEnv, config) => void` |                      | Callback to allow modifying the nunjucks environment                                                                                                                         |
| `tocOptions`            | `TocOptions`                              |                      | Table of contents configuration options.                                                                                                                                     |
| `*`                     | `*`                                       |                      | The entire config object (including custom properties) is passed to templates                                                                                                |

The `RouteConfig` options are:

| Option           | Type                                           | Default                               | Description                                                                                                                                                                             |
| ---------------- | ---------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view`           | `string`                                       |                                       | The nunjucks template                                                                                                                                                                   |
| `url`            | `string`                                       |                                       | An express js style url path (or array of them) that should route to the view. Any `:params` will be used as filters in the directus query. See filtering section for more information. |
| `limit`          | `number`                                       | `-1`                                  | Limit results from directus query                                                                                                                                                       |
| `sort`           | `{ column: string; order: "desc" \| "asc" }[]` | `[{ column: "date", order: "desc" }]` | Sort config for directus query                                                                                                                                                          |
| `fields`         | `string[]`                                     | `['*']`                               | Fields to return from directus query                                                                                                                                                    |
| `filters`        | `Directus filter object`                       |                                       | Additional static filters to use in the directus query.                                                                                                                                 |
| `filter`         | `req => Directus filter object`                |                                       | Complete replace the default filter query                                                                                                                                               |
| `auth`           | `boolean`                                      | `false`                               | Require a valid directus login cookie to view this route.                                                                                                                               |
| `minify`         | `boolean`                                      | `true`                                | Disable html minification by setting this to false                                                                                                                                      |
| `query`          | `(route, req) => ({items, totalPages})`        |                                       | Callback to completely replace the query made for this route.                                                                                                                           |
| `beforeQuery`    | `(query, req) => void`                         |                                       | Callback before a directus query is made to modify the query if necessary                                                                                                               |
| `beforeRender`   | `(items, req) => void`                         |                                       | Callback before nunjucks rendering to modify the item data if necessary.                                                                                                                |
| `beforeResponse` | `(req, res) => void`                           |                                       | Callback before express response to modify the response if necessary.                                                                                                                   |
| `*`              | `*`                                            |                                       | The route config object (including custom properties) is passed to templates                                                                                                            |


The `TocOptions` options are:

| Option     | Type      | Default | Description                                                            |
| ---------- | --------- | ------- | ---------------------------------------------------------------------- |
| `ordered`  | `boolean` | `false` | Use `ol` tags instead of `ul` tags for the list.                       |
| `tocClass` | `string`  | `toc`   | The class that is applied to the top level table of contents list tag. |
| `maxLevel` | `number`  | `9999`  | Maximum header depth                                                   |


After any configuration change it is necessary to restart directus (there is no way to reload just the extension yet).

### Filtering

The default behaviour of this extension is to use the params in the url as filters when querying the directus items.

For example for a route `/posts/:slug` which matches the url `/posts/my-cool-post` the directus filter will be:

```
{
    slug: { "_eq": "my-cool-post" }
}
```

This will work for any number of parameters. For example for a route `/posts/:category/:title` which matches the url `/posts/my-category/an-article` the directus filter will be:

```
{
    category: { "_eq": "my-category" },
    title: { "_eq": "an-article" },
}
```

You can also specify the operator to use with modified express syntax. If you have items with an array field (i.e. posts with a tags fields) then you can specify to use `_contains` to match any of the items in the list. For example for a route `/tags/:tag_contains` which matches the url `/tags/my-cool-tag` the directus filter will be:

```
{
    tag: { "_contains": "my-cool-post" }

}
```

Any parameter of the format `<field>_<operator>` will be split this way and you can use any directus filter operator (though it may not produce sensible results). Note that the `_contains` operator will not work with JSON fields so you should make tag fields CSV fields. 

### Pagination

The page parameter is the one special that will not be used as a filter. By default it is `page` but this can be changed in the config.

This parameter will be used to specify the page in the directus query. For example if you have a route config like this:

```
{
    view: "index.njk",
    url: "/:page(\\d{0,})",
    limit: 10,
},
```

which matches on the url `/3` then the directus query will look like this:

```
{
    limit: 10,
    page: 3,
}
```

This works with other filters as well. For example if you have a route config like this:

```
{
    view: "index.njk",
    url: "/tags/:tag_contains/:page(\\d{0,})",
    limit: 10,
}
```

which matches on the url `/tags/coding/4` then the directus query will look like this:

```
{
    limit: 10,
    page: 4,
    filter: {
        tag: { '_contains': 'coding' }
    }
}
```

The slightly strange looking format `:page(\\d{0,})` is just express syntax that means page must be numerical digits or empty. This ensures that navigating to string paths will correctly 404.

### Caching

The extension will cache all pages. It caches them on startup, if a page is hit that does not have a cache, and when an item is created or edited.

It does a reverse match to work out what pages can exist i.e. it combines the route configs and the items in the database to work out the possible urls that it should cache.

This has a limitation that if pages depend on items that do not match that page (.e.g your item pages contain a list of all tags on your website) then they may not be rerended when the dependencies changes. In this case for now disabling the cache is the only option.

### Templates

The views are rendered nunjucks templates. The parameters available to each template are:

- `config` - The full config object
- `route` - The route config object for the route that is being rendered
- `items` - The returned value of the directus query
- `item` - A single item if a single item was returned from the directus query
- `page` - The page number that was requested for this page
- `totalPages` - The totalNumber of pages that the query produced

All standard nunjucks filters and methods are available.

In addition is the `md` filter which converts markdown to html (using showdown) and also allows you to use nunjucks within your content (which is acceptable for a personal blog but not for untrusted content).

Also placing the text `[toc]` on its own line will generate a table of contents based on the header tags that follow it. If more than one `[toc]` is placed in the same document then they generate a table of contents up until the next `[toc]` or the end of the document.

You can configure the nunjucks environment using the `config.nunjucks(nunjucksModules, nunjucksEnv, config)` callback.

## Development

Install dependencies:

```
npm install
```

Build the extension endpoint and hook files:

```
npm run build
```

Run a directus db using docker:

```
npm run start
```
