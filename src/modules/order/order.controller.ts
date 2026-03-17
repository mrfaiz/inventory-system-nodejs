import { OrderService } from './order.service';
import { cancelOrderSchema, getOrderSchema, placeOrderSchema } from './order.schema';

export class OrderController {
  constructor(private readonly service = new OrderService()) {}

  placeOrder(input: unknown) {
    return this.service.placeOrder(placeOrderSchema.parse(input));
  }

  listOrders() {
    return this.service.listOrders();
  }

  async getOrder(input: unknown) {
    const { orderId } = getOrderSchema.parse(input);
    return this.service.getOrderOrThrow(orderId);
  }

  cancelOrder(input: unknown) {
    return this.service.cancelOrder(cancelOrderSchema.parse(input));
  }
}
