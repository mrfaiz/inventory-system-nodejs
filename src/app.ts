import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';

import { uiRouter } from './modules/ui/ui.router';
import { createContext } from './trpc/context';
import { appRouter } from './trpc/root-router';

dotenv.config();

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/ui', uiRouter);

  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
