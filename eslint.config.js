const globals = require('globals');
const pluginJs = require('@eslint/js');
const pluginReact = require('eslint-plugin-react');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
    {
        ignores: ['frontend/dist/**', 'node_modules/**'],
    },
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            react: pluginReact,
        },
        rules: {
            ...pluginJs.configs.recommended.rules,
            ...pluginReact.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off', // Disabled prop-types for simplicity in this project
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    eslintConfigPrettier, // Disables rules that conflict with Prettier
];
