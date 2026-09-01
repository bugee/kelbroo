import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import type { SubscriptionPlan } from '@prisma/client';
import { PlatformClientService } from './platform-client.service';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformClientsService } from './platform-clients.service';
import { Admin, PlatformAuthGuard } from './platform.guard';
import type { PlatformAdminContext } from './platform-auth.service';

/** Powód jest wymagany przy każdej operacji — bez niego decyzji nie da się odtworzyć. */
class PowodDto {
  @IsString()
  @Length(3, 300)
  reason!: string;
}

class ExtendDto extends PowodDto {
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;
}

class PlanDto extends PowodDto {
  @IsIn(['menu', 'starter', 'pro', 'enterprise'])
  plan!: SubscriptionPlan;
}

/** Podniesienie limitu ponad plan. Pola opcjonalne — zmienia się to, co podane. */
class LimitsDto extends PowodDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  tableLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  languageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  staffLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  menuItemLimit?: number;
}

/** Włączenie funkcji poza planem — dziś jedna, ale lista z założenia urośnie. */
class FeatureDto extends PowodDto {
  @IsIn(['menuPhotos', 'reviews', 'reportsExport'])
  feature!: 'menuPhotos' | 'reviews' | 'reportsExport';

  @IsBoolean()
  enabled!: boolean;
}

class VerifyCodeDto {
  @IsUUID()
  challengeId!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

class PlatformLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

/**
 * Zaplecze kelbroo (System 4).
 *
 * Osobna ścieżka `/platform`, osobne konta i osobny sekret tokenu — token
 * pracownika restauracji nie przejdzie tu walidacji, a token stąd nie otworzy
 * panelu lokalu.
 */
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly auth: PlatformAuthService,
    private readonly clients: PlatformClientsService,
    private readonly client: PlatformClientService,
  ) {}

  /**
   * Pierwszy krok logowania. **Nie zwraca tokenu** — odsyła uchwyt, a kod idzie
   * na adres administratora.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: PlatformLoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  /** Drugi krok: kod ze skrzynki. Dopiero on wydaje token. */
  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.auth.verifyCode(dto.challengeId, dto.code);
  }

  @Get('me')
  @UseGuards(PlatformAuthGuard)
  me(@Admin() admin: PlatformAdminContext): PlatformAdminContext {
    return admin;
  }

  /** Lista klientów: abonament, okres próbny, lokale, aktywność. */
  @Get('clients')
  @UseGuards(PlatformAuthGuard)
  listClients() {
    return this.clients.list();
  }

  /** Wszystko o jednym kliencie: lokale, personel, zgody, historia operacji. */
  @Get('clients/:id')
  @UseGuards(PlatformAuthGuard)
  clientDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.client.detail(id);
  }

  @Post('clients/:id/extend')
  @UseGuards(PlatformAuthGuard)
  @HttpCode(HttpStatus.OK)
  extend(
    @Admin() admin: PlatformAdminContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendDto,
  ) {
    return this.client.extend(admin, id, dto.days, dto.reason);
  }

  @Post('clients/:id/plan')
  @UseGuards(PlatformAuthGuard)
  @HttpCode(HttpStatus.OK)
  changePlan(
    @Admin() admin: PlatformAdminContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlanDto,
  ) {
    return this.client.changePlan(admin, id, dto.plan, dto.reason);
  }

  @Post('clients/:id/limits')
  @UseGuards(PlatformAuthGuard)
  @HttpCode(HttpStatus.OK)
  setLimits(
    @Admin() admin: PlatformAdminContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LimitsDto,
  ) {
    const { reason, ...limity } = dto;
    return this.client.setLimits(admin, id, limity, reason);
  }

  @Post('clients/:id/feature')
  @UseGuards(PlatformAuthGuard)
  @HttpCode(HttpStatus.OK)
  setFeature(
    @Admin() admin: PlatformAdminContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FeatureDto,
  ) {
    return this.client.setFeature(admin, id, dto.feature, dto.enabled, dto.reason);
  }

  @Post('clients/:id/block')
  @UseGuards(PlatformAuthGuard)
  @HttpCode(HttpStatus.OK)
  block(
    @Admin() admin: PlatformAdminContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PowodDto,
  ) {
    return this.client.block(admin, id, dto.reason);
  }

  @Post('clients/:id/unblock')
  @UseGuards(PlatformAuthGuard)
  @HttpCode(HttpStatus.OK)
  unblock(
    @Admin() admin: PlatformAdminContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PowodDto,
  ) {
    return this.client.unblock(admin, id, dto.reason);
  }
}
