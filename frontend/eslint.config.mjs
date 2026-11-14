import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "*.tsbuildinfo",
  ]),
]);

export default eslintConfig;
