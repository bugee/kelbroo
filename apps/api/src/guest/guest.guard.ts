import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { GuestSessionService, type ResolvedGuest } from './guest-session.service';

export interface GuestRequest extends Request {
  guest?: ResolvedGuest;
}

/** Token gościa: nagłówek dedykowany albo Bearer, zależnie od klienta. */
export function readGuestToken(request: Request): string | null {
  const header = request.header('x-guest-token');
  if (header) return header;

  const authorization = request.header('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return null;
}

@Injectable()
export class GuestAuthGuard implements CanActivate {
  constructor(private readonly guests: GuestSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    const token = readGuestToken(request);
    if (!token) {
      throw new UnauthorizedException('Brak sesji gościa — zeskanuj kod QR.');
    }

    const guest = await this.guests.resolve(token);
    if (!guest) {
      throw new UnauthorizedException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
    }

    request.guest = guest;
    return true;
  }
}

export const Guest = createParamDecorator(
  (_: unknown, context: ExecutionContext): ResolvedGuest => {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    if (!request.guest) {
      throw new UnauthorizedException('Brak kontekstu gościa.');
    }
    return request.guest;
  },
);
