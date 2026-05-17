/**
 * hooks/useRagStatus.js
 * Replaces Streamlit's fetch_rag_status() + auto-rerun while indexing.
 *
 * Streamlit used st.rerun() to poll every ~0.5s while status === 'indexing'.
 * React uses setInterval instead.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchRagStatus, fetchRagAdminStatus, triggerIndex as apiTriggerIndex } from '../api/client.js';

export function useRagStatus() {
  const [status, setStatus]         = useState('idle');
  const [indexedCount, setIndexed]  = useState(0);
  const [dbTotal, setDbTotal]       = useState(0);
  const [lastChecked, setLastChecked] = useState(null);
  const [loading, setLoading]       = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchRagStatus();
      setStatus(data.status ?? 'idle');
      setIndexed(data.indexed_emails ?? 0);
      setLastChecked(new Date().toLocaleTimeString());
    } catch { /* silent */ }

    try {
      const admin = await fetchRagAdminStatus();
      setDbTotal(admin?.database?.total_emails ?? 0);
    } catch { /* silent */ }
  }, []);

  const triggerIndex = useCallback(async () => {
    setLoading(true);
    try {
      await apiTriggerIndex();
      setStatus('indexing');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll while indexing (matches Streamlit's 0.5s sleep + rerun)
  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (status === 'indexing') refresh();
    }, 1500);
    return () => clearInterval(interval);
  }, [status, refresh]);

  return { status, indexedCount, dbTotal, lastChecked, loading, refresh, triggerIndex };
}
