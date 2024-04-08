module.exports = {
  env: {
    es2021: true,
  },
  extends: [
    "turbo",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {},
};
