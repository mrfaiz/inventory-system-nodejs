type MistralMessage =
  | {
      role: 'system' | 'user' | 'assistant';
      content: string;
      tool_calls?: MistralToolCall[];
    }
  | {
      role: 'tool';
      name: string;
      tool_call_id: string;
      content: string;
    };

type MistralToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type MistralToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

type MistralChatCompletionRequest = {
  model: string;
  messages: MistralMessage[];
  tools?: MistralToolDefinition[];
  tool_choice?: 'auto' | 'any' | 'none';
  parallel_tool_calls?: boolean;
};

type MistralChatCompletionResponse = {
  choices?: Array<{
    message?: {
      role?: 'assistant';
      content?: string | Array<{ type?: string; text?: string }>;
      tool_calls?: MistralToolCall[];
    };
  }>;
};

export class MistralClient {
  private readonly apiKey = process.env.MISTRAL_API_KEY;
  private readonly model = process.env.MISTRAL_MODEL ?? 'mistral-small-latest';
  private readonly baseUrl = process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1';

  async createChatCompletion(request: Omit<MistralChatCompletionRequest, 'model'>) {
    if (!this.apiKey) {
      throw new Error('MISTRAL_API_KEY is required');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        ...request,
      } satisfies MistralChatCompletionRequest),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mistral API request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as MistralChatCompletionResponse;
    const message = payload.choices?.[0]?.message;

    if (!message) {
      throw new Error('Mistral API returned no message');
    }

    return {
      content: this.extractTextContent(message.content),
      toolCalls: message.tool_calls ?? [],
    };
  }

  private extractTextContent(content: string | Array<{ type?: string; text?: string }> | undefined): string {
    if (!content) {
      return '';
    }

    if (typeof content === 'string') {
      return content;
    }

    return content
      .map((chunk) => {
        if (chunk.type === 'text' && chunk.text) {
          return chunk.text;
        }

        return '';
      })
      .join('')
      .trim();
  }
}

export type { MistralMessage, MistralToolCall, MistralToolDefinition };
