/**
 * hooks/useEmails.js
 * Replaces Streamlit's session_state.emails + fetch block in Tab 1.
 */
import { useState, useCallback } from 'react';
import { fetchEmails } from '../api/client.js';

export function useEmails() {
  const [emails, setEmails]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmails({ limit: 500 });
      setEmails(data.emails ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { emails, loading, error, refresh, setEmails };
}
