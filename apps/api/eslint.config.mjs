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
      // ── Ratcheted debt: reported, not blocking ──────────────────────────────
      // These fire ~12,000 times against the existing code. They are the type-debt
      // signal (every `: any` on a @Body()/@Query() leaves the global
      // ValidationPipe with no metadata, so it strips nothing) and the target is to
      // drive them down — but as errors they would make the gate permanently red
      // and therefore ignored.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      // Formatting is not correctness, and a repo-wide reformat belongs in its own
      // commit rather than buried in a behavioural change.
      'prettier/prettier': 'warn',
      // Pre-existing strictness findings, unrelated to the defect classes above.
      // Reported so they can be worked down, not blocking today.
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'prefer-const': 'warn',

      // ── Blocking: the defect classes this pass removed ──────────────────────

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
