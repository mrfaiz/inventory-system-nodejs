import { z } from 'zod';

export const searchProductsToolSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(20).default(5),
});

export const aiSearchSchema = z.object({
  prompt: z.string().trim().min(1),
});

export type SearchProductsToolInput = z.infer<typeof searchProductsToolSchema>;
export type AiSearchInput = z.infer<typeof aiSearchSchema>;
