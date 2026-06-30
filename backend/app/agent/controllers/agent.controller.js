'use strict';

const AgentService = require('../services/agent.service');
const AgentStreamService = require('../services/agent-stream.service');

const service = new AgentService();
const streamService = new AgentStreamService();

async function chat(req, res) {
  const result = await service.chat(req.user.id, req.body);
  return res.status(200).json({ success: true, data: result });
}

async function stream(req, res) {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const abortController = new AbortController();
  req.once('aborted', () => abortController.abort());
  res.once('close', () => {
    if (!res.writableEnded) abortController.abort();
  });
  const emit = (event, data) => {
    if (!abortController.signal.aborted && !res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };
  await streamService.stream(req.user.id, req.body, emit, abortController.signal);
  if (!res.writableEnded) res.end();
}

module.exports = { chat, stream };
