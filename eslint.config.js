const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['coverage/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023 },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
    },
  },
  {
    // Server, scripts and tests: Node only. The browser code (public/) does not get
    // Node globals, so using require/process there is a lint error.
    files: ['**/*.js'],
    ignores: ['public/**'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, Api: 'readonly', Dom: 'readonly', Validation: 'readonly' },
    },
    rules: {
      // RNF-07: the frontend never builds HTML from strings. Data is rendered with
      // textContent / Dom.h, so user input can never become markup.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
          message: 'RNF-07 (XSS): usa textContent o Dom.h, nunca innerHTML/outerHTML.',
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'RNF-07 (XSS): usa Dom.h en lugar de insertAdjacentHTML.',
        },
        {
          selector: "CallExpression[callee.object.name='document'][callee.property.name=/^write/]",
          message: 'RNF-07 (XSS): document.write no está permitido.',
        },
      ],
    },
  },
  prettier,
];
