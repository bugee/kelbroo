import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Logger,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Roles, Staff, StaffAuthGuard } from '../auth/staff.guard';
import type { StaffContext } from '../auth/auth.types';
import { BillingService } from './billing.service';
import { PaymentSignatureError } from './payment-provider';
import { CheckoutDto, assertNip } from './dto';

/**
 * Zakup abonamentu.
 *
 * Zastrzeżone dla właściciela: to on podpisuje umowę i on płaci. Manager
 * prowadzi lokal, ale nie zaciąga zobowiązań w imieniu firmy.
 */
@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @UseGuards(StaffAuthGuard)
  @Roles('owner', 'manager')
  plans() {
    return this.billing.katalog();
  }

  @Get('invoice')
  @UseGuards(StaffAuthGuard)
  @Roles('owner')
  invoice(@Staff() staff: StaffContext) {
    return this.billing.invoiceDetails(staff);
  }

  @Get('orders')
  @UseGuards(StaffAuthGuard)
  @Roles('owner')
  orders(@Staff() staff: StaffContext) {
    return this.billing.orders(staff);
  }

  @Get('orders/:externalId')
  @UseGuards(StaffAuthGuard)
  @Roles('owner')
  orderStatus(@Staff() staff: StaffContext, @Param('externalId') externalId: string) {
    return this.billing.orderStatus(staff, externalId);
  }

  @Post('checkout')
  @UseGuards(StaffAuthGuard)
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  checkout(@Staff() staff: StaffContext, @Body() dto: CheckoutDto, @Ip() ip: string) {
    assertNip(dto.nip);
    return this.billing.checkout(staff, dto, ip);
  }

  /**
   * Powiadomienie od operatora płatności.
   *
   * Bez strażnika i bez tokenu — operator nie ma sesji. Uwierzytelnia je
   * **wyłącznie podpis** liczony z surowej treści i drugiego klucza, dlatego
   * sięgamy po `rawBody`, a nie po sparsowany obiekt.
   *
   * Odpowiadamy 200 także wtedy, gdy nie mamy nic do zrobienia: operator ponawia
   * powiadomienie do skutku, a powtórki są tu normalnym stanem, nie awarią.
   * Zły podpis to jedyny przypadek, w którym odmawiamy wprost — i jedyny, który
   * naprawdę oznacza cudzy ruch pod naszym adresem.
   */
  @Post('notify')
  @HttpCode(HttpStatus.OK)
  async notify(@Req() request: RawBodyRequest<Request>) {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Brak treści powiadomienia.');
    }

    try {
      await this.billing.handleNotification(rawBody, request.get('openpayu-signature'));
    } catch (przyczyna) {
      if (przyczyna instanceof PaymentSignatureError) {
        /**
         * Zapisujemy **przed** odesłaniem 401 i to jest tu cała rzecz.
         *
         * Odrzucony podpis znaczy zwykle nie atak, tylko zły drugi klucz
         * w konfiguracji — a wtedy **żadna płatność się nie zaksięguje**.
         * Bez tego wiersza wygląda to z naszej strony identycznie jak brak
         * powiadomienia: cisza w logu i abonament, który się nie przedłużył.
         */
        this.logger.warn(`Odrzucone powiadomienie PayU: ${przyczyna.message}`);
        throw new UnauthorizedException('Podpis powiadomienia się nie zgadza.');
      }
      throw przyczyna;
    }

    return { received: true };
  }
}
