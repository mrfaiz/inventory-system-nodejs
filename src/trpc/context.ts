import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';

import { getPrisma } from '../db/prisma';

export function createContext(_opts: CreateExpressContextOptions) {
  return { prisma: getPrisma() };
}

export type TrpcContext = inferAsyncReturnType<typeof createContext>;
