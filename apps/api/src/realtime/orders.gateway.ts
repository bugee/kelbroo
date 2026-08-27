import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

/** Kanał lokalu — panel kelnera i KDS słuchają tego samego pokoju. */
export const restaurantRoom = (restaurantId: string) => `restaurant:${restaurantId}:orders`;

/**
 * Przesiadka gości — osobne zdarzenie, nie odmiana zmiany zamówienia.
 *
 * Wciśnięcie tego w `OrderChangedEvent` wymagałoby podania identyfikatora
 * zamówienia, którego tu nie ma: przesuwa się **wizyta**, a zamówień pod nią
 * może być pięć albo zero. Pole opisane jako `orderId`, niosące identyfikator
 * wizyty, byłoby pułapką dla następnego czytelnika.
 */
export interface TableMovedEvent {
  tableSessionId: string;
  sessionNumber: number;
  fromLabel: string | null;
  toLabel: string;
}

export interface OrderChangedEvent {
  orderId: string;
  orderNumber: number;
  status: string;
  tableLabel: string;
  reason: 'created' | 'confirmed' | 'rejected' | 'status_changed';
}

@WebSocketGateway({ namespace: '/staff' })
export class OrdersGateway implements OnGatewayConnection {
  private readonly logger = new Logger(OrdersGateway.name);

  /** Publiczny, bo współdzielą go inne kanały tego samego pokoju lokalu. */
  @WebSocketServer()
  server!: Server;

  constructor(private readonly auth: AuthService) {}

  /**
   * Uwierzytelnienie przy zestawianiu połączenia, nie przy pierwszej wiadomości.
   * Pokój jest wyprowadzony z tokenu, nigdy z tego, co przyśle klient —
   * inaczej dowolny zalogowany pracownik podsłuchiwałby cudzy lokal.
   */
  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth as { token?: string } | undefined)?.token ??
      client.handshake.headers.authorization?.replace(/^Bearer /i, '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const staff = await this.auth.verifyAccessToken(token);
      if (!staff.restaurantId) {
        client.disconnect(true);
        return;
      }
      await client.join(restaurantRoom(staff.restaurantId));
      client.emit('ready', { restaurantId: staff.restaurantId, role: staff.role });
    } catch {
      client.disconnect(true);
    }
  }

  publishTableMoved(restaurantId: string, event: TableMovedEvent): void {
    try {
      this.server?.to(restaurantRoom(restaurantId)).emit('table.moved', event);
    } catch (error) {
      this.logger.warn(`Nie udało się rozesłać przesiadki: ${String(error)}`);
    }
  }

  publish(restaurantId: string, event: OrderChangedEvent): void {
    // Realtime nie jest jedynym źródłem prawdy — klient po reconnectcie i tak
    // dociąga stan przez REST, więc nieudana emisja nie może wywrócić żądania.
    try {
      this.server?.to(restaurantRoom(restaurantId)).emit('order.changed', event);
    } catch (error) {
      this.logger.warn(`Nie udało się rozesłać zdarzenia: ${String(error)}`);
    }
  }
}
