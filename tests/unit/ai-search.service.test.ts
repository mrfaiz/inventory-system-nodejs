import { beforeEach, describe, expect, it, vi } from 'vitest';

const aiSearchRepositoryMock = vi.hoisted(() => ({
  searchProducts: vi.fn(),
}));

const mistralClientMock = vi.hoisted(() => ({
  createChatCompletion: vi.fn(),
}));

vi.mock('../../src/db/prisma', () => ({
  getPrisma: vi.fn(() => ({})),
}));

vi.mock('../../src/modules/ai-search/ai-search.repository', () => ({
  AiSearchRepository: class {
    constructor() {
      return aiSearchRepositoryMock;
    }
  },
}));

vi.mock('../../src/modules/ai-search/mistral.client', () => ({
  MistralClient: class {
    constructor() {
      return mistralClientMock;
    }
  },
}));

import { AiSearchService } from '../../src/modules/ai-search/ai-search.service';

describe('AiSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes the search_products tool and returns the final answer', async () => {
    const products = [
      {
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
      },
    ];

    mistralClientMock.createChatCompletion
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'tool-1',
            type: 'function',
            function: {
              name: 'search_products',
              arguments: JSON.stringify({
                query: 'keyboard',
                limit: 3,
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        content: 'I found Keyboard (SKU-1), priced at 8900 cents with 5 units in stock.',
        toolCalls: [],
      });

    aiSearchRepositoryMock.searchProducts.mockResolvedValue(products);

    const service = new AiSearchService();

    await expect(
      service.searchProducts({
        prompt: 'Find keyboards',
      }),
    ).resolves.toEqual({
      answer: 'I found Keyboard (SKU-1), priced at 8900 cents with 5 units in stock.',
      products,
    });

    expect(aiSearchRepositoryMock.searchProducts).toHaveBeenCalledWith('keyboard', 3);
    expect(mistralClientMock.createChatCompletion).toHaveBeenCalledTimes(2);
  });

  it('throws on unsupported tool names', async () => {
    mistralClientMock.createChatCompletion.mockResolvedValue({
      content: '',
      toolCalls: [
        {
          id: 'tool-1',
          type: 'function',
          function: {
            name: 'unknown_tool',
            arguments: '{}',
          },
        },
      ],
    });

    const service = new AiSearchService();

    await expect(
      service.searchProducts({
        prompt: 'Find keyboards',
      }),
    ).rejects.toThrow('Unsupported tool: unknown_tool');
  });
});
