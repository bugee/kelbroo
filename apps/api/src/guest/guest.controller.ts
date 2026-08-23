import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { TableAccessService } from './table-access.service';
import type { SplitMode } from '@kelbroo/types';
import { Guest, GuestAuthGuard } from './guest.guard';
import type { ResolvedGuest } from './guest-session.service';
import { GuestSignalsService, type CallReason } from './guest-signals.service';

class CallDto {
  @IsIn(['help', 'water', 'other'])
  reason!: Exclude<CallReason, 'bill'>;
}

class AccessDecisionDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
}

class BillRequestDto {
  /**
   * `groups` celowo poza listą — kto z kim płaci, ustala kelner przy stoliku.
   * `per_item` należy do etapu 2.
   */
  @IsIn(['none', 'per_person', 'equal'])
  splitMode!: Extract<SplitMode, 'none' | 'per_person' | 'equal'>;
}

/**
 * Prośba o otwarcie stolika stoi poza strażnikiem sesji: gość przy zablokowanym
 * stoliku żadnej sesji nie ma i mieć nie może — o to właśnie prosi.
 */
@Controller('guest')
export class GuestOpenTableController {
  constructor(private readonly signals: GuestSignalsService) {}

  @Post('tables/:qrToken/open-request')
  requestOpen(@Param('qrToken') qrToken: string) {
    return this.signals.requestTableOpen(qrToken);
  }
}

@Controller('guest')
@UseGuards(GuestAuthGuard)
export class GuestController {
  constructor(
    private readonly signals: GuestSignalsService,
    private readonly access: TableAccessService,
  ) {}

  /** Kto czeka na wpuszczenie. Pusta lista dla każdego poza hostem. */
  @Get('pending-guests')
  pendingGuests(@Guest() guest: ResolvedGuest) {
    return this.access.pendingForGuest(guest.organizationId, guest.guestSessionId);
  }

  @Post('pending-guests/:participantId')
  decide(
    @Guest() guest: ResolvedGuest,
    @Param('participantId') participantId: string,
    @Body() dto: AccessDecisionDto,
  ) {
    return this.access.decideAsHost(
      guest.organizationId,
      guest.guestSessionId,
      participantId,
      dto.decision,
    );
  }

  /** Stan wezwań tego stolika — przycisk gościa czyta go, zamiast zgadywać. */
  @Get('calls')
  activeCalls(@Guest() guest: ResolvedGuest) {
    return this.signals.activeCalls(guest.organizationId, guest.guestSessionId);
  }

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
