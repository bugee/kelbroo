import path from 'node:path';
import type { NextConfig } from 'next';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

/**
 * Zaplecze kelbroo (System 4). Obsługuje nas, nie restauracje.
 *
 * Nie sięga po `@kelbroo/ui`: komponenty panelu są pisane pod tablet w kuchni,
 * a to jest narzędzie biurowe. Wspólna jest paleta (przez `@kelbroo/config`),
 * bo to jeden produkt, ale nie komponenty.
 */
const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default config;
