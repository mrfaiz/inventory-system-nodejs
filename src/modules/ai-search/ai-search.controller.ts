import { AiSearchService } from './ai-search.service';
import { aiSearchSchema } from './ai-search.schema';

export class AiSearchController {
  constructor(private readonly service = new AiSearchService()) {}

  searchProducts(input: unknown) {
    return this.service.searchProducts(aiSearchSchema.parse(input));
  }
}
