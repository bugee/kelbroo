import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Ten sam plik .env, z którego korzysta API i docker compose.
loadEnv({ path: path.resolve(__dirname, '../.env'), quiet: true });

/**
 * Porty celowo inne niż deweloperskie (4000 / 3001 / 3002): `pnpm test:e2e`
 * ma dać się uruchomić przy włączonym `pnpm dev`, nie zabijając go ani nie
 * podpinając się pod serwer zbudowany z innego kodu.
 */
const API_PORT = 4200;
const PANEL_PORT = 3202;
const PANEL_URL = `http://localhost:${PANEL_PORT}`;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  // Next w trybie deweloperskim kompiluje trasę przy pierwszym wejściu — pierwszy
  // test, który na nią trafi, płaci za to kilkanaście sekund.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  /**
   * Sekwencyjnie, świadomie.
   *
   * Wszystkie pliki dzielą jedną restaurację w jednej bazie i mutują te same
   * tabele — równoległe przebiegi kończyły się `deadlock detected` przy
   * sprzątaniu i listami, które zmieniały się w trakcie asercji. Zysk z pięciu
   * workerów to kilkanaście sekund; koszt to testy, którym nie można wierzyć.
   */
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: PANEL_URL,
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'pnpm --filter @kelbroo/api dev',
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        API_PORT: String(API_PORT),
        // Panel stoi pod innym originem niż API — bez tego przeglądarka
        // odrzuci odpowiedź, zanim test zdąży cokolwiek zobaczyć.
        CORS_ORIGINS: PANEL_URL,
      },
    },
    {
      command: `pnpm --filter @kelbroo/web-admin exec next dev --port ${PANEL_PORT}`,
      port: PANEL_PORT,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        // Lokalnie nie ma reverse proxy, więc ścieżka względna `/api` trafiłaby
        // w Next, a nie w API. Adres musi być znany w momencie kompilacji.
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}/api`,
      },
    },
  ],
});
