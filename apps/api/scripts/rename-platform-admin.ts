/**
 * Zmienia adres e-mail konta zaplecza kelbroo.
 *
 * Osobno od `create-platform-admin.ts` i **celowo**: tamten skrypt robi `upsert`
 * po adresie, więc uruchomiony z nowym adresem założyłby **drugie konto**
 * zamiast zmienić pierwsze. Dwa czynne konta administratora platformy, o jednym
 * zapomniane, to nie pomyłka kosmetyczna.
 *
 * Zmiana adresu przenosi też **drugi składnik logowania**: kody jednorazowe
 * pójdą od tej chwili na nowy adres.
 *
 *   pnpm --filter @kelbroo/api exec tsx scripts/rename-platform-admin.ts \
 *     "stary@adres.pl" "nowy@adres.pl"
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const [stary, nowy] = process.argv.slice(2);

  if (!stary || !nowy) {
    console.error('Użycie: rename-platform-admin.ts <stary e-mail> <nowy e-mail>');
    process.exit(1);
  }

  const zStarego = stary.toLowerCase().trim();
  const naNowy = nowy.toLowerCase().trim();

  if (!naNowy.includes('@')) {
    console.error('Nowy adres nie wygląda na adres e-mail.');
    process.exit(1);
  }
  if (zStarego === naNowy) {
    console.error('Oba adresy są takie same — nie ma czego zmieniać.');
    process.exit(1);
  }

  const db = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });

  try {
    const konto = await db.platformAdmin.findUnique({ where: { email: zStarego } });
    if (!konto) {
      console.error(`Nie ma konta zaplecza o adresie ${zStarego}.`);
      const wszystkie = await db.platformAdmin.findMany({ select: { email: true } });
      console.error('Istniejące konta:', wszystkie.map((k) => k.email).join(', ') || '(brak)');
      process.exit(1);
    }

    // Adres jest kluczem unikalnym — bez tego sprawdzenia dostalibyśmy surowy
    // błąd bazy zamiast zdania, z którego wiadomo, co się stało.
    const zajety = await db.platformAdmin.findUnique({ where: { email: naNowy } });
    if (zajety) {
      console.error(`Konto o adresie ${naNowy} już istnieje. Najpierw zdecyduj, które zostaje.`);
      process.exit(1);
    }

    await db.platformAdmin.update({ where: { id: konto.id }, data: { email: naNowy } });

    console.log(`Adres konta zaplecza zmieniony: ${zStarego} → ${naNowy}`);
    console.log('Hasło zostaje bez zmian. Kody logowania idą od teraz na nowy adres.');
  } finally {
    await db.$disconnect();
  }
}

void main();
