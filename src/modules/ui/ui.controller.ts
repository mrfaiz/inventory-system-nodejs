import type { Request, Response } from 'express';

import { AiSearchService } from '../ai-search/ai-search.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderService } from '../order/order.service';
import { renderDashboard } from '../../views/ui/dashboard.view';

function asMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return fallback;
}

function parseOrderItems(input: string) {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [productId, quantity] = line.split(',').map((part) => part.trim());

      if (!productId || !quantity) {
        throw new Error('Each order item must be in the format product-id,quantity');
      }

      return {
        productId,
        quantity: Number(quantity),
      };
    });
}

export class UiController {
  constructor(
    private readonly aiSearchService = new AiSearchService(),
    private readonly inventoryService = new InventoryService(),
    private readonly orderService = new OrderService(),
  ) {}

  private async renderDashboardResponse(
    res: Response,
    options: {
      notice?: string;
      error?: string;
      orderDraft?: string;
      searchPrompt?: string;
      searchAnswer?: string;
      searchProducts?: Awaited<ReturnType<InventoryService['listProducts']>>;
    } = {},
  ) {
    const [products, orders] = await Promise.all([
      this.inventoryService.listProducts(),
      this.orderService.listOrders(),
    ]);

    res.status(200).send(
      renderDashboard({
        products,
        orders,
        notice: options.notice,
        error: options.error,
        orderDraft: options.orderDraft ?? '',
        searchPrompt: options.searchPrompt ?? '',
        searchAnswer: options.searchAnswer,
        searchProducts: options.searchProducts ?? [],
      }),
    );
  }

  dashboard = async (req: Request, res: Response) => {
    await this.renderDashboardResponse(res, {
      notice: typeof req.query.notice === 'string' ? req.query.notice : undefined,
      error: typeof req.query.error === 'string' ? req.query.error : undefined,
      orderDraft: typeof req.query.orderDraft === 'string' ? req.query.orderDraft : '',
    });
  };

  aiSearch = async (req: Request, res: Response) => {
    const prompt = String(req.body.prompt ?? '');

    try {
      const result = await this.aiSearchService.searchProducts({ prompt });

      await this.renderDashboardResponse(res, {
        notice: 'AI search completed',
        searchPrompt: prompt,
        searchAnswer: result.answer,
        searchProducts: result.products,
      });
    } catch (error) {
      await this.renderDashboardResponse(res, {
        error: asMessage(error instanceof Error ? error.message : error, 'Unable to run AI search'),
        searchPrompt: prompt,
      });
    }
  };

  aiSearchApi = async (req: Request, res: Response) => {
    const prompt = String(req.body.prompt ?? '');

    try {
      const result = await this.aiSearchService.searchProducts({ prompt });

      res.status(200).json({
        prompt,
        answer: result.answer,
        products: result.products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          priceCents: product.priceCents,
          stock: product.inventory?.quantity ?? 0,
        })),
      });
    } catch (error) {
      res.status(400).json({
        error: asMessage(error instanceof Error ? error.message : error, 'Unable to run AI search'),
      });
    }
  };

  createProduct = async (req: Request, res: Response) => {
    try {
      await this.inventoryService.createProduct({
        sku: String(req.body.sku),
        name: String(req.body.name),
        description: String(req.body.description || '').trim() || undefined,
        priceCents: Number(req.body.priceCents),
        stock: Number(req.body.stock),
      });

      res.redirect('/ui?notice=Product%20created');
    } catch (error) {
      res.redirect(`/ui?error=${encodeURIComponent(asMessage(error instanceof Error ? error.message : error, 'Unable to create product'))}`);
    }
  };

  adjustStock = async (req: Request, res: Response) => {
    try {
      await this.inventoryService.adjustStock({
        productId: String(req.body.productId),
        delta: Number(req.body.delta),
      });

      res.redirect('/ui?notice=Stock%20updated');
    } catch (error) {
      res.redirect(`/ui?error=${encodeURIComponent(asMessage(error instanceof Error ? error.message : error, 'Unable to update stock'))}`);
    }
  };

  placeOrder = async (req: Request, res: Response) => {
    const rawItems = String(req.body.items ?? '');

    try {
      await this.orderService.placeOrder({
        idempotencyKey: String(req.body.idempotencyKey),
        items: parseOrderItems(rawItems),
      });

      res.redirect('/ui?notice=Order%20placed');
    } catch (error) {
      res.redirect(
        `/ui?error=${encodeURIComponent(asMessage(error instanceof Error ? error.message : error, 'Unable to place order'))}&orderDraft=${encodeURIComponent(rawItems)}`,
      );
    }
  };

  cancelOrder = async (req: Request, res: Response) => {
    try {
      await this.orderService.cancelOrder({
        orderId: String(req.body.orderId),
        idempotencyKey: String(req.body.idempotencyKey),
      });

      res.redirect('/ui?notice=Order%20cancelled');
    } catch (error) {
      res.redirect(`/ui?error=${encodeURIComponent(asMessage(error instanceof Error ? error.message : error, 'Unable to cancel order'))}`);
    }
  };
}
