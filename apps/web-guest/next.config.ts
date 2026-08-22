import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Pakiety współdzielone są publikowane jako źródła TSX — kompiluje je Next.
  transpilePackages: ['@kelbroo/types', '@kelbroo/ui'],
};

export default config;
