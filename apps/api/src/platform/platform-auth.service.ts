import { createHash, randomInt } from 'node:crypto';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';
import { ramka, tekstem, type Ramka } from '../mail/templates';

export interface PlatformAdminContext {
  adminId: string;
  email: string;
  name: string;
}

/** Ważność tokenu zaplecza. Krócej niż w panelu — to konto widzi wszystkich klientów. */
const TOKEN_TTL = '2h';

/** Ile czasu na przepisanie kodu ze skrzynki. */
const KOD_WAZNY_MINUT = 10;

/**
 * Ile razy wolno się pomylić. Sześć cyfr to milion kombinacji — bez tego limitu
 * kod jest do zgadnięcia skryptem w kilka minut, a cała druga bariera znika.
 */
const MAX_PROB = 5;

/** Kod sześciocyfrowy z generatora kryptograficznego, nie z `Math.random`. */
function kod(): { kod: string; hash: string } {
  const wartosc = randomInt(0, 1_000_000).toString().padStart(6, '0');
  return { kod: wartosc, hash: createHash('sha256').update(wartosc).digest('hex') };
}

/**
 * Logowanie do zaplecza kelbroo.
 *
 * Trzy rzeczy odróżniają je od logowania do panelu restauracji i wszystkie trzy
 * są celowe.
 *
 * **Osobny sekret.** Token zaplecza podpisujemy `ADMIN_JWT_SECRET`, nie tym co
 * panel. Dzięki temu token pracownika restauracji nie przejdzie tu walidacji
 * *matematycznie*, a nie tylko dlatego, że ktoś pamiętał o sprawdzeniu roli.
 *
 * **Brak sekretu wyłącza zaplecze.** Bez `ADMIN_JWT_SECRET` logowanie odmawia.
 * Wdrożenie, w którym ktoś zapomni ustawić zmienną, nie wystawia panelu
 * platformy — a to jest właściwy kierunek pomyłki.
 *
 * **Połączenie katalogowe.** Konta platformy są poza zasięgiem roli aplikacyjnej
 * (migracja odbiera jej uprawnienia), więc czyta je to samo połączenie, którego
 * używa logowanie do panelu.
 */
@Injectable()
export class PlatformAuthService {
  private readonly logger = new Logger(PlatformAuthService.name);

  private readonly directory = new PrismaClient({
    datasourceUrl: process.env.DIRECT_DATABASE_URL,
  });

  constructor(
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  static get enabled(): boolean {
    return Boolean(process.env.ADMIN_JWT_SECRET);
  }

  private wymagajKonfiguracji(): void {
    void this.secret;
  }

  private get secret(): string {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('Zaplecze nie jest skonfigurowane.');
    }
    return secret;
  }

  /**
   * Pierwszy krok: hasło. **Nie wydaje tokenu** — odsyła uchwyt do drugiego kroku.
   *
   * Kod idzie na adres administratora, więc samo hasło, choćby wykradzione
   * z laptopa, nie otwiera zaplecza. To jedyna bariera po odłożeniu ograniczenia
   * po adresie IP.
   */
  async login(email: string, password: string) {
    // Odmawiamy od razu, gdy zaplecze nie jest skonfigurowane — inaczej wysłalibyśmy
    // kod, którego i tak nie da się wymienić na token.
    this.wymagajKonfiguracji();
    const admin = await this.directory.platformAdmin.findFirst({
      where: { email: email.toLowerCase().trim() },
    });

    // Ta sama ścieżka i ten sam czas niezależnie od tego, czy konto istnieje.
    const hash =
      admin?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const matches = await bcrypt.compare(password, hash);

    if (!admin || !matches || !admin.isActive) {
      throw new UnauthorizedException('Nieprawidłowy e-mail lub hasło.');
    }

    // Poprzednie, niedokończone próby przepadają: dwa ważne kody naraz to dwa
    // razy większa szansa zgadnięcia, a użytkownik i tak przepisuje najnowszy.
    await this.directory.platformLoginChallenge.deleteMany({ where: { adminId: admin.id } });

    const { kod: wartosc, hash: kodHash } = kod();
    const proba = await this.directory.platformLoginChallenge.create({
      data: {
        adminId: admin.id,
        codeHash: kodHash,
        expiresAt: new Date(Date.now() + KOD_WAZNY_MINUT * 60_000),
      },
    });

    await this.wyslijKod(admin.email, wartosc);
    this.logger.log(`Zaplecze — wysłano kod do ${admin.email}`);

    return { challengeId: proba.id, expiresInMinutes: KOD_WAZNY_MINUT };
  }

