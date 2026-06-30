'use strict';

const { chunkText } = require('../services/chunking.service');
const { cleanText } = require('../utils/text');

describe('chunkText', () => {
  it('creates overlapping chunks without splitting words', () => {
    const text = Array.from({ length: 300 }, (_, index) => `word${index}`).join(' ');
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.index)).toEqual(chunks.map((_, index) => index));
    expect(chunks.every((chunk) => chunk.content.length <= 110)).toBe(true);
    expect(chunks.every((chunk) => !chunk.content.startsWith(' ') && !chunk.content.endsWith(' '))).toBe(true);
    const firstWords = new Set(chunks[0].content.split(' '));
    expect(chunks[1].content.split(' ').some((word) => firstWords.has(word))).toBe(true);
  });

  it('returns no chunks for empty text and preserves paragraph breaks when cleaning', () => {
    expect(chunkText('   ')).toEqual([]);
    expect(cleanText(' First   line \n\n\n Second\tline ')).toBe('First line\n\nSecond line');
  });
});
