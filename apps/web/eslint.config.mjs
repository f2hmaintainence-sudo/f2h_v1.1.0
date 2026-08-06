import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/style/icon/fontawesome/js/fontawesome.min.js",
      "src/style/icon/fontawesome/js/v4-shims.min.js", // 👈 added
      "**/*.min.js", // 👈 optional: ignore ALL minified JS
    ],
   // 🔹 2. Extend Next.js rules
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // 🔹 3. Custom rule overrides
  
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    },
  },
];

export default eslintConfig;
