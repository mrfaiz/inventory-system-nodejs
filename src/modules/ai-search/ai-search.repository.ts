import type { Prisma, PrismaClient } from '@prisma/client';

type AiSearchDb = PrismaClient | Prisma.TransactionClient;

export type SearchableProduct = Prisma.ProductGetPayload<{
  include: {
    inventory: true;
  };
}>;

export class AiSearchRepository {
  constructor(private readonly db: AiSearchDb) {}

  searchProducts(query: string, limit: number): Promise<SearchableProduct[]> {
    return this.db.product.findMany({
      where: {
        OR: [
          {
            sku: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      take: limit,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        inventory: true,
      },
    });
  }
}
