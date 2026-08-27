import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
import { Type } from 'class-transformer';
import { TableAccessService } from './table-access.service';
import type { SplitMode } from '@kelbroo/types';
import { Guest, GuestAuthGuard } from './guest.guard';
import type { ResolvedGuest } from './guest-session.service';
import { GuestSignalsService, type CallReason } from './guest-signals.service';
import { GuestNameService } from './guest-name.service';
import { GuestResumeService } from './guest-resume.service';
import { ReviewsService } from './reviews.service';

class ResumeDto {
  @IsString()
  @MaxLength(200)
  qrToken!: string;

  @IsString()
  @MaxLength(400)
  guestToken!: string;
}

class OcenaDaniaDto {
  @IsUUID()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

class OcenaWizytyDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  /** Do kogo gość mówi. `dish` i `manager` nie są wyborem gościa. */
  @IsIn(['kitchen', 'service'])
  target!: 'kitchen' | 'service';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

class ReviewDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OcenaDaniaDto)
  dishes?: OcenaDaniaDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OcenaWizytyDto)
  visit?: OcenaWizytyDto;
}

class NameDto {
  /**
   * Górna granica jest tu luźniejsza niż w serwisie: przycinanie białych znaków
   * dzieje się dopiero tam, więc odrzucanie po długości surowego tekstu
   * wywalałoby nazwę, która po oczyszczeniu mieści się bez problemu.
   */
  @IsString()
  @MaxLength(120)
  displayName!: string;
}

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

  /** Czym goście zamierzają zapłacić — kelner ma wiedzieć, czy brać terminal. */
  @IsIn(['cash', 'card', 'mixed'])
  payment!: 'cash' | 'card' | 'mixed';

  /** Samą zapowiedź faktury; dane firmy kelner bierze przy stoliku. */
  @IsBoolean()
  invoiceRequested!: boolean;
}

/**
 * Prośba o otwarcie stolika stoi poza strażnikiem sesji: gość przy zablokowanym
 * stoliku żadnej sesji nie ma i mieć nie może — o to właśnie prosi.
 */
@Controller('guest')
export class GuestOpenTableController {
  constructor(
    private readonly signals: GuestSignalsService,
    private readonly resume: GuestResumeService,
  ) {}

  /**
   * Czy gość może wrócić do swojej wizyty bez skanowania.
   *
   * Poza strażnikiem sesji, bo pyta właśnie o to, czy ta sesja jeszcze jest coś
   * warta — strażnik odpowiedziałby błędem 401 tam, gdzie potrzebne jest
   * zwykłe „nie".
   */
  @Post('resume')
  @HttpCode(HttpStatus.OK)
  async canResume(@Body() dto: ResumeDto) {
    return { resumable: await this.resume.canResume(dto.qrToken, dto.guestToken) };
  }

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
    private readonly names: GuestNameService,
    private readonly reviews: ReviewsService,
  ) {}

  /** Co gość może ocenić: jego wydane dania i to, czy już oceniał. */
  @Get('reviewable')
  reviewable(@Guest() guest: ResolvedGuest) {
    return this.reviews.reviewable(guest.organizationId, guest.guestSessionId);
  }

  @Post('reviews')
  @HttpCode(HttpStatus.OK)
  submitReview(@Guest() guest: ResolvedGuest, @Body() dto: ReviewDto) {
    return this.reviews.submit(guest.organizationId, guest.guestSessionId, dto);
  }

  /**
   * Własna nazwa zamiast wylosowanej. Działa **raz na wizytę** — nick jest
   * podpisem pod pozycjami rachunku i nie ma się zmieniać w jej trakcie.
   */
  @Post('me/name')
  setName(@Guest() guest: ResolvedGuest, @Body() dto: NameDto) {
    return this.names.setName(guest.organizationId, guest.guestSessionId, dto.displayName);
  }

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

  /** Wycofanie wezwania. Odmawia, gdy kelner już je przyjął — bo już idzie. */
  @Post('calls/cancel')
  cancelCall(@Guest() guest: ResolvedGuest, @Body() dto: CallDto) {
    return this.signals.cancelCall(guest.organizationId, guest.guestSessionId, dto.reason);
  }

  /** Prośba o rachunek z wyborem podziału. Zamyka go i tak wyłącznie kelner. */
  @Post('bill-request')
  requestBill(@Guest() guest: ResolvedGuest, @Body() dto: BillRequestDto) {
    return this.signals.requestBill(
      guest.organizationId,
      guest.guestSessionId,
      dto.splitMode,
      dto.payment,
      dto.invoiceRequested,
    );
  }
}
