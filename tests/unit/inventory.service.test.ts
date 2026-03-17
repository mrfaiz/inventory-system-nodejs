import { beforeEach, describe, expect, it, vi } from 'vitest';

const inventoryRepositoryMock = vi.hoisted(() => ({
  createProduct: vi.fn(),
  listProducts: vi.fn(),
  findById: vi.fn(),
  adjustStock: vi.fn(),
}));

vi.mock('../../src/db/prisma', () => ({
  getPrisma: vi.fn(() => ({})),
}));

vi.mock('../../src/modules/inventory/inventory.repository', () => ({
  InventoryRepository: class {
    constructor() {
      return inventoryRepositoryMock;
    }
  },
}));

import { InventoryService } from '../../src/modules/inventory/inventory.service';

describe('InventoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a product when it exists', async () => {
    const product = {
      id: '9b7cfa2c-e5ef-4db2-9d76-a17d2cc4190c',
      sku: 'SKU-1',
      name: 'Keyboard',
      description: 'Mechanical keyboard',
      priceCents: 8900,
      createdAt: new Date('2026-03-16T10:00:00.000Z'),
      updatedAt: new Date('2026-03-16T10:00:00.000Z'),
      inventory: {
        id: '31f79362-0de4-4579-a5ea-fd48db9d39d8',
        productId: '9b7cfa2c-e5ef-4db2-9d76-a17d2cc4190c',
        quantity: 5,
        createdAt: new Date('2026-03-16T10:00:00.000Z'),
        updatedAt: new Date('2026-03-16T10:00:00.000Z'),
      },
    };

    inventoryRepositoryMock.findById.mockResolvedValue(product);

    const service = new InventoryService();

    await expect(service.getProductOrThrow(product.id)).resolves.toEqual(product);
    expect(inventoryRepositoryMock.findById).toHaveBeenCalledWith(product.id);
  });

  it('throws when the product does not exist', async () => {
    inventoryRepositoryMock.findById.mockResolvedValue(null);

    const service = new InventoryService();

    await expect(service.getProductOrThrow('missing-product')).rejects.toThrow('Product not found');
  });

  it('throws when stock cannot be adjusted', async () => {
    inventoryRepositoryMock.adjustStock.mockResolvedValue(null);

    const service = new InventoryService();

    await expect(
      service.adjustStock({
        productId: '9b7cfa2c-e5ef-4db2-9d76-a17d2cc4190c',
        delta: -3,
      }),
    ).rejects.toThrow('Unable to adjust stock');
  });
});
