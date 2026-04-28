import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**', 'convex/**'],
      exclude: ['**/node_modules/**', '**/*.d.ts', '**/_generated/**', '**/seed*.ts', 'convex/seed.ts', 'convex/seedData.ts', 'convex/parkedData.ts', 'convex/seedBookingData.ts',
      'src/app/**', 'src/components/**', 'src/hooks/**', 'src/i18n/**', 'src/themes/theme-provider.tsx', 'src/themes/theme-loader.ts', 'src/themes/theme-types.ts',
      'src/lib/hooks/use-current-user.ts', 'src/lib/hooks/use-debounce.ts', 'src/lib/hooks/use-profile-form.ts', 'src/lib/hooks/use-stable-query.ts', 'src/lib/validation/useFormValidation.ts',
      'src/lib/types/**', 'src/lib/validators/**',
      'src/lib/validation/index.ts', 'src/components/glass/index.ts', 'src/lib/convex.tsx', 'src/proxy.ts',
      'convex/devSwitcher.ts', 'convex/equipmentWidget.ts', 'convex/themes.ts', 'convex/auth.config.ts', 'convex/crons.ts', 'convex/http.ts', 'convex/testHelpers.ts'],
      thresholds: {
        statements: 75
      },
      reporter: ['text', 'json', 'html']
    },
    setupFiles: ['./vitest.setup.ts'],
    tags: [{
      name: 'slow',
      description: 'Heavy Convex security / scenario suites. Excluded from test:quick (see package.json).'
    }],
    exclude: ['**/node_modules/**', '**/.overstory/worktrees/**', '**/.worktrees/**', '**/.research/**', 'e2e/**']
  }
});
