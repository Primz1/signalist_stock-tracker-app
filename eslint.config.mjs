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
      "ai-service/**",
      "files/**",
      "Stock trading app prototype/**",
      "Signalist 21stdev ui prompts/**",
      "e2e/**",
      "database/test-db-connection.js",
      "components/dashboard/DashboardTradingViewBackup.tsx",
    ],
  },
  {
    rules: {
      // Pre-existing codebase; keep CI green while design/refactor lands
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
];

export default eslintConfig;
