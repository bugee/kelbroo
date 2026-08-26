import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * Zgłoszenie z formularza kontaktowego.
 *
 * Dwie sprawy w jednym formularzu, bo dla nadawcy to jedno pytanie: „chcę
 * porozmawiać". Rozróżnienie potrzebne jest nam, nie jemu — prezentacja trafia
 * do kalendarza, zwykłe pytanie do skrzynki.
 */
export class ContactDto {
  @IsIn(['pytanie', 'prezentacja'])
  purpose!: string;

  @IsString()
  @Length(2, 120, { message: 'Podaj imię i nazwisko.' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @IsEmail({}, { message: 'To nie wygląda na poprawny adres e-mail.' })
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** Kiedy najlepiej zadzwonić — wypełniane tylko przy prezentacji. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  preferredTime?: string;

  @IsString()
  @Length(10, 4000, { message: 'Napisz kilka słów — co najmniej dziesięć znaków.' })
  message!: string;

  /**
   * Pułapka na roboty.
   *
   * Pole niewidoczne dla człowieka, więc **wypełnione znaczy bot**. Zatrzymuje
   * automaty wypełniające wszystko, co znajdą w formularzu, i nie kosztuje
   * użytkownika ani jednego kliknięcia — inaczej niż CAPTCHA.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
