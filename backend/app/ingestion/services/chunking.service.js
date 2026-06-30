'use strict';

const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_OVERLAP = 175;

function findBoundary(text, desiredEnd, start) {
  if (desiredEnd >= text.length) return text.length;
  const minimum = Math.max(start + 1, desiredEnd - 150);
  for (let index = desiredEnd; index >= minimum; index -= 1) {
    if (/\s/.test(text[index])) return index;
  }
  const nextSpace = text.indexOf(' ', desiredEnd);
  return nextSpace === -1 ? text.length : nextSpace;
}

function chunkText(text, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new Error('Chunk size must be positive and overlap must be smaller than it.');
  }

  const input = String(text || '').trim();
  if (!input) return [];

  const chunks = [];
  let start = 0;
  while (start < input.length) {
    const end = findBoundary(input, start + chunkSize, start);
    const content = input.slice(start, end).trim();
    if (content) chunks.push({ index: chunks.length, content });
    if (end >= input.length) break;

    const overlapTarget = Math.max(start + 1, end - overlap);
    const precedingSpace = input.lastIndexOf(' ', overlapTarget);
    start = precedingSpace > start ? precedingSpace + 1 : overlapTarget;
  }

  return chunks;
}

module.exports = { chunkText, DEFAULT_CHUNK_SIZE, DEFAULT_OVERLAP };
