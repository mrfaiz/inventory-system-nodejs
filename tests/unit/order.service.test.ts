import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const inventoryRepositoryMock = {
    findManyByIds: vi.fn(),
    adjustStock: vi.fn(),
  };

  const orderRepositoryMock = {
    findByCreateIdempotencyKey: vi.fn(),
    findByCancelIdempotencyKey: vi.fn(),
    findById: vi.fn(),
    listOrders: vi.fn(),
    createOrder: vi.fn(),
    cancelOrder: vi.fn(),
  };

  const transactionMock = {};

  const prismaMock = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(transactionMock)),
  };

  return {
    inventoryRepositoryMock,
    orderRepositoryMock,
    transactionMock,
    prismaMock,
  };
});

vi.mock('../../src/db/prisma', () => ({
  getPrisma: vi.fn(() => state.prismaMock),
}));

vi.mock('../../src/modules/inventory/inventory.repository', () => ({
  InventoryRepository: class {
    constructor() {
      return state.inventoryRepositoryMock;
    }
  },
}));

vi.mock('../../src/modules/order/order.repository', () => ({
  OrderRepository: class {
    constructor() {
      return state.orderRepositoryMock;
    }
  },
}));

import { OrderService } from '../../src/modules/order/order.service';

function createProduct(productId: string, quantity = 10, priceCents = 2500) {
  return {
    id: productId,
    sku: `SKU-${productId.slice(0, 4)}`,
    name: `Product ${productId.slice(0, 4)}`,
    description: null,
    priceCents,
    createdAt: new Date('2026-03-16T10:00:00.000Z'),
    updatedAt: new Date('2026-03-16T10:00:00.000Z'),
    inventory: {
      id: `inv-${productId}`,
      productId,
      quantity,
      createdAt: new Date('2026-03-16T10:00:00.000Z'),
      updatedAt: new Date('2026-03-16T10:00:00.000Z'),
    },
  };
}

