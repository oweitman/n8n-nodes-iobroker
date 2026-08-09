const config = require('./eslint.config.js');

module.exports = [
  ...config,
  {
    files: ['package.json'],
    rules: {
      'n8n-nodes-base/community-package-json-name-still-default': 'error',
    },
  },
];
