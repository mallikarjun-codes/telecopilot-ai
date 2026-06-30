'use strict';

const ragPrompt = require('../prompts/rag.prompt');

class PromptBuilder {
  build(question, chunks, history = []) {
    const context = chunks.length
      ? chunks.map((chunk, index) => `Chunk ${index + 1}\n${chunk.content}`).join('\n\n')
      : '(No relevant context was retrieved.)';

    return [
      { role: 'system', content: ragPrompt.system },
      ...history.map(({ role, content }) => ({
        role: String(role).toLowerCase(),
        content,
      })),
      {
        role: 'user',
        content: `Context\n\n${context}\n\n--- END OF CONTEXT ---\n\nQuestion\n\n${question}\n\nAnswer`,
      },
    ];
  }
}

module.exports = PromptBuilder;
