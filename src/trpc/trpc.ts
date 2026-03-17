import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';

import type { TrpcContext } from './context';

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

type TrpcErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INTERNAL_SERVER_ERROR' | 'CONFLICT';

export const createTrpcError = (message: string, code: TrpcErrorCode) =>
  new TRPCError({ code, message });

export const router = t.router;
export const publicProcedure = t.procedure;
