import { getPrisma } from '../../db/prisma';
import { InventoryRepository, type ProductWithInventory } from './inventory.repository';
import type { AdjustStockInput, CreateProductInput } from './inventory.schema';

export class InventoryService {
  constructor(private readonly repository = new InventoryRepository(getPrisma())) {}

  createProduct(input: CreateProductInput): Promise<ProductWithInventory> {
    return this.repository.createProduct(input);
  }

  listProducts(): Promise<ProductWithInventory[]> {
    return this.repository.listProducts();
  }

  async getProductOrThrow(productId: string): Promise<ProductWithInventory> {
    const product = await this.repository.findById(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    return product;
  }

  async adjustStock(input: AdjustStockInput): Promise<ProductWithInventory> {
    const product = await this.repository.adjustStock(input);

    if (!product) {
      throw new Error('Unable to adjust stock');
    }

    return product;
  }
}
