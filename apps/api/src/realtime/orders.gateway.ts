import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

/** Kanał lokalu — panel kelnera i KDS słuchają tego samego pokoju. */
export const restaurantRoom = (restaurantId: string) => `restaurant:${restaurantId}:orders`;

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

  @WebSocketServer()
  private server!: Server;

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
