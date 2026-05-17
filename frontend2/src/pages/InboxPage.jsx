/**
 * pages/InboxPage.jsx
 * Replaces Tab 1 (📬 Inbox) from Streamlit.
 * Orchestrates EmailList + EmailView + category filter + classify/sentiment.
 */
import React, { useState, useEffect, useRef } from 'react';
import EmailList from '../components/EmailList.jsx';
import EmailView from '../components/EmailView.jsx';

export default function InboxPage({ emails, loading, error, onRefresh, classify, getSentiment, clearClassifyCache, categoryFilter }) {
  const [selectedEmail, setSelectedEmail]   = useState(null);
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
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%' }}>
      {/* Main layout: list + view */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', minWidth: 0, minHeight: 0, height: '100%' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t4)' }}>
            Loading emails…
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--maroon3)', flexDirection: 'column', gap: 12 }}>
            <span>Error: {error}</span>
            <button onClick={onRefresh} style={btnStyle}>Retry</button>
          </div>
        ) : (
          <>
            <EmailList
              emails={filteredEmails}
              selectedId={selectedEmail?.id}
              onSelect={setSelectedEmail}
              classifyCache={getCached}
              onRefresh={() => { clearClassifyCache(); setClassifyCache({}); onRefresh(); pendingClassify.current.clear(); }}
            />
            
            {/* Elegant Panel Separator */}
            <div style={{
              width: '1px',
              background: 'var(--b1)',
              alignSelf: 'stretch',
              flexShrink: 0
            }} />

            {(() => {
              const currentIndex = filteredEmails.findIndex(e => e.id === selectedEmail?.id);
              const onPrevEmail = currentIndex > 0 ? () => setSelectedEmail(filteredEmails[currentIndex - 1]) : null;
              const onNextEmail = currentIndex < filteredEmails.length - 1 ? () => setSelectedEmail(filteredEmails[currentIndex + 1]) : null;
              return (
                <EmailView
                  email={selectedEmail}
                  classifyData={selectedEmail ? classifyCache[selectedEmail.id]?.classify : null}
                  sentimentData={selectedEmail ? classifyCache[selectedEmail.id]?.sentiment : null}
                  onRefreshSentiment={handleRefreshSentiment}
                  onPrevEmail={onPrevEmail}
                  onNextEmail={onNextEmail}
                />
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '8px 18px', background: 'var(--surface2)', border: '1px solid var(--b2)',
  borderRadius: 'var(--rad-sm)', color: 'var(--t2)', cursor: 'pointer',
  fontFamily: 'var(--font)', fontSize: 12.5, transition: 'all .2s ease'
};
