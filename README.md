# Directus Blog Extension

A directus extension to add a blog endpoint. It aims to be simple to configure for most personal blog use cases.

## Usage

### Install

Install the extension by copying `dist/endpoints/blog` to the directus extensions folder `<directus_root>/extensions/endpoints/blog` and copying `dist/hooks/blog` to `<directus_root>/extensions/hooks/blog`

Configure the extension by copying `config.js` to the directus extensions folder `<directus_root>/extensions/endpoints/blog/config.js`. See the config file for information on the different options.

Then you can visit `<directusUrl>/blog` to see your blog.

### Configure

Configuration is done in `config.js`. The options are:

- `extensionName` - The name os the extension. This must match the name of the directory the extension is in. Default: `blog`
- `baseUrl` - The base url of the website. This will be `<directus_url>/blog` unless you have other routing in place. The config example should be changed to a full url. Default `/blog`
- `staticUrl` - The url to serve static assets at. Default `/static`
- `staticDir` - The directory to serve static assets from. Default `__dirname/static`
- `baseUrl` - The base url of the website. This will be `<directus_url>/blog` unless you have other routing in place. The config example should be changed to a full url. Default `/blog`
- `collection` - The directus collection to source items from. Can be overwritten in each route config. Default: `post`.
- `routes` - An array of route configurations which can have the following options:
  - `view` - The nunjucks template
  - `url` - An express js style url path (or array of them) that should route to the view. Any `:params` will be used as filters in the directus query.
  - `limit` - Limit results from directus query. Default `-1` (unlimited)
  - `sort` - Sort config for directus query. Default `[{ column: "date", order: "desc" }]`
  - `fields` - Fields to return from directus query. Default `['*']` (all fields)
  - `filters` - Additional static filters to use in the directus query.
  - `filter` - Complete replace the default filter query.
  - `auth` - Require a valid directus login cookie to view this route.
  - `minify` - Disable html minification by setting this to false. Default: `true`
  - `beforeQuery` - Callback before a directus query is made to modify the query if necessary.
  - `beforeRender` - Callback before nunjucks rendering to modify the item data if necessary.
  - `beforeResponse` - Callback before express response to modify the response if necessary.
  - `*` These and any custom properties will be passed to the template when rendering this route.
- `notFound` - Route configuration for the 404 page with the following options:
  - `view` - The nunjucks template
- `hooks` - A map of directus hook functons.
- `cache` - Disable caching by setting this to false. Default: `true`
- `pageParam` - Set the paramter that is treated as the enumerable page parameter. Default: `page`
- `nunjucks` - Callback to allow modifying the nunjucks environment.
- `*` These and any custom properties will be passed to all route templates.

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

Any parameter of the format `<field>_<operator>` will be split this way and you can use any directus filter operator (though it may not produce sensible results).

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

All standard nunjucks filters and methods are available. In addition is the `md` filter which converts markdown to html (using showdown) and also allows you to use nunjucks within your content (which is acceptable for a personal blog but not for untrusted content).

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
