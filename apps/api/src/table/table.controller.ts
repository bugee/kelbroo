import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { TableService, type TableEntry } from './table.service';

/**
 * Wejście po skanie kodu QR — jedyny publiczny endpoint ścieżki gościa.
 * Zwraca konfigurację lokalu, menu w wykrytym języku i świeży token sesji.
 */
@Controller('t')
export class TableController {
  constructor(private readonly tables: TableService) {}

  @Get(':qrToken')
  async enter(
    @Param('qrToken') qrToken: string,
    @Query('lang') lang?: string,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-guest-token') existingGuestToken?: string,
  ): Promise<TableEntry> {
    return this.tables.enter(qrToken, {
      requestedLocale: lang,
      acceptLanguage,
      existingGuestToken,
    });
  }
}
