import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/.overstory/worktrees/**',
      '**/.worktrees/**',
      'e2e/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**', 'convex/**'],
      exclude: [
        '**/node_modules/**',
        '**/*.d.ts',
        '**/_generated/**',
        '**/seed*.ts',
        'convex/seed.ts',
        'convex/seedData.ts',
        'convex/seedInstructorData.ts',
        'convex/seedBookingData.ts',
        // React components, pages, and hooks require E2E / visual regression tests
        'src/app/**',
        'src/components/**',
        'src/hooks/**',
        'src/i18n/**',
        'src/themes/theme-provider.tsx',
        'src/themes/theme-loader.ts',
        'src/themes/theme-types.ts',
        // React hooks (require component rendering context)
        'src/lib/hooks/use-current-user.ts',
        'src/lib/hooks/use-debounce.ts',
        'src/lib/hooks/use-profile-form.ts',
        'src/lib/hooks/use-stable-query.ts',
        'src/lib/validation/useFormValidation.ts',
        // Pure type files with no runtime statements
        'src/lib/types/**',
        'src/lib/validators/**',
        // Re-export barrels / config-only
        'src/lib/validation/index.ts',
        'src/components/glass/index.ts',
        'src/lib/convex.ts',
        'src/lib/nav-items.ts',
        'src/proxy.ts',
        // Convex runtime-dependent (require Convex server context)
        'convex/devSwitcher.ts',
        'convex/equipmentWidget.ts',
        'convex/themes.ts',
        'convex/auth.config.ts',
        'convex/crons.ts',
        'convex/http.ts',
        'convex/testHelpers.ts',
      ],
      thresholds: {
        statements: 75,
      },
      reporter: ['text', 'json', 'html'],
    },
  },
})
