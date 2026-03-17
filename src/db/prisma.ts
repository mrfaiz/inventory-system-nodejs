import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  // eslint-disable-next-line no-var
  var __inventoryPrisma__: PrismaClient | undefined;
}

export function getPrisma(): PrismaClient {
  if (!global.__inventoryPrisma__) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }

    const adapter = new PrismaPg({
      connectionString,
    });

    global.__inventoryPrisma__ = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    });
  }

  return global.__inventoryPrisma__;
}

export async function disconnectPrisma(): Promise<void> {
  if (global.__inventoryPrisma__) {
    await global.__inventoryPrisma__.$disconnect();
    global.__inventoryPrisma__ = undefined;
  }
}
