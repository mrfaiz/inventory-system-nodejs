import { InventoryController } from './inventory.controller';
import { adjustStockSchema, createProductSchema, getProductSchema } from './inventory.schema';
import { publicProcedure, router } from '../../trpc/trpc';

const controller = new InventoryController();

export const inventoryRouter = router({
  list: publicProcedure.query(() => controller.listProducts()),
  getById: publicProcedure.input(getProductSchema).query(({ input }) => controller.getProduct(input)),
  create: publicProcedure
    .input(createProductSchema)
    .mutation(({ input }) => controller.createProduct(input)),
  adjustStock: publicProcedure
    .input(adjustStockSchema)
    .mutation(({ input }) => controller.adjustStock(input)),
});
