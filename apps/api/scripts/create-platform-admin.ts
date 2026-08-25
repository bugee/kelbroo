/**
 * Zakłada konto do zaplecza kelbroo.
 *
 * Nie ma tego w panelu ani w API — pierwsze konto musi powstać z konsoli serwera,
 * bo inaczej istniałby endpoint tworzący konto administratora platformy, a taki
 * endpoint jest dokładnie tym, czego atakujący szuka. Kolejne konta dokłada się
 * tym samym poleceniem.
 *
 *   pnpm --filter @kelbroo/api exec tsx scripts/create-platform-admin.ts \
 *     "adres@kelbroo.com" "Imię Nazwisko" "hasło"
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const [email, name, password] = process.argv.slice(2);

  if (!email || !name || !password) {
    console.error('Użycie: create-platform-admin.ts <e-mail> <imię i nazwisko> <hasło>');
    process.exit(1);
  }
  if (password.length < 12) {
    // Dłużej niż w panelu: to konto widzi wszystkich klientów.
    console.error('Hasło do zaplecza musi mieć co najmniej 12 znaków.');
    process.exit(1);
  }

  const db = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
  const adres = email.toLowerCase().trim();

  const admin = await db.platformAdmin.upsert({
    where: { email: adres },
    update: { passwordHash: await bcrypt.hash(password, 12), name, isActive: true },
    create: { email: adres, name, passwordHash: await bcrypt.hash(password, 12) },
  });

  console.log(`Konto zaplecza gotowe: ${admin.email}`);
  console.log('Pamiętaj o ADMIN_JWT_SECRET — bez niego logowanie do zaplecza odmawia.');
  await db.$disconnect();
}

void main();
