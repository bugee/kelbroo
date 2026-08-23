import { Injectable, Logger } from '@nestjs/common';
import { OrdersGateway, restaurantRoom } from './orders.gateway';

export interface WaiterCallEvent {
  callId: string;
  tableLabel: string;
  reason: 'help' | 'bill' | 'water' | 'other';
}

/**
 * Sygnały do personelu, które nie są zmianą statusu zamówienia.
 *
 * Dzieli pokój z `OrdersGateway`, bo panel i tak trzyma jedno połączenie na
 * lokal — osobny kanał oznaczałby drugie połączenie z tego samego tabletu.
 * Osobna klasa, bo to inna domena zdarzeń i inny kształt danych.
 */
@Injectable()
export class StaffSignalsGateway {
  private readonly logger = new Logger(StaffSignalsGateway.name);

  constructor(private readonly orders: OrdersGateway) {}

  publishWaiterCall(restaurantId: string, event: WaiterCallEvent): void {
    // Realtime nie jest źródłem prawdy — wezwanie leży w bazie i panel dociąga
    // je przez REST, więc nieudana emisja nie może wywrócić żądania gościa.
    try {
      this.orders.server?.to(restaurantRoom(restaurantId)).emit('waiter.called', event);
    } catch (error) {
      this.logger.warn(`Nie udało się rozesłać wezwania: ${String(error)}`);
    }
  }
}
