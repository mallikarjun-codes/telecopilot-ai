'use strict';

const RagService = require('../../rag/services/rag.service');

class KnowledgeSearchTool {
  constructor(options = {}) {
    this.name = 'knowledge_search';
    this.description = 'Searches the authenticated user\'s TeleCopilot knowledge base.';
    this.ragService = options.ragService || new RagService();
  }

  execute({ userId, query }) {
    return this.ragService.retrieve(userId, query);
  }
}

module.exports = KnowledgeSearchTool;
