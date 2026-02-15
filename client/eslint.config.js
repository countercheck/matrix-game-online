import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Disable react-refresh for hooks (they intentionally export hooks alongside providers)
  {
    files: ['src/hooks/**/*.tsx', 'src/hooks/**/*.ts'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Disable react-refresh for test utilities (not meant for HMR)
  {
    files: ['src/test/**/*.tsx', 'src/test/**/*.ts'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Disable react-refresh for UI components that export hooks (like useConfirm)
  {
    files: ['src/components/ui/ConfirmDialog.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  }
);
