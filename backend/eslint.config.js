// @ts-check
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'src/**/*.js'],
  },
  // Source files — full rules including JSDoc
  {
    files: ['src/**/*.ts'],
    ignores: [
      'src/**/*.test.ts',
      'src/**/*.integration.test.ts',
      'src/**/*.edge.test.ts',
      'src/**/*.spec.ts',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      jsdoc: require('eslint-plugin-jsdoc'),
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
            MethodDefinition: false,
            ClassDeclaration: false,
          },
          publicOnly: true,
          checkConstructors: false,
        },
      ],
      'jsdoc/require-param': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-description': 'error',
    },
  },
  // Test files — relaxed rules, no JSDoc requirements
  {
    files: [
      'src/**/*.test.ts',
      'src/**/*.integration.test.ts',
      'src/**/*.edge.test.ts',
      'src/**/*.spec.ts',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', {
        'varsIgnorePattern': '^_',
        'argsIgnorePattern': '^_',
        'ignoreRestSiblings': true,
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
];
