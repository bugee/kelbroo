import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformClientsService } from './platform-clients.service';
import { Admin, PlatformAuthGuard } from './platform.guard';
import type { PlatformAdminContext } from './platform-auth.service';

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
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: PlatformLoginDto) {
    return this.auth.login(dto.email, dto.password);
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
}
