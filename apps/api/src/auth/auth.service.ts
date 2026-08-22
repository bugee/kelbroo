import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import type { SignOptions } from 'jsonwebtoken';
import type { StaffRole } from '@kelbroo/types';
import type { AccessTokenPayload, StaffContext } from './auth.types';

/** Ten sam koszt co w seedzie — hasła z obu źródeł muszą być wymienne. */
const PASSWORD_ROUNDS = 10;

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  staff: StaffContext & { mustChangePassword: boolean };
}

@Injectable()
export class AuthService {
  /**
   * Logowanie jest jedynym miejscem, w którym szukamy pracownika bez znajomości
   * tenanta — po adresie e-mail, zanim wiadomo, do której organizacji należy.
   * Dlatego używa połączenia bezpośredniego, świadomie i tylko tutaj;
   * wszystkie pozostałe zapytania idą przez RLS.
   */
  private readonly directory = new PrismaClient({
    datasourceUrl: process.env.DIRECT_DATABASE_URL,
  });

  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const staff = await this.directory.staffMember.findFirst({
      where: { email: email.toLowerCase().trim() },
    });

    // Ten sam komunikat i ta sama ścieżka niezależnie od tego, czy konto
    // istnieje — inaczej formularz logowania staje się listą pracowników.
    const passwordHash =
      staff?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const matches = await bcrypt.compare(password, passwordHash);

    if (!staff || !matches || !staff.isActive) {
      throw new UnauthorizedException('Nieprawidłowy e-mail lub hasło.');
    }

    await this.directory.staffMember.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });

    const context: StaffContext = {
      staffId: staff.id,
      organizationId: staff.organizationId,
      restaurantId: staff.restaurantId,
      role: staff.role as StaffRole,
      name: staff.name,
    };

    return {
      ...(await this.issueTokens(context)),
      staff: { ...context, mustChangePassword: staff.mustChangePassword },
    };
  }

  /**
   * Zmiana własnego hasła. Wymaga podania aktualnego, nawet gdy pracownik ma
   * ważną sesję — token dostępu leży w pamięci przeglądarki na wspólnym tablecie
   * i sam w sobie nie jest dowodem, że przy urządzeniu stoi właściciel konta.
   */
  async changePassword(staffId: string, currentPassword: string, newPassword: string) {
    const staff = await this.directory.staffMember.findUnique({ where: { id: staffId } });
    if (!staff || !staff.isActive) {
      throw new UnauthorizedException('Konto jest nieaktywne.');
    }

    if (!(await bcrypt.compare(currentPassword, staff.passwordHash))) {
      throw new UnauthorizedException('Nieprawidłowe aktualne hasło.');
    }

    if (await bcrypt.compare(newPassword, staff.passwordHash)) {
      throw new BadRequestException('Nowe hasło musi różnić się od aktualnego.');
    }

    await this.directory.staffMember.update({
      where: { id: staff.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, PASSWORD_ROUNDS),
        // Flaga wymuszająca zmianę gaśnie dopiero tutaj — konto założone
        // ręcznie w bazie startuje z `mustChangePassword = true`.
        mustChangePassword: false,
      },
    });
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Sesja wygasła — zaloguj się ponownie.');
    }

    // Token odświeżający nie może przeżyć dezaktywacji konta.
    const staff = await this.directory.staffMember.findUnique({ where: { id: payload.sub } });
    if (!staff || !staff.isActive) {
      throw new UnauthorizedException('Konto jest nieaktywne.');
    }

    return this.issueTokens({
      staffId: staff.id,
      organizationId: staff.organizationId,
      restaurantId: staff.restaurantId,
      role: staff.role as StaffRole,
      name: staff.name,
    });
  }

  async verifyAccessToken(token: string): Promise<StaffContext> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      return {
        staffId: payload.sub,
        organizationId: payload.org,
        restaurantId: payload.rst,
        role: payload.role,
        name: payload.name,
      };
    } catch {
      throw new UnauthorizedException('Sesja wygasła — zaloguj się ponownie.');
    }
  }

  private async issueTokens(context: StaffContext) {
    const payload: AccessTokenPayload = {
      sub: context.staffId,
      org: context.organizationId,
      rst: context.restaurantId,
      role: context.role,
      name: context.name,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: ttl(process.env.JWT_ACCESS_TTL, '15m'),
      }),
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: ttl(process.env.JWT_REFRESH_TTL, '30d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}

/** Konfiguracja przychodzi ze zmiennej środowiskowej jako zwykły string. */
function ttl(configured: string | undefined, fallback: string): SignOptions['expiresIn'] {
  return (configured ?? fallback) as SignOptions['expiresIn'];
}
