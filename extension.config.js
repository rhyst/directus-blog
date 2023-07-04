import copy from "rollup-plugin-copy";
import { string } from "rollup-plugin-string";

export default {
  plugins: [
    copy({
      targets: [
        { src: "src/endpoint/views", dest: "dist/endpoint" },
        { src: "src/endpoint/static", dest: "dist/endpoint" },
        { src: "src/endpoint/config.js", dest: "dist/endpoint" },
      ],
      hook: "writeBundle",
    }),
    string({
      include: "**/*.njk",
    }),
  ],
};
