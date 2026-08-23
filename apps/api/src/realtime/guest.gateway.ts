import { Logger } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { GuestSessionService } from '../guest/guest-session.service';

/** Kanał wizyty — wszystkie telefony przy jednym stoliku słuchają tego samego pokoju. */
export const sessionRoom = (tableSessionId: string) => `session:${tableSessionId}`;

export interface GuestVisitEvent {
  /** Co się zmieniło: zamówienia, wezwanie kelnera albo wstęp do wizyty. */
  kind: 'orders' | 'call' | 'access';
}

/**
 * Realtime dla gościa.
 *
 * Osobna przestrzeń nazw od panelu, bo to inne uwierzytelnienie i inny zakres:
 * gość widzi wyłącznie swoją wizytę, personel cały lokal. Pokój wyprowadzamy
 * z tokenu, nigdy z tego, co przyśle klient — inaczej dowolny gość podsłuchiwałby
 * cudzy stolik.
 *
 * Zdarzenie mówi tylko, że coś się zmieniło. Dane klient dociąga przez REST,
 * więc zgubiona wiadomość nie zostawia go z nieprawdziwym rachunkiem.
 */
@WebSocketGateway({ namespace: '/guest' })
export class GuestGateway implements OnGatewayConnection {
  private readonly logger = new Logger(GuestGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly guests: GuestSessionService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth as { token?: string } | undefined)?.token ??
      client.handshake.headers['x-guest-token']?.toString();

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const guest = await this.guests.resolve(token);
      if (!guest) {
        client.disconnect(true);
        return;
      }

      const session = await this.prisma.withTenant(guest.organizationId, async (tx) =>
        tx.guestSession.findUnique({
          where: { id: guest.guestSessionId },
          select: { tableSessionId: true },
        }),
      );
      if (!session) {
        client.disconnect(true);
        return;
      }

      await client.join(sessionRoom(session.tableSessionId));
      client.emit('ready', {});
    } catch {
      client.disconnect(true);
    }
  }

  publish(tableSessionId: string, event: GuestVisitEvent): void {
    // Realtime nie jest źródłem prawdy — nieudana emisja nie może wywrócić
    // żądania, które ją wywołało.
    try {
      this.server?.to(sessionRoom(tableSessionId)).emit('visit.changed', event);
    } catch (error) {
      this.logger.warn(`Nie udało się rozesłać zdarzenia wizyty: ${String(error)}`);
    }
  }
}
