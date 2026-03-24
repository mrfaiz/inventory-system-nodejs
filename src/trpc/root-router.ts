import { aiSearchRouter } from '../modules/ai-search/ai-search.router';
import { inventoryRouter } from '../modules/inventory/inventory.router';
import { orderRouter } from '../modules/order/order.router';
import { router } from './trpc';

export const appRouter = router({
  aiSearch: aiSearchRouter,
  inventory: inventoryRouter,
  order: orderRouter,
});

export type AppRouter = typeof appRouter;
