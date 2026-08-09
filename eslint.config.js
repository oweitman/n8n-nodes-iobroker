const tsParser = require('@typescript-eslint/parser');
const n8nPlugin = require('eslint-plugin-n8n-nodes-base');
const legacyConfig = require('./.eslintrc.js');

const n8nConfigNameByFiles = {
  'package.json': 'community',
  './credentials/**/*.ts': 'credentials',
  './nodes/**/*.ts': 'nodes',
};

module.exports = [
  {
    ignores: ['.eslintrc.js', '.eslintrc.prepublish.js', '**/*.js', '**/node_modules/**', '**/dist/**'],
  },
  ...legacyConfig.overrides.map((override) => {
    const n8nConfig = n8nPlugin.configs[n8nConfigNameByFiles[override.files[0]]];

    return {
      files: override.files,
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          project: ['./tsconfig.json'],
          sourceType: 'module',
          extraFileExtensions: ['.json'],
        },
      },
      plugins: {
        'n8n-nodes-base': n8nPlugin,
      },
      rules: {
        ...n8nConfig.rules,
        ...override.rules,
      },
    };
  }),
];
