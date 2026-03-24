import { publicProcedure, router } from '../../trpc/trpc';
import { AiSearchController } from './ai-search.controller';
import { aiSearchSchema } from './ai-search.schema';

const controller = new AiSearchController();

export const aiSearchRouter = router({
  searchProducts: publicProcedure.input(aiSearchSchema).mutation(({ input }) => controller.searchProducts(input)),
});
