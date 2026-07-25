# Frontend ESLint configuration
# This extends react-app defaults and adds import/a11y rules.
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    "react-app",
    "react-app/jest",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/recommended",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: "detect" },
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx"],
        moduleDirectory: ["node_modules", "src"],
      },
    },
  },
  rules: {
    // Downgrade to warn so the build isn't blocked while the codebase is being cleaned up
    "no-unused-vars": "warn",
    "no-console": "off",
    "react/react-in-jsx-scope": "off", // Not needed with React 17+ JSX transform
    "react/prop-types": "off",         // PropTypes not required in this codebase
    "import/no-unresolved": "off",     // Path aliases handled by craco/jsconfig
    "jsx-a11y/no-autofocus": "warn",
  },
};
