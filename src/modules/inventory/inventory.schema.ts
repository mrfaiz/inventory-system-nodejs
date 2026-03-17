import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  priceCents: z.number().int().positive(),
  stock: z.number().int().min(0),
});

export const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  delta: z.number().int().refine((value) => value !== 0, {
    message: 'delta must not be zero',
  }),
});

export const getProductSchema = z.object({
  productId: z.string().uuid(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type GetProductInput = z.infer<typeof getProductSchema>;
