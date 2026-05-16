/**
 * pages/InboxPage.jsx
 * Replaces Tab 1 (📬 Inbox) from Streamlit.
 * Orchestrates EmailList + EmailView + category filter + classify/sentiment.
 */
import React, { useState, useEffect, useRef } from 'react';
import EmailList from '../components/EmailList.jsx';
import EmailView from '../components/EmailView.jsx';
import { CategoryFilterBar } from '../components/CategoryBadge.jsx';

export default function InboxPage({ emails, loading, error, onRefresh, classify, getSentiment, clearClassifyCache }) {
  const [selectedEmail, setSelectedEmail]   = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [classifyCache, setClassifyCache]   = useState({});   // id → {classify, sentiment}
  const pendingClassify = useRef(new Set());

  // Select first email on load
  useEffect(() => {
    if (emails.length > 0 && !selectedEmail) {
      setSelectedEmail(emails[0]);
    }
  }, [emails]);

  // Classify + sentiment all visible emails
  useEffect(() => {
    emails.forEach(async (em) => {
      if (!em.id || pendingClassify.current.has(em.id)) return;
      if (classifyCache[em.id]?.classify) return;
      pendingClassify.current.add(em.id);
      try {
        const [clf, sent] = await Promise.all([classify(em), getSentiment(em)]);
        setClassifyCache(prev => ({
          ...prev,
          [em.id]: { classify: clf, sentiment: sent },
        }));
      } catch { /* ignore */ }
    });
  }, [emails]);

  // Refresh sentiment for selected email
  async function handleRefreshSentiment() {
    if (!selectedEmail?.id) return;
    const sent = await getSentiment(selectedEmail);
    setClassifyCache(prev => ({
      ...prev,
      [selectedEmail.id]: { ...prev[selectedEmail.id], sentiment: sent },
    }));
  }

  // Filter emails by category
  const filteredEmails = emails.filter(em => {
    if (categoryFilter === 'All') return true;
    return classifyCache[em.id]?.classify?.category === categoryFilter;
  });

  const getCached = (id) => classifyCache[id];

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
      {/* Category filter bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--b1)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--t4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Filter:</span>
        <CategoryFilterBar active={categoryFilter} onChange={cat => { setCategoryFilter(cat); }} />
        <button
          onClick={() => { clearClassifyCache(); setClassifyCache({}); onRefresh(); pendingClassify.current.clear(); }}
          style={{ marginLeft: 'auto', padding: '5px 12px', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 6, color: 'var(--t3)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'var(--font)' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Main layout: list + view */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t4)' }}>
            Loading emails…
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--crim3)', flexDirection: 'column', gap: 12 }}>
            <span>❌ {error}</span>
            <button onClick={onRefresh} style={btnStyle}>Retry</button>
          </div>
        ) : (
          <>
            <EmailList
              emails={filteredEmails}
              selectedId={selectedEmail?.id}
              onSelect={setSelectedEmail}
              classifyCache={getCached}
            />
            <EmailView
              email={selectedEmail}
              classifyData={selectedEmail ? classifyCache[selectedEmail.id]?.classify : null}
              sentimentData={selectedEmail ? classifyCache[selectedEmail.id]?.sentiment : null}
              onRefreshSentiment={handleRefreshSentiment}
            />
          </>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '8px 18px', background: 'var(--surface2)', border: '1px solid var(--b2)',
  borderRadius: 'var(--rad-sm)', color: 'var(--t2)', cursor: 'pointer',
  fontFamily: 'var(--font)', fontSize: 12.5,
};
