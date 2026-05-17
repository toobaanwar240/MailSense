/**
 * hooks/useClassify.js
 * Replaces Streamlit's:
 *   st.session_state.emails_classified = {}
 *   st.session_state.emails_sentiment  = {}
 * and the classify_email() / analyze_email_sentiment() helper functions.
 *
 * Caches results in memory (Map) so we only call the API once per email.
 */
import { useState, useCallback, useRef } from 'react';
import { classifyEmail as apiClassify, analyzeSentiment as apiSentiment } from '../api/client.js';

const FALLBACK_CLASSIFY = { category: 'unknown', confidence: 0, emoji: '⚪', all_scores: {} };
const FALLBACK_SENTIMENT = { sentiment: 'unknown', confidence: 0, emoji: '❓', explanation: '', tone_tags: [] };

export function useClassify() {
  const classifyCache  = useRef(new Map());
  const sentimentCache = useRef(new Map());

  // Force re-render when cache changes
  const [, rerender] = useState(0);
  const bump = () => rerender(n => n + 1);

  const classify = useCallback(async (email) => {
    const id = email?.id ?? '';
    if (id && classifyCache.current.has(id)) return classifyCache.current.get(id);

    try {
      const result = await apiClassify({
        subject: email.subject ?? '',
        body:    (email.body ?? email.snippet ?? '').slice(0, 500),
      });
      if (id) { classifyCache.current.set(id, result); bump(); }
      return result;
    } catch {
      return FALLBACK_CLASSIFY;
    }
  }, []);

  const getSentiment = useCallback(async (email) => {
    const id = email?.id ?? '';
    if (id && sentimentCache.current.has(id)) return sentimentCache.current.get(id);

    try {
      const result = await apiSentiment({
        subject: email.subject ?? '',
        body:    (email.body ?? email.snippet ?? '').slice(0, 1000),
      });
      if (id) { sentimentCache.current.set(id, result); bump(); }
      return result;
    } catch {
      return FALLBACK_SENTIMENT;
    }
  }, []);

  const invalidateSentiment = useCallback((emailId) => {
    sentimentCache.current.delete(emailId);
    bump();
  }, []);

  const clearAll = useCallback(() => {
    classifyCache.current.clear();
    sentimentCache.current.clear();
    bump();
  }, []);

  const getCached = (emailId) => ({
    classify:  classifyCache.current.get(emailId),
    sentiment: sentimentCache.current.get(emailId),
  });

  return { classify, getSentiment, invalidateSentiment, clearAll, getCached };
}
