import { publicProcedure, router } from '../../trpc/trpc';
import { OrderController } from './order.controller';
import { cancelOrderSchema, getOrderSchema, placeOrderSchema } from './order.schema';

const controller = new OrderController();

export const orderRouter = router({
  list: publicProcedure.query(() => controller.listOrders()),
  getById: publicProcedure.input(getOrderSchema).query(({ input }) => controller.getOrder(input)),
  place: publicProcedure.input(placeOrderSchema).mutation(({ input }) => controller.placeOrder(input)),
  cancel: publicProcedure
    .input(cancelOrderSchema)
    .mutation(({ input }) => controller.cancelOrder(input)),
});
