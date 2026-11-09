// ESLint 9 flat config. Deliberately small: it catches real bugs (undefined
// variables, broken hook rules) and surfaces react-hooks/exhaustive-deps as a
// warning. It is wired into CI as a non-blocking step; do not mass-fix warnings.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'scripts/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,mjs}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser }
    },
    settings: { react: { version: '18.2' } },
    rules: {
      // Mark JSX component usage as "used" for no-unused-vars.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none', varsIgnorePattern: '^(_|React)$' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'warn',
      'no-control-regex': 'warn',
      'no-misleading-character-class': 'warn',
      'no-case-declarations': 'warn',
      'no-cond-assign': 'warn',
      'no-fallthrough': 'warn',
      'no-useless-catch': 'warn'
    }
  }
];
