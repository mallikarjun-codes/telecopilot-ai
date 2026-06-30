'use strict';

const env = require('../../config/env');

class LLMService {
  constructor(options = {}) {
    this.provider = options.provider ?? env.llmProvider;
    this.apiKey = options.apiKey ?? env.llmApiKey;
    this.baseUrl = (options.baseUrl ?? env.llmBaseUrl ?? '').replace(/\/$/, '');
    this.model = options.model ?? env.llmModel;
    this.temperature = options.temperature ?? env.llmTemperature;
    this.maxTokens = options.maxTokens ?? env.llmMaxTokens;
    this.fetch = options.fetch ?? global.fetch;
  }

  validateConfiguration() {
    if (this.provider !== 'openai-compatible') {
      throw new Error(`Unsupported LLM provider: ${this.provider}.`);
    }
    if (!this.apiKey || !this.baseUrl || !this.model) {
      throw new Error('LLM provider is not configured. Set LLM_API_KEY, LLM_BASE_URL, and LLM_MODEL.');
    }
  }

  async generate(messages) {
    const result = await this.generateDetailed(messages);
    return result.answer;
  }

  async generateDetailed(messages) {
    this.validateConfiguration();
    const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      }),
    });
    if (!response.ok) throw new Error(`LLM provider returned HTTP ${response.status}.`);
    const body = await response.json();
    return this.normalizeCompletion(body);
  }

  normalizeCompletion(body) {
    const answer = body?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('LLM provider returned an invalid answer.');
    const usage = body?.usage || {};
    const promptTokens = Number.isInteger(usage.prompt_tokens) ? usage.prompt_tokens : 0;
    const completionTokens = Number.isInteger(usage.completion_tokens) ? usage.completion_tokens : 0;
    const totalTokens = Number.isInteger(usage.total_tokens)
      ? usage.total_tokens
      : promptTokens + completionTokens;
    return {
      answer: answer.trim(),
      usage: { promptTokens, completionTokens, totalTokens },
    };
  }

  async *streamDetailed(messages, options = {}) {
    this.validateConfiguration();
    const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model, messages, temperature: this.temperature,
        max_tokens: this.maxTokens, stream: true, stream_options: { include_usage: true },
      }),
      signal: options.signal,
    });
    if (!response.ok) throw new Error(`LLM provider returned HTTP ${response.status}.`);
    if (!response.body || typeof response.body.getReader !== 'function') {
      const result = this.normalizeCompletion(await response.json());
      for (const token of result.answer.match(/\s+|\S+/g) || []) yield { token };
      yield { usage: result.usage };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = done ? '' : frames.pop();
        for (const frame of frames) {
          for (const line of frame.split(/\r?\n/).filter((item) => item.startsWith('data:'))) {
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            const payload = JSON.parse(data);
            const token = payload?.choices?.[0]?.delta?.content;
            if (typeof token === 'string' && token) yield { token };
            if (payload.usage) {
              const promptTokens = payload.usage.prompt_tokens || 0;
              const completionTokens = payload.usage.completion_tokens || 0;
              yield { usage: { promptTokens, completionTokens, totalTokens: payload.usage.total_tokens || promptTokens + completionTokens } };
            }
          }
        }
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

module.exports = LLMService;
