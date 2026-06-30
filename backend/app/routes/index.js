'use strict';

const express = require('express');

const authRoutes = require('../auth/routes/auth.routes');
const healthRoutes = require('../health/routes/health.routes');
const knowledgeRoutes = require('../knowledge/routes/knowledge.routes');
const ragRoutes = require('../rag/routes/rag.routes');
const conversationRoutes = require('../conversations/routes/conversation.routes');
const agentRoutes = require('../agent/routes/agent.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/chat', ragRoutes);
router.use('/conversations', conversationRoutes);
router.use('/agent', agentRoutes);

module.exports = router;
