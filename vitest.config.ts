import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/.overstory/worktrees/**',
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
      ],
      thresholds: {
        statements: 40,
      },
      reporter: ['text', 'json', 'html'],
    },
  },
})
