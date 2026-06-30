'use strict';

function toVectorLiteral(embedding) {
  if (!Array.isArray(embedding) || embedding.length === 0 || !embedding.every(Number.isFinite)) {
    throw new TypeError('A valid query embedding is required.');
  }
  return `[${embedding.join(',')}]`;
}

module.exports = { toVectorLiteral };
