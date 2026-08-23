import path from 'node:path';
import type { NextConfig } from 'next';
import { config as loadEnv } from 'dotenv';

// Jeden plik .env w korzeniu monorepo — ten sam, z którego korzysta API i docker
// compose. Next sam czyta .env wyłącznie z katalogu aplikacji, więc bez tego
// NEXT_PUBLIC_API_URL nie istnieje w czasie kompilacji, a przeglądarka pyta
// o /api na własnym originie, czyli o stronę 404 Nexta.
loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const config: NextConfig = {
  reactStrictMode: true,
  // Obraz produkcyjny dostaje tylko to, czego naprawdę potrzebuje do startu.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Pakiety współdzielone są publikowane jako źródła TSX — kompiluje je Next.
  transpilePackages: ['@kelbroo/types', '@kelbroo/ui'],
};

export default config;
