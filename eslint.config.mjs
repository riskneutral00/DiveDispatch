// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import ddDesign from "./src/lib/eslint/dd-design-rules.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
  ]),
  // ── DiveDispatch design system rules ──────────────────────────────────────
  // Mirrors Claude Code hooks so enforcement works in ANY editor and CI.
  {
    files: ["src/**/*.tsx"],
    plugins: { "dd-design": ddDesign },
    rules: {
      "dd-design/no-hardcoded-palette": "error",
      "dd-design/no-off-ladder-spacing": "error",
      "dd-design/no-bare-form-elements": "error",
      "dd-design/no-inline-color": "error",
    },
  },
  // Profile form DRY enforcement — force barrel imports, prevent bypassing shared components
  {
    files: ["src/components/profiles/*-profile-form.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "@/lib/profile-form/types",
              "@/lib/profile-form/location",
              "@/lib/profile-form/languages",
              "@/lib/profile-form/save-feedback",
            ],
            message: "Import from '@/lib/profile-form' (barrel) instead of individual submodules.",
          },
        ],
      }],
    },
  },
  ...storybook.configs["flat/recommended"]
]);

export default eslintConfig;
