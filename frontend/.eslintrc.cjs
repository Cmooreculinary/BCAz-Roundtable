// Frontend ESLint configuration
// This extends react-app defaults and adds import/a11y rules.
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  // `react-app` already registers eslint-plugin-{import,react,react-hooks,
  // jsx-a11y} from its own nested copies. Extending each plugin's recommended
  // config here loaded a *second* instance of the same plugin, which ESLint
  // refuses to resolve — it failed `yarn lint` and `yarn build` outright.
  // The plugins stay registered through react-app; the rules we care about
  // beyond its defaults are listed explicitly below.
  extends: ["react-app", "react-app/jest"],
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
