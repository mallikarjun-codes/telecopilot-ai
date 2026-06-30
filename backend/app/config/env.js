'use strict';

const dotenv = require('dotenv');

dotenv.config();

const defaults = {
  PORT: '5000',
  NODE_ENV: 'development',
};

const requiredKeys = [
  'PORT',
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
];

const missing = requiredKeys.filter((key) => {
  if (key === 'PORT' || key === 'NODE_ENV') {
    return !process.env[key] && !defaults[key];
  }

  return !process.env[key] || process.env[key].trim() === '';
});

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}.`
  );
}

const config = Object.freeze({
  port: Number.parseInt(process.env.PORT || defaults.PORT, 10),
  nodeEnv: process.env.NODE_ENV || defaults.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  embeddingApiKey: process.env.EMBEDDING_API_KEY,
  embeddingBaseUrl: process.env.EMBEDDING_BASE_URL,
  embeddingModel: process.env.EMBEDDING_MODEL,
  llmProvider: process.env.LLM_PROVIDER || 'openai-compatible',
  llmApiKey: process.env.LLM_API_KEY,
  llmBaseUrl: process.env.LLM_BASE_URL,
  llmModel: process.env.LLM_MODEL,
  llmTemperature: Number.parseFloat(process.env.LLM_TEMPERATURE || '0.2'),
  llmMaxTokens: Number.parseInt(process.env.LLM_MAX_TOKENS || '800', 10),
  ragTopK: Number.parseInt(process.env.RAG_TOP_K || '5', 10),
  ragSimilarityThreshold: Number.parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.7'),
  maxHistoryMessages: Number.parseInt(process.env.MAX_HISTORY_MESSAGES || '20', 10),
  autoTitleLength: Number.parseInt(process.env.AUTO_TITLE_LENGTH || '60', 10),
  maxConversationMessages: Number.parseInt(process.env.MAX_CONVERSATION_MESSAGES || '1000', 10),
  llmInputCostPerMillion: Number.parseFloat(process.env.LLM_INPUT_COST_PER_MILLION || '0'),
  llmOutputCostPerMillion: Number.parseFloat(process.env.LLM_OUTPUT_COST_PER_MILLION || '0'),
  agentMaxHistory: Number.parseInt(process.env.AGENT_MAX_HISTORY || '20', 10),
  agentMaxContextChunks: Number.parseInt(process.env.AGENT_MAX_CONTEXT_CHUNKS || '5', 10),
  agentMinConfidence: Number.parseFloat(process.env.AGENT_MIN_CONFIDENCE || '0.7'),
});

module.exports = config;
