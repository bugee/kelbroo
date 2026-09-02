import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

/** Największe zdjęcie, jakie przyjmujemy. Panel zmniejsza je jeszcze przed wysłaniem. */
export const MAX_BAJTOW = 3 * 1024 * 1024;

/**
 * Typy, które umiemy podać z powrotem.
 *
 * Lista zamknięta i **sprawdzana po zawartości pliku, nie po nagłówku**: nagłówek
 * pisze przeglądarka, a plik trafia potem na telefony gości.
 */
const TYPY: { mime: string; ext: string; sygnatura: (bajty: Buffer) => boolean }[] = [
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    sygnatura: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: 'png',
    sygnatura: (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    sygnatura: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function rozpoznajTyp(bajty: Buffer): { mime: string; ext: string } {
  const typ = TYPY.find((kandydat) => kandydat.sygnatura(bajty));
  if (!typ) {
    throw new BadRequestException('To nie jest zdjęcie JPG, PNG ani WebP.');
  }
  return { mime: typ.mime, ext: typ.ext };
}

export const mimeDlaPliku = (nazwa: string): string =>
  TYPY.find((typ) => nazwa.endsWith(`.${typ.ext}`))?.mime ?? 'application/octet-stream';

/**
 * Miejsce, w którym leżą zdjęcia dań.
 *
 * Abstrakcja od pierwszej linii, tak jak przy poczcie, płatnościach i fiskalizacji
 * (CLAUDE.md). Dziś jest to katalog na dysku serwera — najprostsze, co działa przy
 * jednym VPS-ie i nie wymaga zakładania konta u nikogo. Docelowo S3/R2 z CDN-em
 * (docs/architecture.md), i wtedy zmienia się wyłącznie implementacja.
 */
export abstract class MenuImageStorage {
  /** Zapisuje zdjęcie i zwraca nazwę, pod którą da się je odczytać. */
  abstract save(bajty: Buffer): Promise<string>;
  abstract read(nazwa: string): Promise<Buffer>;
  abstract remove(nazwa: string): Promise<void>;
}

@Injectable()
export class LocalDiskImageStorage extends MenuImageStorage {
  private readonly logger = new Logger(LocalDiskImageStorage.name);

  /**
   * Katalog z plikami. Na produkcji jest wolumenem Dockera — inaczej zdjęcia
   * znikałyby przy każdej przebudowie obrazu.
   */
  private get katalog(): string {
    return process.env.MEDIA_ROOT ?? path.join(process.cwd(), '.media');
  }

  async save(bajty: Buffer): Promise<string> {
    if (bajty.length > MAX_BAJTOW) {
      throw new BadRequestException('Zdjęcie jest za duże — maksimum 3 MB.');
    }
    const { ext } = rozpoznajTyp(bajty);

    // Nazwa losowa, nie od nazwy pozycji: plik leży na dysku poza zasięgiem RLS,
    // więc przewidywalna ścieżka pozwalałaby zgadywać cudze zdjęcia. Zawartość
    // menu nie jest tajna, ale zgadywanie po nazwach lokalu już by nią było.
    const nazwa = `${randomUUID()}.${ext}`;
    try {
      await mkdir(this.katalog, { recursive: true });
      await writeFile(path.join(this.katalog, nazwa), bajty);
    } catch (przyczyna) {
      // Najczęstsza przyczyna: wolumen Dockera założony jako `root`, a proces
      // chodzi jako `kelbroo`. Goła pięćsetka nie mówi o tym nic, a objaw myli
      // — stare zdjęcia dalej się wyświetlają, bo odczyt działa.
      this.logger.error(`Zapis zdjęcia w ${this.katalog} nie powiódł się: ${String(przyczyna)}`);
      throw new InternalServerErrorException(
        'Serwer nie może zapisać pliku w katalogu na zdjęcia. Sprawdź prawa do katalogu z mediami.',
      );
    }
    return nazwa;
  }

  async read(nazwa: string): Promise<Buffer> {
    try {
      return await readFile(path.join(this.katalog, this.bezpiecznaNazwa(nazwa)));
    } catch {
      throw new NotFoundException('Nie ma takiego zdjęcia.');
    }
  }

  async remove(nazwa: string): Promise<void> {
    // Brak pliku nie jest błędem: kasujemy po to, żeby go nie było.
    await rm(path.join(this.katalog, this.bezpiecznaNazwa(nazwa)), { force: true }).catch(
      (przyczyna: unknown) =>
        this.logger.warn(`Nie udało się usunąć ${nazwa}: ${String(przyczyna)}`),
    );
  }

  /**
   * Nazwa przychodzi z adresu URL, więc mogłaby nieść `../` i wyprowadzić odczyt
   * poza katalog. Przyjmujemy wyłącznie kształt, który sami generujemy.
   */
  private bezpiecznaNazwa(nazwa: string): string {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(nazwa)) {
      throw new NotFoundException('Nie ma takiego zdjęcia.');
    }
    return nazwa;
  }
}
