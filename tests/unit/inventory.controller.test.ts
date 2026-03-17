import { InventoryController } from '../../src/modules/inventory/inventory.controller';
import type { ProductWithInventory } from '../../src/modules/inventory/inventory.repository';

function createProduct(overrides: Partial<ProductWithInventory> = {}): ProductWithInventory {
  return {
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
    ...overrides,
  };
}

describe('InventoryController', () => {
  it('creates a product through the service', async () => {
    const createdProduct = createProduct();
    const service = {
      createProduct: vi.fn().mockResolvedValue(createdProduct),
      listProducts: vi.fn(),
      getProductOrThrow: vi.fn(),
      adjustStock: vi.fn(),
    };

    const controller = new InventoryController(service as never);

    const result = await controller.createProduct({
      sku: 'SKU-1',
      name: 'Keyboard',
      description: 'Mechanical keyboard',
      priceCents: 8900,
      stock: 5,
    });

    expect(service.createProduct).toHaveBeenCalledWith({
      sku: 'SKU-1',
      name: 'Keyboard',
      description: 'Mechanical keyboard',
      priceCents: 8900,
      stock: 5,
    });
    expect(result).toEqual(createdProduct);
  });

  it('rejects invalid stock adjustments before reaching the service', async () => {
    const service = {
      createProduct: vi.fn(),
      listProducts: vi.fn(),
      getProductOrThrow: vi.fn(),
      adjustStock: vi.fn(),
    };

    const controller = new InventoryController(service as never);

    expect(() =>
      controller.adjustStock({
        productId: 'not-a-uuid',
        delta: 0,
      }),
    ).toThrow();

    expect(service.adjustStock).not.toHaveBeenCalled();
  });
});
