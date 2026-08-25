import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export interface PlatformAdminContext {
  adminId: string;
  email: string;
  name: string;
}

/** Ważność tokenu zaplecza. Krócej niż w panelu — to konto widzi wszystkich klientów. */
const TOKEN_TTL = '2h';

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

  constructor(private readonly jwt: JwtService) {}

  static get enabled(): boolean {
    return Boolean(process.env.ADMIN_JWT_SECRET);
  }

  private get secret(): string {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('Zaplecze nie jest skonfigurowane.');
    }
    return secret;
  }

  async login(email: string, password: string) {
    const secret = this.secret;
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

    await this.directory.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
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
