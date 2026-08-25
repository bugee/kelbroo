import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { PlatformAuthService, type PlatformAdminContext } from './platform-auth.service';

/** Strażnik zaplecza. Przepuszcza wyłącznie tokeny podpisane sekretem platformy. */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private readonly auth: PlatformAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { admin?: PlatformAdminContext }>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Brak tokenu.');
    }

    request.admin = await this.auth.verify(authorization.slice(7).trim());
    return true;
  }
}

export const Admin = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ admin: PlatformAdminContext }>();
  return request.admin;
});
