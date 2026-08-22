import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { OrderStatus } from '@kelbroo/types';
import { Roles, Staff, StaffAuthGuard } from '../auth/staff.guard';
import type { StaffContext } from '../auth/auth.types';
import { StaffOrdersService } from './staff-orders.service';
import { StaffSessionsService, type OfflineMethod } from './staff-sessions.service';

class ReasonDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}

class AdvanceDto {
  @IsIn(['preparing', 'ready', 'served'])
  status!: Extract<OrderStatus, 'preparing' | 'ready' | 'served'>;
}

class SettleDto {
  @IsIn(['cash', 'card_terminal'])
  method!: OfflineMethod;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  @MaxLength(300)
  @IsOptional()
  reason?: string;
}

@Controller('staff')
@UseGuards(StaffAuthGuard)
export class StaffController {
  constructor(
    private readonly orders: StaffOrdersService,
    private readonly sessions: StaffSessionsService,
  ) {}

  /** Kolejka „Do potwierdzenia" — kelner i wyżej. Kuchnia jej nie widzi. */
  @Get('orders/queue')
  @Roles('owner', 'manager', 'waiter')
  queue(@Staff() staff: StaffContext) {
    return this.orders.confirmationQueue(staff);
  }

  @Get('orders/kitchen')
  kitchen(@Staff() staff: StaffContext) {
    return this.orders.kitchenBoard(staff);
  }

  @Post('orders/:id/confirm')
  @Roles('owner', 'manager', 'waiter')
  confirm(@Staff() staff: StaffContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.confirm(staff, id);
  }

  @Post('orders/:id/reject')
  @Roles('owner', 'manager', 'waiter')
  reject(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.orders.reject(staff, id, dto.reason);
  }

  /** Zmiana statusu realizacji — kuchnia oznacza start i gotowość, kelner wydanie. */
  @Post('orders/:id/status')
  advance(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvanceDto,
  ) {
    return this.orders.advance(staff, id, dto.status);
  }

  @Post('orders/:id/cancel')
  cancel(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.orders.cancel(staff, id, dto.reason);
  }

  @Get('sessions')
  @Roles('owner', 'manager', 'waiter')
  openSessions(@Staff() staff: StaffContext) {
    return this.sessions.openSessions(staff);
  }

  @Post('sessions/:id/settle')
  @Roles('owner', 'manager', 'waiter')
  settle(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleDto,
  ) {
    return this.sessions.settle(staff, id, dto.method, dto.amountCents, dto.reason);
  }
}
