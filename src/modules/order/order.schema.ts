import { z } from 'zod';

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const placeOrderSchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  items: z.array(orderItemSchema).min(1),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(1),
});

export const getOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type GetOrderInput = z.infer<typeof getOrderSchema>;
