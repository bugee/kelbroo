/**
 * Prisma Studio to narzędzie administracyjne, nie ścieżka aplikacji.
 *
 * Domyślny DATABASE_URL wskazuje rolę `kelbroo_app`, którą wiąże RLS — bez
 * kontekstu tenanta Studio pokazałoby każdą tabelę jako pustą, mimo że dane
 * są na miejscu. Dlatego łączymy się rolą bezpośrednią.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../../.env'), quiet: true });

if (!process.env.DIRECT_DATABASE_URL) {
  console.error('Brak DIRECT_DATABASE_URL w .env');
  process.exit(1);
}

spawn('prisma', ['studio', ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: path.resolve(here, '..'),
  env: { ...process.env, DATABASE_URL: process.env.DIRECT_DATABASE_URL },
}).on('exit', (code) => process.exit(code ?? 0));
