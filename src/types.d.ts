import type { HookConfig } from "@directus/types";
import type { Options as TocOptions } from "./endpoint/toc";

declare module "*.njk" {
  const content: string;
  export default content;
}

declare global {
  var hooks:  Parameters<HookConfig>['0'] | undefined;
}

export type RouteConfig = {
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
  query?: (
    route: RouteConfig,
    req: Express.Request
  ) => { items: Record<string, unknown>[]; totalPages: number };
  beforeQuery?: (query: Record<string, unknown>, req: Express.Request) => void;
  beforeRender?: (item: Record<string, unknown>, req: Express.Request) => void;
  beforeResponse?: (
    body: string,
    req: Express.Request,
    res: Express.Response
  ) => void;
  [key: string]: unknown;
};

export type Config = {
  extensionName: string;
  baseUrl: string;
  staticUrl?: string;
  staticDir?: string;
  collection?: string;
  nunjucks?: (
    nunjucks: NunjucksModule,
    env: nunjucks.Environment,
    config: Config
  ) => void;
  routes: RouteConfig[];
  notFound: RouteConfig;
  hooks: (hooks: Parameters<HookConfig>["0"]) => void;
  cache: boolean;
  pageParam: string;
  contentSecurityPolicy?: string;
  tocOptions?: TocOptions;
  [key: string]: unknown;
};
