'use strict';

const env = require('../../config/env');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class EmbeddingService {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? env.embeddingApiKey;
    this.baseUrl = (options.baseUrl ?? env.embeddingBaseUrl ?? '').replace(/\/$/, '');
    this.model = options.model ?? env.embeddingModel;
    this.fetch = options.fetch ?? global.fetch;
    this.sleep = options.sleep ?? delay;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 250;
  }

  validateConfiguration() {
    if (!this.apiKey || !this.baseUrl || !this.model) {
      throw new Error('Embedding provider is not configured. Set EMBEDDING_API_KEY, EMBEDDING_BASE_URL, and EMBEDDING_MODEL.');
    }
  }

  async request(text) {
    this.validateConfiguration();
    const response = await this.fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!response.ok) throw new Error(`Embedding provider returned HTTP ${response.status}.`);
    const body = await response.json();
    const embedding = body?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0 || !embedding.every(Number.isFinite)) {
      throw new Error('Embedding provider returned an invalid embedding.');
    }
    return embedding;
  }

  async generateEmbedding(text) {
    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await this.request(text);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxAttempts) {
          await this.sleep(this.baseDelayMs * (2 ** (attempt - 1)));
        }
      }
    }
    throw lastError;
  }
}

module.exports = EmbeddingService;
