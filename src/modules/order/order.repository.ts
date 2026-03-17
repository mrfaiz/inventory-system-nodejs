import type { Order, Prisma, PrismaClient } from '@prisma/client';

type OrderDb = PrismaClient | Prisma.TransactionClient;

const orderInclude = {
  items: {
    include: {
      product: {
        include: {
          inventory: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

export class OrderRepository {
  constructor(private readonly db: OrderDb) {}

  findByCreateIdempotencyKey(createIdempotencyKey: string): Promise<OrderWithItems | null> {
    return this.db.order.findUnique({
      where: { createIdempotencyKey },
      include: orderInclude,
    });
  }

  findByCancelIdempotencyKey(cancelIdempotencyKey: string): Promise<OrderWithItems | null> {
    return this.db.order.findFirst({
      where: { cancelIdempotencyKey },
      include: orderInclude,
    });
  }

  findById(orderId: string): Promise<OrderWithItems | null> {
    return this.db.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
  }

  listOrders(): Promise<OrderWithItems[]> {
    return this.db.order.findMany({
      include: orderInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  createOrder(data: {
    createIdempotencyKey: string;
    totalCents: number;
    items: Array<{ productId: string; quantity: number; priceCents: number }>;
  }): Promise<OrderWithItems> {
    return this.db.order.create({
      data: {
        createIdempotencyKey: data.createIdempotencyKey,
        totalCents: data.totalCents,
        items: {
          create: data.items,
        },
      },
      include: orderInclude,
    });
  }

  cancelOrder(orderId: string, cancelIdempotencyKey: string): Promise<Order> {
    return this.db.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelIdempotencyKey,
        cancelledAt: new Date(),
      },
    });
  }
}
