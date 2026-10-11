// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // Data requests are started from effects; these callbacks set loading state
      // before the first await. The app does not use React Compiler.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  }
]);
