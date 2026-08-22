import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ResolvedGuest {
  organizationId: string;
  guestSessionId: string;
}

/**
 * Anonimowa sesja gościa: token bez konta, bez danych osobowych, ważny na czas
 * wizyty. W bazie trzymamy wyłącznie skrót — wyciek tabeli nie daje dostępu do
 * cudzych zamówień.
 */
@Injectable()
export class GuestSessionService {
  constructor(private readonly prisma: PrismaService) {}

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  static issueToken(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: GuestSessionService.hash(token) };
  }

  static ttlHours(): number {
    const configured = Number(process.env.GUEST_SESSION_TTL_HOURS ?? 6);
    return Number.isFinite(configured) && configured > 0 ? configured : 6;
  }

  static expiryFrom(now: Date): Date {
    return new Date(now.getTime() + GuestSessionService.ttlHours() * 60 * 60 * 1000);
  }

  /**
   * Zamienia token gościa na kontekst tenanta.
   *
   * Zapytanie idzie przez funkcję SECURITY DEFINER, bo w tym momencie nie znamy
   * jeszcze organizacji — bez niej RLS (słusznie) nie przepuściłby niczego.
   * Funkcja zwraca wyłącznie identyfikatory i wyłącznie dla sesji niewygasłych.
   */
  async resolve(token: string): Promise<ResolvedGuest | null> {
    const rows = await this.prisma.$queryRaw<
      { organization_id: string; guest_session_id: string }[]
    >`SELECT * FROM app.resolve_guest_session(${GuestSessionService.hash(token)})`;

    const row = rows[0];
    return row
      ? { organizationId: row.organization_id, guestSessionId: row.guest_session_id }
      : null;
  }

  async touch(tx: Prisma.TransactionClient, guestSessionId: string): Promise<void> {
    await tx.guestSession.update({
      where: { id: guestSessionId },
      data: { lastSeenAt: new Date() },
    });
  }
}
