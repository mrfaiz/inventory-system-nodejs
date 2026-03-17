import type { ProductWithInventory } from './inventory.repository';
import { InventoryService } from './inventory.service';
import { adjustStockSchema, createProductSchema, getProductSchema } from './inventory.schema';

export class InventoryController {
  constructor(private readonly service = new InventoryService()) {}

  createProduct(input: unknown): Promise<ProductWithInventory> {
    return this.service.createProduct(createProductSchema.parse(input));
  }

  listProducts(): Promise<ProductWithInventory[]> {
    return this.service.listProducts();
  }

  async getProduct(input: unknown): Promise<ProductWithInventory> {
    const { productId } = getProductSchema.parse(input);
    return this.service.getProductOrThrow(productId);
  }

  adjustStock(input: unknown): Promise<ProductWithInventory> {
    return this.service.adjustStock(adjustStockSchema.parse(input));
  }
}