function createOrder(overrides: Record<string, unknown> = {}) {
  const product = createProduct('5a473c47-4b0c-4dab-9c57-7d66f813d442');

  return {
    id: '1ad86a5b-c060-4d26-bf48-e67264395e73',
    createIdempotencyKey: 'place-123',
    cancelIdempotencyKey: null,
    status: 'PLACED',
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
        product,
      },
    ],
    ...overrides,
  };
}

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing order when the place-order idempotency key already exists', async () => {
    const existingOrder = createOrder();
    state.orderRepositoryMock.findByCreateIdempotencyKey.mockResolvedValue(existingOrder);

    const service = new OrderService();

    const result = await service.placeOrder({
      idempotencyKey: 'place-123',
      items: [
        {
          productId: '5a473c47-4b0c-4dab-9c57-7d66f813d442',
          quantity: 2,
        },
      ],
    });

    expect(result).toEqual(existingOrder);
    expect(state.inventoryRepositoryMock.findManyByIds).not.toHaveBeenCalled();
    expect(state.orderRepositoryMock.createOrder).not.toHaveBeenCalled();
  });

  it('creates an order and decrements stock when inventory is available', async () => {
    const product = createProduct('5a473c47-4b0c-4dab-9c57-7d66f813d442', 10, 2500);
    const createdOrder = createOrder();

    state.orderRepositoryMock.findByCreateIdempotencyKey.mockResolvedValue(null);
    state.inventoryRepositoryMock.findManyByIds.mockResolvedValue([product]);
    state.inventoryRepositoryMock.adjustStock.mockResolvedValue({
      ...product,
      inventory: {
        ...product.inventory,
        quantity: 8,
      },
    });
    state.orderRepositoryMock.createOrder.mockResolvedValue(createdOrder);

    const service = new OrderService();

    const result = await service.placeOrder({
      idempotencyKey: 'place-123',
      items: [
        {
          productId: product.id,
          quantity: 2,
        },
      ],
    });

    expect(state.inventoryRepositoryMock.adjustStock).toHaveBeenCalledWith({
      productId: product.id,
      delta: -2,
    });
    expect(state.orderRepositoryMock.createOrder).toHaveBeenCalledWith({
      createIdempotencyKey: 'place-123',
      totalCents: 5000,
      items: [
        {
          productId: product.id,
          quantity: 2,
          priceCents: 2500,
        },
      ],
    });
    expect(result).toEqual(createdOrder);
  });

  it('fails the order when stock cannot be decremented', async () => {
    const product = createProduct('5a473c47-4b0c-4dab-9c57-7d66f813d442', 1, 2500);

    state.orderRepositoryMock.findByCreateIdempotencyKey.mockResolvedValue(null);
    state.inventoryRepositoryMock.findManyByIds.mockResolvedValue([product]);
    state.inventoryRepositoryMock.adjustStock.mockResolvedValue(null);

    const service = new OrderService();

    await expect(
      service.placeOrder({
        idempotencyKey: 'place-123',
        items: [
          {
            productId: product.id,
            quantity: 2,
          },
        ],
      }),
    ).rejects.toThrow(`Insufficient stock for product ${product.id}`);

    expect(state.orderRepositoryMock.createOrder).not.toHaveBeenCalled();
  });

  it('returns the existing cancellation when the cancel idempotency key was already used', async () => {
    const cancelledOrder = createOrder({
      status: 'CANCELLED',
      cancelIdempotencyKey: 'cancel-123',
      cancelledAt: new Date('2026-03-16T11:00:00.000Z'),
    });
    state.orderRepositoryMock.findByCancelIdempotencyKey.mockResolvedValue(cancelledOrder);

    const service = new OrderService();

    const result = await service.cancelOrder({
      orderId: cancelledOrder.id,
      idempotencyKey: 'cancel-123',
    });

    expect(result).toEqual(cancelledOrder);
    expect(state.inventoryRepositoryMock.adjustStock).not.toHaveBeenCalled();
    expect(state.orderRepositoryMock.cancelOrder).not.toHaveBeenCalled();
  });

  it('restores stock and marks the order cancelled', async () => {
    const placedOrder = createOrder();
    const cancelledOrder = createOrder({
      status: 'CANCELLED',
      cancelIdempotencyKey: 'cancel-123',
      cancelledAt: new Date('2026-03-16T11:00:00.000Z'),
    });

    state.orderRepositoryMock.findByCancelIdempotencyKey.mockResolvedValue(null);
    state.orderRepositoryMock.findById
      .mockResolvedValueOnce(placedOrder)
      .mockResolvedValueOnce(cancelledOrder);
    state.inventoryRepositoryMock.adjustStock.mockResolvedValue(
      createProduct('5a473c47-4b0c-4dab-9c57-7d66f813d442', 12, 2500),
    );
    state.orderRepositoryMock.cancelOrder.mockResolvedValue(cancelledOrder);

    const service = new OrderService();

    const result = await service.cancelOrder({
      orderId: placedOrder.id,
      idempotencyKey: 'cancel-123',
    });

    expect(state.inventoryRepositoryMock.adjustStock).toHaveBeenCalledWith({
      productId: '5a473c47-4b0c-4dab-9c57-7d66f813d442',
      delta: 2,
    });
    expect(state.orderRepositoryMock.cancelOrder).toHaveBeenCalledWith(placedOrder.id, 'cancel-123');
    expect(result).toEqual(cancelledOrder);
  });

  it('returns already-cancelled orders without restoring stock again', async () => {
    const cancelledOrder = createOrder({
      status: 'CANCELLED',
      cancelIdempotencyKey: 'older-key',
      cancelledAt: new Date('2026-03-16T11:00:00.000Z'),
    });

    state.orderRepositoryMock.findByCancelIdempotencyKey.mockResolvedValue(null);
    state.orderRepositoryMock.findById.mockResolvedValue(cancelledOrder);

    const service = new OrderService();

    const result = await service.cancelOrder({
      orderId: cancelledOrder.id,
      idempotencyKey: 'cancel-123',
    });

    expect(result).toEqual(cancelledOrder);
    expect(state.inventoryRepositoryMock.adjustStock).not.toHaveBeenCalled();
    expect(state.orderRepositoryMock.cancelOrder).not.toHaveBeenCalled();
  });
});
