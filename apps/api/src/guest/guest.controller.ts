import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { SplitMode } from '@kelbroo/types';
import { Guest, GuestAuthGuard } from './guest.guard';
import type { ResolvedGuest } from './guest-session.service';
import { GuestSignalsService, type CallReason } from './guest-signals.service';

class CallDto {
  @IsIn(['help', 'water', 'other'])
  reason!: Exclude<CallReason, 'bill'>;
}

class BillRequestDto {
  /**
   * `groups` celowo poza listą — kto z kim płaci, ustala kelner przy stoliku.
   * `per_item` należy do etapu 2.
   */
  @IsIn(['none', 'per_person', 'equal'])
  splitMode!: Extract<SplitMode, 'none' | 'per_person' | 'equal'>;
}

@Controller('guest')
@UseGuards(GuestAuthGuard)
export class GuestController {
  constructor(private readonly signals: GuestSignalsService) {}

  @Post('calls')
  call(@Guest() guest: ResolvedGuest, @Body() dto: CallDto) {
    return this.signals.call(guest.organizationId, guest.guestSessionId, dto.reason);
  }

  /** Prośba o rachunek z wyborem podziału. Zamyka go i tak wyłącznie kelner. */
  @Post('bill-request')
  requestBill(@Guest() guest: ResolvedGuest, @Body() dto: BillRequestDto) {
    return this.signals.requestBill(guest.organizationId, guest.guestSessionId, dto.splitMode);
  }
}
