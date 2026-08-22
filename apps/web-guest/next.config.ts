import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Obraz produkcyjny dostaje tylko to, czego naprawdę potrzebuje do startu.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Pakiety współdzielone są publikowane jako źródła TSX — kompiluje je Next.
  transpilePackages: ['@kelbroo/types', '@kelbroo/ui'],
};

export default config;
