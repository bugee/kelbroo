import { Body, Controller, HttpCode, HttpStatus, Ip, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { ContactDto } from './dto';

/**
 * Formularz kontaktowy ze strony produktowej.
 *
 * Publiczny i bez tokenu — z natury, bo pisze do nas ktoś, kto nie ma jeszcze
 * konta. To zarazem jedyne wejście, które **wysyła pocztę na cudze polecenie**,
 * więc ma dwie niezależne bariery: limit zgłoszeń z jednego adresu IP i pułapkę
 * na roboty w treści formularza.
 */
@Controller('contact')
// Strażnik podpięty punktowo, nie globalnie: globalny limit dławiłby panel
// kuchni, który odpytuje często i wychodzi z jednego adresu całego lokalu.
// Bez tej linii dekorator `@Throttle` niżej nic by nie robił.
@UseGuards(ThrottlerGuard)
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  // Pięć zgłoszeń na godzinę z jednego adresu. Człowiek pisze raz, może dwa
  // razy po poprawce; setka w minutę to wyłącznie automat.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  async send(@Body() dto: ContactDto, @Ip() ip: string) {
    await this.contact.przyjmij(dto, ip);
    // Ta sama odpowiedź także wtedy, gdy zadziałała pułapka — patrz serwis.
    return { received: true };
  }
}
