import type { Prisma, PrismaClient } from '@prisma/client';

import type { AdjustStockInput, CreateProductInput } from './inventory.schema';

type InventoryDb = PrismaClient | Prisma.TransactionClient;

export type ProductWithInventory = Prisma.ProductGetPayload<{
  include: {
    inventory: true;
  };
}>;

export class InventoryRepository {
  constructor(private readonly db: InventoryDb) {}

  createProduct(data: CreateProductInput): Promise<ProductWithInventory> {
    return this.db.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description,
        priceCents: data.priceCents,
        inventory: {
          create: {
            quantity: data.stock,
          },
        },
      },
      include: {
        inventory: true,
      },
    });
  }

  listProducts(): Promise<ProductWithInventory[]> {
    return this.db.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        inventory: true,
      },
    });
  }

  findById(productId: string): Promise<ProductWithInventory | null> {
    return this.db.product.findUnique({
      where: { id: productId },
      include: {
        inventory: true,
      },
    });
  }

  findManyByIds(productIds: string[]): Promise<ProductWithInventory[]> {
    return this.db.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      include: {
        inventory: true,
      },
    });
  }

  async adjustStock({ productId, delta }: AdjustStockInput): Promise<ProductWithInventory | null> {
    const updatedRows = await this.db.inventory.updateMany({
      where:
        delta > 0
          ? { productId }
          : {
              productId,
              quantity: { gte: Math.abs(delta) },
            },
      data: {
        quantity: {
          increment: delta,
        },
      },
    });

    if (updatedRows.count === 0) {
      return null;
    }

    return this.findById(productId);
  }
}
