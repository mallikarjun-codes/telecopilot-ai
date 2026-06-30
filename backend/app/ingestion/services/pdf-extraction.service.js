'use strict';

const fs = require('fs/promises');
const { PDFParse } = require('pdf-parse');
const { cleanText } = require('../utils/text');

async function extractPdfText(filePath) {
  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const text = cleanText(result.text);
    if (!text) throw new Error('PDF contains no extractable text.');
    return { text, pageCount: result.total || result.pages?.length || 0 };
  } catch (error) {
    const message = /password/i.test(error.message)
      ? 'Password-protected PDFs are not supported.'
      : `PDF text extraction failed: ${error.message}`;
    throw new Error(message);
  } finally {
    await parser.destroy().catch(() => {});
  }
}

module.exports = { extractPdfText };
