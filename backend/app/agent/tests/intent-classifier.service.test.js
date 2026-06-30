'use strict';

const IntentClassifier = require('../services/intent-classifier.service');

describe('IntentClassifier', () => {
  const classifier = new IntentClassifier();
  test.each([
    ['hello', false, 'GREETING'],
    ['What is our refund policy?', false, 'KNOWLEDGE_SEARCH'],
    ['thanks', false, 'GENERAL_CHAT'],
    ['continue', true, 'FOLLOW_UP'],
    ['what is the weather?', false, 'OUT_OF_SCOPE'],
  ])('classifies %s as %s', (message, hasConversation, expected) => {
    expect(classifier.classify(message, { hasConversation }).intent).toBe(expected);
  });
});
