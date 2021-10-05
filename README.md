# Directus Blog Extension

A directus extension to add a simple blog endpoint.

## Usage

### Install

Install the extension by copying `dist/endpoints/blog` to the directus extensions folder `<directus_root>/extensions/endpoints/blog` and copying `dist/hooks/blog` to `<directus_root>/extensions/hooks/blog`

Configure the extension by copying `config.js` to the directus extensions folder `<directus_root>/extensions/endpoints/blog/config.js`. See the config file for information on the different options.

Then you can visit `<directusUrl>/blog` to see your blog.

### Configure

**Data**

By default the extension expects to find a `post` collection with `date`, `name`, `summary`, `content`, `slug`, `indexed`, and `published` as fields. These are all configurable.

You can alter `config.collection` to change which collection is used as a source of blog posts. You can change `config.indexFields` and `config.itemFields` to determine which fields are selected and passed to the views.

You can alter `config.indexFilter` and `config.itemFilter` to change what posts each view is allowed to display.

**Views**

The view is rendered from `nunjucks` templates. With the exception of the `slug` field the other fields are passed straight to the templates as a `post` object, so if the selected fields are updated then the `nunjucks` templates should be updated too.

There are three views built in `views/index.njk`, `views/post.njk` and `views/rss.njk`. The index and rss views will show a list of your blog posts. The post view will show a single blog post based on matching the `slug` parameter from the url.

There is an `md` custom `nunjucks` filter built in that converts markdown to html and additionally allows you to use `nunjucks` syntax within your content.

To add additional custom filters you can use the `config.nunjucks` function which provides access to the `nunjucks` environment.

**Caching**

The endpoint caches all responses. Editing post items triggers the cached items to be rebuilt.

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
