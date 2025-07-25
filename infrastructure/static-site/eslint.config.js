import { config as baseConfig } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config} */
export const config = [
  baseConfig,
  {
    ignores: ["__tests__/**", "*.js"],
  },
];
