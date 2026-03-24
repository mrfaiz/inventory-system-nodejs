import { AiSearchController } from '../../src/modules/ai-search/ai-search.controller';

describe('AiSearchController', () => {
  it('passes valid prompts to the service', async () => {
    const response = { answer: 'Found one product.', products: [] };
    const service = {
      searchProducts: vi.fn().mockResolvedValue(response),
    };

    const controller = new AiSearchController(service as never);

    await expect(
      controller.searchProducts({
        prompt: 'Find keyboard products',
      }),
    ).resolves.toEqual(response);

    expect(service.searchProducts).toHaveBeenCalledWith({
      prompt: 'Find keyboard products',
    });
  });

  it('rejects empty prompts before reaching the service', () => {
    const service = {
      searchProducts: vi.fn(),
    };

    const controller = new AiSearchController(service as never);

    expect(() =>
      controller.searchProducts({
        prompt: '   ',
      }),
    ).toThrow();

    expect(service.searchProducts).not.toHaveBeenCalled();
  });
});
