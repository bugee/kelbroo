import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Strona produktowa. Statyczna z założenia — nie ma tu ani sesji, ani danych
 * z bazy, więc renderuje się raz przy budowaniu i dalej idzie z pamięci.
 *
 * Bez `transpilePackages`: ta aplikacja celowo nie sięga po `@kelbroo/ui` ani
 * `@kelbroo/types`. Jej wygląd pochodzi z `design/landing-page.html`, a nie
 * z systemu komponentów panelu — te dwa światy mają się nie splatać.
 */
const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default config;
