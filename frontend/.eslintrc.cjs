// Frontend ESLint configuration
// This extends react-app defaults and adds import/a11y rules.
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
    // react-hooks rules are already provided by "react-app" (via eslint-config-react-app),
    // which bundles its own eslint-plugin-react-hooks. Adding it again here caused
    // ESLint to detect two separate installs of the plugin ("couldn't determine the
    // plugin 'react-hooks' uniquely").
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
    "jsx-a11y/alt-text": "warn",
    "jsx-a11y/anchor-is-valid": "warn",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-role": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    // These suites drive React with react-dom/client directly, not Testing
    // Library. The plugin reads `root.render(...)` as a TL util and flags every
    // `act()` wrapper — wrappers that are required with this API, not optional.
    "testing-library/no-unnecessary-act": "off",
    "testing-library/no-render-in-setup": "off",
  },
};
