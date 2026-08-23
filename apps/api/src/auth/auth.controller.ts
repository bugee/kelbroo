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
import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { AuthService, type LoginResult } from './auth.service';
import { Staff, StaffAuthGuard } from './staff.guard';
import type { StaffContext } from './auth.types';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
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
  constructor(private readonly auth: AuthService) {}

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
