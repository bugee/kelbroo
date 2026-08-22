import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { StaffRole } from '@kelbroo/types';
import { AuthService } from './auth.service';
import type { StaffContext } from './auth.types';

export interface StaffRequest extends Request {
  staff?: StaffContext;
}

export const ROLES_KEY = 'kelbroo:roles';

/** Bez dekoratora endpoint jest dostępny dla każdej zalogowanej roli. */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const authorization = request.header('authorization');

    if (!authorization?.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Brak tokenu dostępu.');
    }

    const staff = await this.auth.verifyAccessToken(authorization.slice(7).trim());
    request.staff = staff;

    const required = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required && required.length > 0 && !required.includes(staff.role)) {
      throw new ForbiddenException('Twoja rola nie ma dostępu do tej operacji.');
    }

    return true;
  }
}

export const Staff = createParamDecorator((_: unknown, context: ExecutionContext): StaffContext => {
  const request = context.switchToHttp().getRequest<StaffRequest>();
  if (!request.staff) {
    throw new UnauthorizedException('Brak kontekstu pracownika.');
  }
  return request.staff;
});
