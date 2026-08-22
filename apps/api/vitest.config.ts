import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    // Testy RLS dzielą jedną bazę — równoległe pliki wchodziłyby sobie w drogę.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
