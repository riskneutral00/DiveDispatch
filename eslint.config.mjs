// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import { fixupPluginRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import ddDesign from "./src/lib/eslint/dd-design-rules.mjs";

const LEGACY_PLUGINS = new Set(["react", "jsx-a11y", "import"]);

function fixupNextConfig(configs) {
  return configs.map((c) => {
    if (!c?.plugins) return c;
    const plugins = Object.fromEntries(
      Object.entries(c.plugins).map(([name, plugin]) =>
        LEGACY_PLUGINS.has(name) ? [name, fixupPluginRules(plugin)] : [name, plugin]
      )
    );
    return { ...c, plugins };
  });
}

const eslintConfig = defineConfig([
  ...fixupNextConfig(nextVitals),
  ...fixupNextConfig(nextTs),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
    ".tmp/**",
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
      "dd-design/no-raw-text-size": "error",
      "dd-design/no-hardcoded-radius": "error",
      "dd-design/no-unprefixed-multicol": "error",
      "dd-design/no-tokenizable-inline-style": "warn",
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
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  ...storybook.configs["flat/recommended"]
]);

export default eslintConfig;
