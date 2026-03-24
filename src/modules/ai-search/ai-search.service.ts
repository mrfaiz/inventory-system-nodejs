import { getPrisma } from '../../db/prisma';
import type { AiSearchInput, SearchProductsToolInput } from './ai-search.schema';
import { AiSearchRepository, type SearchableProduct } from './ai-search.repository';
import { searchProductsToolSchema } from './ai-search.schema';
import { MistralClient, type MistralMessage, type MistralToolCall, type MistralToolDefinition } from './mistral.client';

type AiSearchResponse = {
  answer: string;
  products: SearchableProduct[];
};

const searchProductsTool: MistralToolDefinition = {
  type: 'function',
  function: {
    name: 'search_products',
    description: 'Search the inventory catalog for products that match the user request.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords to match against product sku, name, or description.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of products to return.',
        },
      },
      required: ['query'],
    },
  },
};

export class AiSearchService {
  constructor(
    private readonly repository = new AiSearchRepository(getPrisma()),
    private readonly mistralClient = new MistralClient(),
  ) {}

  async searchProducts(input: AiSearchInput): Promise<AiSearchResponse> {
    const messages: MistralMessage[] = [
      {
        role: 'system',
        content:
          'You are an inventory search assistant. Use the search_products tool to retrieve products before answering product-search requests. Summarize relevant products, include stock quantity and price in cents, and say when there are no matches.',
      },
      {
        role: 'user',
        content: input.prompt,
      },
    ];

    const collectedProducts = new Map<string, SearchableProduct>();

    for (let iteration = 0; iteration < 5; iteration += 1) {
      const completion = await this.mistralClient.createChatCompletion({
        messages,
        tools: [searchProductsTool],
        tool_choice: 'auto',
        parallel_tool_calls: false,
      });

      const toolCalls = completion.toolCalls;

      messages.push({
        role: 'assistant',
        content: completion.content,
        tool_calls: toolCalls,
      });

      if (toolCalls.length === 0) {
        return {
          answer: completion.content,
          products: Array.from(collectedProducts.values()),
        };
      }

      for (const toolCall of toolCalls) {
        const toolResult = await this.executeToolCall(toolCall);

        for (const product of toolResult.products) {
          collectedProducts.set(product.id, product);
        }

        messages.push({
          role: 'tool',
          name: toolCall.function.name,
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            products: toolResult.products.map((product) => ({
              id: product.id,
              sku: product.sku,
              name: product.name,
              description: product.description,
              priceCents: product.priceCents,
              stock: product.inventory?.quantity ?? 0,
            })),
          }),
        });
      }
    }

    throw new Error('AI search exceeded the maximum number of tool iterations');
  }

  private async executeToolCall(toolCall: MistralToolCall): Promise<{ products: SearchableProduct[] }> {
    if (toolCall.function.name !== 'search_products') {
      throw new Error(`Unsupported tool: ${toolCall.function.name}`);
    }

    const args = this.parseToolArguments(toolCall.function.arguments);
    const products = await this.repository.searchProducts(args.query, args.limit);
    return { products };
  }

  private parseToolArguments(rawArguments: string): SearchProductsToolInput {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawArguments);
    } catch {
      throw new Error('Invalid tool arguments received from Mistral');
    }

    return searchProductsToolSchema.parse(parsed);
  }
}

export type { AiSearchResponse };
