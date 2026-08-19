// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Ratcheted, not off: every `: any` on a @Body()/@Query() parameter leaves the
      // global ValidationPipe with no metadata to work with, so it strips nothing
      // and unvalidated input reaches the query builders. New code should type it.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',

      // The API has Winston with rotation, retention, and a redacting formatter.
      // Raw console calls bypass all of it and produce unstructured, unrotatable
      // output — and one of them was logging plaintext passwords.
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // An empty catch turns a failure into silence. Handle it, log it with
      // context, or rethrow — and if a failure genuinely is tolerable, say why.
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-empty-function': [
        'error',
        { allow: ['arrowFunctions', 'methods', 'constructors'] },
      ],

      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // One-off maintenance scripts are run by hand from a terminal; stdout is their
    // interface, and they have no injected logger.
    files: ['src/scripts/**/*.{ts,js}', '**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
