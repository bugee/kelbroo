import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { INestApplicationContext } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';

/**
 * Fan-out zdarzeń między instancjami backendu.
 *
 * Bez tego kelner połączony z instancją A nie zobaczyłby zamówienia
 * potwierdzonego na instancji B. Przy jednej instancji adapter jest zbędny,
 * ale wprowadzenie go później oznaczałoby debugowanie „znikających" zamówień
 * dokładnie wtedy, gdy ruch wymusi skalowanie.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connect(): Promise<void> {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const pubClient = new Redis(url);
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
        credentials: true,
      },
    }) as { adapter: (factory: unknown) => void };

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
