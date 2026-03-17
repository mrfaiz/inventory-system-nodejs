import 'dotenv/config';

import { disconnectPrisma, getPrisma } from '../src/db/prisma';
import { OrderService } from '../src/modules/order/order.service';

async function ensureProduct(input: {
  sku: string;
  name: string;
  description?: string;
  priceCents: number;
  stock: number;
}) {
  const prisma = getPrisma();

  return prisma.product.upsert({
    where: { sku: input.sku },
    update: {
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      inventory: {
        upsert: {
          update: {
            quantity: input.stock,
          },
          create: {
            quantity: input.stock,
          },
        },
      },
    },
    create: {
      sku: input.sku,
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      inventory: {
        create: {
          quantity: input.stock,
        },
      },
    },
    include: {
      inventory: true,
    },
  });
}

async function main() {
  const orderService = new OrderService();

  const keyboard = await ensureProduct({
    sku: 'DEMO-KEYBOARD',
    name: 'Warehouse Keyboard',
    description: 'Mechanical keyboard used for demo orders',
    priceCents: 12900,
    stock: 16,
  });

  const mouse = await ensureProduct({
    sku: 'DEMO-MOUSE',
    name: 'Warehouse Mouse',
    description: 'Wireless mouse used for demo orders',
    priceCents: 4900,
    stock: 24,
  });

  const headset = await ensureProduct({
    sku: 'DEMO-HEADSET',
    name: 'Warehouse Headset',
    description: 'USB headset for the sample dashboard',
    priceCents: 8900,
    stock: 12,
  });

  const openOrder = await orderService.placeOrder({
    idempotencyKey: 'seed-order-open-v1',
    items: [
      {
        productId: keyboard.id,
        quantity: 2,
      },
      {
        productId: mouse.id,
        quantity: 1,
      },
    ],
  });

  const cancelledOrder = await orderService.placeOrder({
    idempotencyKey: 'seed-order-cancelled-v1',
    items: [
      {
        productId: headset.id,
        quantity: 2,
      },
    ],
  });

  await orderService.cancelOrder({
    orderId: cancelledOrder.id,
    idempotencyKey: 'seed-order-cancelled-v1-cancel',
  });

  console.log('Seed complete.');
  console.log(`Products: ${keyboard.sku}, ${mouse.sku}, ${headset.sku}`);
  console.log(`Open order: ${openOrder.id}`);
  console.log(`Cancelled order: ${cancelledOrder.id}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
