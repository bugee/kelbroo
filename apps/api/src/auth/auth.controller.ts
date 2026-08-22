import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
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
}
