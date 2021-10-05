import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import copy from "rollup-plugin-copy";
import clean from "rollup-plugin-clean";
import { string } from "rollup-plugin-string";
import typescript from "@rollup/plugin-typescript";
import fg from "fast-glob";

export default [
  {
    input: "src/endpoint/index.ts",
    output: {
      file: "dist/endpoints/blog/index.js",
      format: "cjs",
      exports: "default",
    },
    plugins: [
      {
        name: "watch-external",
        async buildStart() {
          const files = await fg("src/**/*");
          for (let file of files) {
            this.addWatchFile(file);
          }
        },
      },
      typescript(),
      clean(),
      nodeResolve({
        preferBuiltins: true,
        moduleDirectories: ["node_modules", "fake_modules"],
      }),
      commonjs(),
      json(),
      copy({
        targets: [
          { src: "src/endpoint/views", dest: "dist/endpoints/blog" },
          { src: "src/endpoint/static", dest: "dist/endpoints/blog" },
          { src: "src/endpoint/config.js", dest: "dist/endpoints/blog" },
        ],
        hook: "writeBundle",
      }),
      string({
        include: "**/*.njk",
      }),
    ],
    watch: {
      clearScreen: false,
    },
  },
  {
    input: "src/hook/index.ts",
    output: {
      file: "dist/hooks/blog/index.js",
      format: "cjs",
      exports: "default",
    },
    plugins: [
      ,
      typescript(),
      clean(),
      nodeResolve({
        preferBuiltins: true,
        moduleDirectories: ["node_modules", "fake_modules"],
      }),
      commonjs(),
      json(),
    ],
    watch: {
      clearScreen: false,
    },
  },
];
