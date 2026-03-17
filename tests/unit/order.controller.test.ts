import type { Inventory, Order, OrderItem, OrderStatus, Product } from '@prisma/client';

import { OrderController } from '../../src/modules/order/order.controller';

type OrderResponse = Order & {
  items: Array<
    OrderItem & {
      product: Product & {
        inventory: Inventory | null;
      };
    }
  >;
};

function createOrderResponse(overrides: Partial<OrderResponse> = {}): OrderResponse {
  const product: Product = {
    id: '5a473c47-4b0c-4dab-9c57-7d66f813d442',
    sku: 'SKU-2',
    name: 'Mouse',
    description: null,
    priceCents: 2500,
    createdAt: new Date('2026-03-16T10:00:00.000Z'),
    updatedAt: new Date('2026-03-16T10:00:00.000Z'),
  };

  return {
    id: '1ad86a5b-c060-4d26-bf48-e67264395e73',
    createIdempotencyKey: 'place-123',
    cancelIdempotencyKey: null,
    status: 'PLACED' satisfies OrderStatus,
    totalCents: 5000,
    createdAt: new Date('2026-03-16T10:00:00.000Z'),
    updatedAt: new Date('2026-03-16T10:00:00.000Z'),
    cancelledAt: null,
    items: [
      {
        id: '3240fb1f-3fe7-4c3b-b387-c7e3fbeab80c',
        orderId: '1ad86a5b-c060-4d26-bf48-e67264395e73',
        productId: product.id,
        quantity: 2,
        priceCents: 2500,
        product: {
          ...product,
          inventory: {
            id: '0aa8806f-8b54-4679-8efe-b41f968d44e5',
            productId: product.id,
            quantity: 10,
            createdAt: new Date('2026-03-16T10:00:00.000Z'),
            updatedAt: new Date('2026-03-16T10:00:00.000Z'),
          },
        },
      },
    ],
    ...overrides,
  };
}

describe('OrderController', () => {
  it('passes a valid order request to the service', async () => {
    const order = createOrderResponse();
    const service = {
      placeOrder: vi.fn().mockResolvedValue(order),
      listOrders: vi.fn(),
      getOrderOrThrow: vi.fn(),
      cancelOrder: vi.fn(),
    };

    const controller = new OrderController(service as never);

    const input = {
      idempotencyKey: 'place-123',
      items: [
        {
          productId: '5a473c47-4b0c-4dab-9c57-7d66f813d442',
          quantity: 2,
        },
      ],
    };

    const result = await controller.placeOrder(input);

    expect(service.placeOrder).toHaveBeenCalledWith(input);
    expect(result).toEqual(order);
  });

  it('rejects cancel requests with invalid payloads before reaching the service', async () => {
    const service = {
      placeOrder: vi.fn(),
      listOrders: vi.fn(),
      getOrderOrThrow: vi.fn(),
      cancelOrder: vi.fn(),
    };

    const controller = new OrderController(service as never);

    expect(() =>
      controller.cancelOrder({
        orderId: 'bad-id',
        idempotencyKey: '',
      }),
    ).toThrow();

    expect(service.cancelOrder).not.toHaveBeenCalled();
  });
});
