import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  Equals,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthService, type LoginResult } from './auth.service';
import { RegistrationService } from './registration.service';
import { Staff, StaffAuthGuard } from './staff.guard';
import type { StaffContext } from './auth.types';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

/**
 * Rejestracja restauracji.
 *
 * Zgody są `Equals(true)`, nie `IsBoolean()` — pole odznaczone ma odrzucić
 * żądanie, a nie zapisać się jako „nie zgadza się". Wersje dokumentów przychodzą
 * z formularza, żeby dało się później udowodnić, na co dokładnie ktoś przystał.
 */
class RegisterDto {
  @IsString()
  @Length(2, 120)
  restaurantName!: string;

  @IsString()
  @Length(2, 120)
  ownerName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  /** Usługa jest wyłącznie B2B, a faktury VAT wymagają numeru. */
  @IsString()
  @Length(10, 20)
  nip!: string;

  @Equals(true)
  acceptTerms!: boolean;

  @Equals(true)
  acceptPrivacy!: boolean;

  @IsString()
  @Length(1, 40)
  termsVersion!: string;

  @IsString()
  @Length(1, 40)
  privacyVersion!: string;
}

class VerifyDto {
  @IsString()
  @Length(10, 200)
  token!: string;
}

class ResendDto {
  @IsEmail()
  email!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

class ProfileDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @Length(1, 120)
  @IsOptional()
  name?: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  // bcrypt bierze pod uwagę wyłącznie pierwsze 72 bajty i resztę ucina po cichu.
  // Bez tego limitu dłuższe hasło dawałoby złudzenie siły, a przy logowaniu
  // liczyłby się i tak sam prefiks.
  @MaxLength(72)
  newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly registration: RegistrationService,
  ) {}

  /**
   * Założenie konta restauracji. Zbudowane, ale zamknięte do czasu, aż będą
   * regulamin i polityka prywatności — patrz `RegistrationService.enabled`.
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.registration.register({
      restaurantName: dto.restaurantName,
      ownerName: dto.ownerName,
      email: dto.email,
      password: dto.password,
      nip: dto.nip,
      termsVersion: dto.termsVersion,
      privacyVersion: dto.privacyVersion,
    });
  }

  /** Kliknięcie w odnośnik z wiadomości. Otwiera drogę do panelu. */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyDto) {
    return this.registration.verifyEmail(dto.token);
  }

  /**
   * Ponowna wysyłka potwierdzenia. Odpowiada tak samo niezależnie od tego, czy
   * konto istnieje — inaczej formularz stałby się sposobem sprawdzania adresów.
   */
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendDto) {
    return this.registration.resendVerification(dto.email);
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(StaffAuthGuard)
  me(@Staff() staff: StaffContext): StaffContext {
    return staff;
  }

  @Patch('profile')
  @UseGuards(StaffAuthGuard)
  updateProfile(@Staff() staff: StaffContext, @Body() dto: ProfileDto) {
    return this.auth.updateProfile(staff.staffId, dto);
  }

  @Post('password')
  @UseGuards(StaffAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Staff() staff: StaffContext,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(staff.staffId, dto.currentPassword, dto.newPassword);
  }
}
