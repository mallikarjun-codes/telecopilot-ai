'use strict';

const INTENTS = Object.freeze({
  GENERAL_CHAT: 'GENERAL_CHAT',
  KNOWLEDGE_SEARCH: 'KNOWLEDGE_SEARCH',
  GREETING: 'GREETING',
  FOLLOW_UP: 'FOLLOW_UP',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
});

class IntentClassifier {
  classify(message, options = {}) {
    const text = message.trim().toLowerCase();
    if (/^(hi|hello|hey|good\s+(morning|afternoon|evening))[!.\s]*$/.test(text)) {
      return { intent: INTENTS.GREETING, confidence: 0.99 };
    }
    if (options.hasConversation && /^(continue|go on|tell me more|more|elaborate|what about (it|that)|and\??)[!.\s]*$/.test(text)) {
      return { intent: INTENTS.FOLLOW_UP, confidence: 0.92 };
    }
    if (/\b(refund|policy|procedure|document|handbook|knowledge base|company|our|internal|according to)\b/.test(text)) {
      return { intent: INTENTS.KNOWLEDGE_SEARCH, confidence: 0.9 };
    }
    if (/\b(weather|stock price|latest news|send (an )?email|calendar|schedule (a|an|my))\b/.test(text)) {
      return { intent: INTENTS.OUT_OF_SCOPE, confidence: 0.9 };
    }
    return { intent: INTENTS.GENERAL_CHAT, confidence: 0.75 };
  }
}

IntentClassifier.INTENTS = INTENTS;
module.exports = IntentClassifier;
