import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { EnvironmentVariables } from '../config/environment.js';
import type { Contract } from './contract.d.js';
import contractJson from './contract.json' with { type: 'json' };

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly client;
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.client = postgres<Contract>({
      contractJson,
      url: config.getOrThrow('DATABASE_URL', { infer: true }),
      poolOptions: { connectionTimeoutMillis: 3000, idleTimeoutMillis: 30000 },
    });
  }
  async ping(): Promise<void> {
    // Check both connectivity and application schema, without reading credentials.
    await this.client.orm.public.User.select('id').limit(1).all();
  }
  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