  /**
   * Drugi krok: kod ze skrzynki.
   *
   * Każda pomyłka jest liczona, a po `MAX_PROB` próba przepada w całości —
   * trzeba zacząć od hasła. Kod jest jednorazowy.
   */
  async verifyCode(challengeId: string, kodWpisany: string) {
    const secret = this.secret;
    const proba = await this.directory.platformLoginChallenge.findUnique({
      where: { id: challengeId },
    });

    // Jeden komunikat na wszystkie powody: nieistniejąca próba, wygasła, zużyta
    // i wyczerpana niczym się dla pytającego nie różnią.
    const odmowa = new UnauthorizedException(
      'Kod jest nieprawidłowy albo wygasł. Zaloguj się ponownie.',
    );

    if (!proba || proba.usedAt || proba.expiresAt < new Date() || proba.attempts >= MAX_PROB) {
      throw odmowa;
    }

    const pasuje = createHash('sha256').update(kodWpisany.trim()).digest('hex') === proba.codeHash;
    if (!pasuje) {
      await this.directory.platformLoginChallenge.update({
        where: { id: proba.id },
        data: { attempts: { increment: 1 } },
      });
      throw odmowa;
    }

    const admin = await this.directory.platformAdmin.findUnique({ where: { id: proba.adminId } });
    if (!admin?.isActive) throw odmowa;

    await Promise.all([
      this.directory.platformLoginChallenge.update({
        where: { id: proba.id },
        data: { usedAt: new Date() },
      }),
      this.directory.platformAdmin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);
    this.logger.log(`Logowanie do zaplecza: ${admin.email}`);

    const context: PlatformAdminContext = {
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
    };

    return {
      accessToken: await this.jwt.signAsync(context, { secret, expiresIn: TOKEN_TTL }),
      admin: context,
    };
  }

  private async wyslijKod(email: string, wartosc: string): Promise<void> {
    const tresc: Ramka = {
      adresStrony: this.mail.adresStrony,
      // Kod jest już w temacie — w nagłówku byłby trzeci raz na jednym ekranie.
      naglowek: 'Kod logowania do zaplecza',
      akapity: [
        `Przepisz ten kod w zapleczu kelbroo, żeby dokończyć logowanie.`,
        `<strong style="font-size:32px;letter-spacing:6px">${wartosc}</strong>`,
      ],
      stopka: [
        `Kod jest ważny ${KOD_WAZNY_MINUT} minut i działa raz.`,
        '<strong>Jeśli to nie Ty próbujesz się zalogować, ktoś zna Twoje hasło.</strong> ' +
          'Zmień je natychmiast.',
      ],
    };

    await this.mail.send({
      to: email,
      subject: `${wartosc} — kod logowania do zaplecza kelbroo`,
      text: tekstem(tresc),
      html: ramka(tresc),
    });
  }

  async verify(token: string): Promise<PlatformAdminContext> {
    try {
      const payload = await this.jwt.verifyAsync<PlatformAdminContext>(token, {
        secret: this.secret,
      });
      // Konto mogło zostać wyłączone po wydaniu tokenu.
      const admin = await this.directory.platformAdmin.findUnique({
        where: { id: payload.adminId },
      });
      if (!admin?.isActive) throw new UnauthorizedException();
      return { adminId: admin.id, email: admin.email, name: admin.name };
    } catch {
      throw new UnauthorizedException('Sesja wygasła — zaloguj się ponownie.');
    }
  }
}
