import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { OrderStatus, SplitMode } from '@kelbroo/types';
import { Roles, Staff, StaffAuthGuard } from '../auth/staff.guard';
import type { StaffContext } from '../auth/auth.types';
import { StaffOrdersService } from './staff-orders.service';
import { StaffSessionsService, type OfflineMethod } from './staff-sessions.service';
import { StaffOrderingService } from './staff-ordering.service';
import { SplitService } from './split.service';
import { WaiterCallsService } from './waiter-calls.service';

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

class OrderedItemDto {
  @IsUUID()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  modifierIds?: string[];

  @IsString()
  @MaxLength(200)
  @IsOptional()
  note?: string;
}

class StaffOrderDto {
  @IsUUID()
  tableId!: string;

  /** Dla kogo jest zamówienie — podstawa późniejszego podziału rachunku. */
  @IsUUID()
  @IsOptional()
  forParticipantId?: string;

  @IsString()
  @MaxLength(300)
  @IsOptional()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderedItemDto)
  items!: OrderedItemDto[];
}

class AddItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderedItemDto)
  items!: OrderedItemDto[];
}

class QuantityDto {
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

class SplitGroupDto {
  @IsString()
  @MaxLength(60)
  @IsOptional()
  label?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  participantIds!: string[];
}

class SplitModeDto {
  // `per_item` należy do etapu 2 i celowo nie jest tu przyjmowane.
  @IsIn(['none', 'per_person', 'equal', 'groups'])
  splitMode!: Extract<SplitMode, 'none' | 'per_person' | 'equal' | 'groups'>;

  /** Wymagane wyłącznie dla trybu `groups` — pozostałe liczą się same. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitGroupDto)
  @IsOptional()
  groups?: SplitGroupDto[];
}

class GroupSettleDto {
  @IsIn(['cash', 'card_terminal'])
  method!: OfflineMethod;

  @IsString()
  @MaxLength(300)
  @IsOptional()
  reason?: string;
}

class RemoveItemDto {
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
    private readonly ordering: StaffOrderingService,
    private readonly split: SplitService,
    private readonly calls: WaiterCallsService,
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

  // --- zamawianie w imieniu gościa -----------------------------------------

  /** Stoliki z otwartą wizytą i jej uczestnikami — wybór celu zamówienia. */
  @Get('tables')
  @Roles('owner', 'manager', 'waiter')
  orderingTables(@Staff() staff: StaffContext) {
    return this.ordering.tables(staff);
  }

  /** Ta sama karta co u gościa. Kuchnia jej tędy nie potrzebuje. */
  @Get('menu')
  @Roles('owner', 'manager', 'waiter')
  orderingMenu(@Staff() staff: StaffContext) {
    return this.ordering.menuForOrdering(staff);
  }

  @Post('orders')
  @Roles('owner', 'manager', 'waiter')
  createOnBehalf(@Staff() staff: StaffContext, @Body() dto: StaffOrderDto) {
    return this.ordering.createOnBehalf(staff, dto);
  }

  @Post('orders/:id/items')
  @Roles('owner', 'manager', 'waiter')
  addItems(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddItemsDto,
  ) {
    return this.ordering.addItems(staff, id, dto);
  }

  @Patch('orders/:id/items/:itemId')
  @Roles('owner', 'manager', 'waiter')
  changeQuantity(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: QuantityDto,
  ) {
    return this.ordering.changeQuantity(staff, id, itemId, dto.quantity);
  }

  @Delete('orders/:id/items/:itemId')
  @Roles('owner', 'manager', 'waiter')
  removeItem(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: RemoveItemDto,
  ) {
    return this.ordering.removeItem(staff, id, itemId, dto.reason);
  }

  /** Kto co zmienił i kiedy — append-only źródło prawdy. */
  @Get('orders/:id/history')
  @Roles('owner', 'manager', 'waiter')
  history(@Staff() staff: StaffContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordering.history(staff, id);
  }

  // --- podział rachunku ----------------------------------------------------

  @Get('sessions/:id/split')
  @Roles('owner', 'manager', 'waiter')
  splitPlan(@Staff() staff: StaffContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.split.get(staff, id);
  }

  @Patch('sessions/:id/split')
  @Roles('owner', 'manager', 'waiter')
  setSplit(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SplitModeDto,
  ) {
    return this.split.setMode(staff, id, dto);
  }

  // --- wezwania kelnera ----------------------------------------------------

  @Get('calls')
  @Roles('owner', 'manager', 'waiter')
  openCalls(@Staff() staff: StaffContext) {
    return this.calls.open(staff);
  }

  /** „Idę" — reszta zmiany widzi, że ktoś już się tym zajął. */
  @Post('calls/:id/acknowledge')
  @Roles('owner', 'manager', 'waiter')
  acknowledgeCall(@Staff() staff: StaffContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.calls.acknowledge(staff, id);
  }

  @Post('calls/:id/resolve')
  @Roles('owner', 'manager', 'waiter')
  resolveCall(@Staff() staff: StaffContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.calls.resolve(staff, id);
  }

  @Post('sessions/:id/groups/:groupId/settle')
  @Roles('owner', 'manager', 'waiter')
  settleGroup(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: GroupSettleDto,
  ) {
    return this.split.settleGroup(staff, id, groupId, dto.method, dto.reason);
  }
}
