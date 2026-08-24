import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Strona produktowa. Statyczna z założenia — nie ma tu ani sesji, ani danych
 * z bazy, więc renderuje się raz przy budowaniu i dalej idzie z pamięci.
 *
 * Po `@kelbroo/ui` nie sięga celowo: wygląd pochodzi z `design/landing-page.html`,
 * a nie z systemu komponentów panelu — te dwa światy mają się nie splatać.
 * `@kelbroo/types` to co innego: formularz rejestracji sprawdza NIP tą samą
 * funkcją co serwer, bo dwie kopie reguły rozjechałyby się przy pierwszej zmianie.
 */
const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@kelbroo/types'],
};

export default config;
