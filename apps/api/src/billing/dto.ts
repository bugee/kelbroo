import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, Matches, MaxLength } from 'class-validator';
import { isValidNip, normalizeNip } from '@kelbroo/types';

/**
 * Zakup okresu abonamentowego wraz z danymi nabywcy.
 *
 * Dane do faktury są tu, a nie w rejestracji, świadomie: formularz, którym
 * wchodzi się na bezpłatny okres próbny, ma być krótki. Adres jest potrzebny
 * dopiero wtedy, gdy pojawia się sprzedaż — i wtedy jest obowiązkowy, bo
 * faktura VAT bez adresu nabywcy nie jest fakturą.
 */
export class CheckoutDto {
  @IsIn(['starter', 'pro'])
  plan!: string;

  @IsIn(['month', 'year'])
  period!: string;

  /**
   * NIP bywa już znany z rejestracji, ale klient musi móc go poprawić przed
   * pierwszą fakturą — po jej wystawieniu poprawka kosztuje korektę.
   */
  @Transform(({ value }) => (typeof value === 'string' ? normalizeNip(value) : value))
  @IsString()
  @Length(10, 10, { message: 'NIP ma 10 cyfr.' })
  @Matches(/^\d{10}$/, { message: 'NIP ma 10 cyfr.' })
  nip!: string;

  @IsString()
  @Length(3, 200, { message: 'Podaj ulicę i numer.' })
  address!: string;

  @Matches(/^\d{2}-\d{3}$/, { message: 'Kod pocztowy w formacie 00-000.' })
  postalCode!: string;

  @IsString()
  @Length(2, 100, { message: 'Podaj miejscowość.' })
  city!: string;

  /** Adres, na który pójdzie potwierdzenie i faktura. */
  @IsEmail({}, { message: 'Podaj poprawny adres e-mail do faktur.' })
  @MaxLength(200)
  billingEmail!: string;
}

/**
 * Suma kontrolna NIP-u. Sprawdzana osobno, a nie dekoratorem, bo komunikat ma
 * odróżniać „to nie jest NIP" od „pomyliłeś cyfrę" — jedno znaczy zły format,
 * drugie literówkę w poprawnie wyglądającym numerze.
 */
export function assertNip(nip: string): void {
  if (!isValidNip(nip)) {
    throw new BadRequestException('NIP jest niepoprawny — sprawdź cyfry.');
  }
}
