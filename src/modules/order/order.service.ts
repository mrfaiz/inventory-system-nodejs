import type { PrismaClient } from '@prisma/client';

import { getPrisma } from '../../db/prisma';
import { InventoryRepository } from '../inventory/inventory.repository';
import type { CancelOrderInput, PlaceOrderInput } from './order.schema';
import { OrderRepository, type OrderWithItems } from './order.repository';

export class OrderService {
  constructor(private readonly db: PrismaClient = getPrisma()) {}

  listOrders(): Promise<OrderWithItems[]> {
    return new OrderRepository(this.db).listOrders();
  }

  async getOrderOrThrow(orderId: string): Promise<OrderWithItems> {
    const order = await new OrderRepository(this.db).findById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  async placeOrder(input: PlaceOrderInput): Promise<OrderWithItems> {
    return this.db.$transaction(async (tx) => {
      const orderRepository = new OrderRepository(tx);
      const inventoryRepository = new InventoryRepository(tx);

      const existingOrder = await orderRepository.findByCreateIdempotencyKey(input.idempotencyKey);
      if (existingOrder) {
        return existingOrder;
      }

      const uniqueProductIds = [...new Set(input.items.map((item) => item.productId))];
      const products = await inventoryRepository.findManyByIds(uniqueProductIds);
      const productMap = new Map(products.map((product) => [product.id, product]));

      if (products.length !== uniqueProductIds.length) {
        throw new Error('One or more products do not exist');
      }

      const orderItems = input.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        return {
          productId: item.productId,
          quantity: item.quantity,
          priceCents: product.priceCents,
        };
      });

      for (const item of orderItems) {
        const updatedProduct = await inventoryRepository.adjustStock({
          productId: item.productId,
          delta: -item.quantity,
        });

        if (!updatedProduct) {
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }
      }

      const totalCents = orderItems.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);

      return orderRepository.createOrder({
        createIdempotencyKey: input.idempotencyKey,
        totalCents,
        items: orderItems,
      });
    });
  }

  async cancelOrder(input: CancelOrderInput): Promise<OrderWithItems> {
    return this.db.$transaction(async (tx) => {
      const orderRepository = new OrderRepository(tx);
      const inventoryRepository = new InventoryRepository(tx);

      const existingCancel = await orderRepository.findByCancelIdempotencyKey(input.idempotencyKey);
      if (existingCancel) {
        return existingCancel;
      }

      const order = await orderRepository.findById(input.orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === 'CANCELLED') {
        return order;
      }

      for (const item of order.items) {
        const updatedProduct = await inventoryRepository.adjustStock({
          productId: item.productId,
          delta: item.quantity,
        });

        if (!updatedProduct) {
          throw new Error(`Unable to restore stock for product ${item.productId}`);
        }
      }

      await orderRepository.cancelOrder(order.id, input.idempotencyKey);
      const cancelledOrder = await orderRepository.findById(order.id);

      if (!cancelledOrder) {
        throw new Error('Order not found after cancellation');
      }

      return cancelledOrder;
    });
  }
}
