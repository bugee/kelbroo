import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Guest, GuestAuthGuard } from '../guest/guest.guard';
import type { ResolvedGuest } from '../guest/guest-session.service';
import { OrdersService, type OrderView } from './orders.service';
import { CreateOrderDto } from './dto';

@Controller('orders')
@UseGuards(GuestAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  async create(@Guest() guest: ResolvedGuest, @Body() dto: CreateOrderDto): Promise<OrderView> {
    return this.orders.createForGuest(guest.organizationId, guest.guestSessionId, dto);
  }

  /** Ekran statusu: wszystkie zamówienia bieżącej wizyty przy stoliku. */
  @Get()
  async list(@Guest() guest: ResolvedGuest) {
    return this.orders.listForSession(guest.organizationId, guest.guestSessionId);
  }
}
