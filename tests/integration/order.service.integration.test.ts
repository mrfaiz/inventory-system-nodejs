import { execFileSync } from 'node:child_process';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { disconnectPrisma, getPrisma } from '../../src/db/prisma';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { OrderService } from '../../src/modules/order/order.service';

let container: StartedPostgreSqlContainer;

function runPrismaMigrateDeploy(databaseUrl: string) {
  execFileSync('node', ['./node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}

describe('OrderService integration with Testcontainers PostgreSQL', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('inventory_system_test')
      .withUsername('inventory')
      .withPassword('inventory')
      .start();

    process.env.DATABASE_URL = `${container.getConnectionUri()}?schema=public`;

    runPrismaMigrateDeploy(process.env.DATABASE_URL);
    await disconnectPrisma();
    await getPrisma().$connect();
    await container.snapshot('migrated_template');
  });

  beforeEach(async () => {
    await disconnectPrisma();
    await container.restoreSnapshot('migrated_template');
  });

  afterAll(async () => {
    await disconnectPrisma();
    await container.stop();
  });

  it('keeps placeOrder idempotent and decrements stock only once', async () => {
    const inventoryService = new InventoryService();
    const orderService = new OrderService();
    const prisma = getPrisma();

    const product = await inventoryService.createProduct({
      sku: 'SKU-INT-1',
      name: 'Integration Keyboard',
      description: 'Used in integration tests',
      priceCents: 12500,
      stock: 10,
    });

    const first = await orderService.placeOrder({
      idempotencyKey: 'order-place-001',
      items: [
        {
          productId: product.id,
          quantity: 2,
        },
      ],
    });

    const second = await orderService.placeOrder({
      idempotencyKey: 'order-place-001',
      items: [
        {
          productId: product.id,
          quantity: 2,
        },
      ],
    });

    const persistedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { inventory: true },
    });
    const persistedOrders = await prisma.order.findMany();

    expect(second.id).toBe(first.id);
    expect(persistedOrders).toHaveLength(1);
    expect(persistedProduct.inventory?.quantity).toBe(8);
  });

  it('rolls back the transaction when stock is insufficient', async () => {
    const inventoryService = new InventoryService();
    const orderService = new OrderService();
    const prisma = getPrisma();

    const product = await inventoryService.createProduct({
      sku: 'SKU-INT-2',
      name: 'Integration Mouse',
      description: 'Used in integration tests',
      priceCents: 4500,
      stock: 1,
    });

    await expect(
      orderService.placeOrder({
        idempotencyKey: 'order-place-002',
        items: [
          {
            productId: product.id,
            quantity: 2,
          },
        ],
      }),
    ).rejects.toThrow(`Insufficient stock for product ${product.id}`);

    const persistedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { inventory: true },
    });
    const persistedOrders = await prisma.order.findMany();

    expect(persistedProduct.inventory?.quantity).toBe(1);
    expect(persistedOrders).toHaveLength(0);
  });

  it('keeps cancelOrder idempotent and restores stock only once', async () => {
    const inventoryService = new InventoryService();
    const orderService = new OrderService();
    const prisma = getPrisma();

    const product = await inventoryService.createProduct({
      sku: 'SKU-INT-3',
      name: 'Integration Headset',
      description: 'Used in integration tests',
      priceCents: 9900,
      stock: 7,
    });

    const placed = await orderService.placeOrder({
      idempotencyKey: 'order-place-003',
      items: [
        {
          productId: product.id,
          quantity: 3,
        },
      ],
    });

    const firstCancel = await orderService.cancelOrder({
      orderId: placed.id,
      idempotencyKey: 'order-cancel-003',
    });

    const secondCancel = await orderService.cancelOrder({
      orderId: placed.id,
      idempotencyKey: 'order-cancel-003',
    });

    const persistedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { inventory: true },
    });
    const persistedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: placed.id },
    });

    expect(firstCancel.status).toBe('CANCELLED');
    expect(secondCancel.id).toBe(firstCancel.id);
    expect(persistedOrder.status).toBe('CANCELLED');
    expect(persistedProduct.inventory?.quantity).toBe(7);
  });
});
