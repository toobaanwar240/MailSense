/**
 * pages/InboxPage.jsx
 * Updated: lazy loads and caches separate data for All, Unread, and Read sub-tabs.
 * Persists classify and sentiment API results in localStorage to avoid rate limits on tab switch.
 * Uses classifyCacheRef to completely avoid async stale closure traps, ensuring zero redundant API calls.
 * Performs instant local loading followed by background Gmail sync on Refresh.
 * Handles both AI category filters AND manual label filters (label:id).
 */
import React, { useState, useEffect, useRef } from 'react';
import EmailList from '../components/EmailList.jsx';
import EmailView from '../components/EmailView.jsx';
import { getEmails } from '../api/client.js';



function DeleteConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 4 }}>🗑</div>
        <h3 style={{ margin: 0, fontFamily: 'var(--font)', fontSize: 16, fontWeight: 600, color: 'var(--t1, #fff)' }}>
          Delete this email?
        </h3>
        <p style={{ margin: 0, fontFamily: 'var(--font)', fontSize: 13, color: 'var(--t3, #888)', textAlign: 'center', lineHeight: 1.5 }}>
          This will remove the email from your inbox. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, width: '100%' }}>
          <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
          <button onClick={onConfirm} style={confirmBtnStyle}>Delete</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 9999,
};
const dialogStyle = {
  background: 'var(--surface1, #1e1e1e)', border: '1px solid var(--b2, #333)',
  borderRadius: 'var(--rad, 12px)', padding: '32px 28px 24px', width: 340,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
};
const cancelBtnStyle = {
  flex: 1, padding: '9px 0', background: 'var(--surface2, #2a2a2a)',
  border: '1px solid var(--b2, #333)', borderRadius: 'var(--rad-sm, 8px)',
  color: 'var(--t2, #ccc)', cursor: 'pointer', fontFamily: 'var(--font)',
  fontSize: 13, fontWeight: 500,
};
const confirmBtnStyle = {
  flex: 1, padding: '9px 0', background: 'var(--maroon3, #c0392b)',
  border: '1px solid transparent', borderRadius: 'var(--rad-sm, 8px)',
  color: '#fff', cursor: 'pointer', fontFamily: 'var(--font)',
  fontSize: 13, fontWeight: 600,
};

export default function InboxPage({
  emails: initialEmails, loading: initialLoading, error: initialError, onRefresh,
  classify, getSentiment, clearClassifyCache,
  categoryFilter, selectedEmail, setSelectedEmail,
  activeSubTab, setActiveSubTab
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Initialize classifyCache from localStorage on mount
  const [classifyCache, setClassifyCache] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ms_classify_cache') || '{}');
    } catch {
      return {};
    }
  });

  // Use a ref to always have the absolute latest cache values within async closure loops
  const classifyCacheRef = useRef(classifyCache);

  // Sync state changes to ref and localStorage
  useEffect(() => {
    classifyCacheRef.current = classifyCache;
    localStorage.setItem('ms_classify_cache', JSON.stringify(classifyCache));
  }, [classifyCache]);

  // Pre-add already-processed email IDs to pendingClassify ref on mount
  const pendingClassify = useRef(null);
  if (pendingClassify.current === null) {
    const ids = new Set();
    try {
      const cached = JSON.parse(localStorage.getItem('ms_classify_cache') || '{}');
      for (const id in cached) {
        if (cached[id]?.classify) {
          ids.add(Number(id));
          ids.add(String(id));
        }
      }
    } catch {}
    pendingClassify.current = ids;
  }

  // ── Sub-tabs states ──
  const [tabsData, setTabsData] = useState({
    all: null,
    unread: null,
    read: null,
  });
  const [tabsLoading, setTabsLoading] = useState({
    all: false,
    unread: false,
    read: false,
  });
  const [tabsError, setTabsError] = useState({
    all: null,
    unread: null,
    read: null,
  });

  // Lazy loading and caching fetch logic
  const fetchTabEmails = async (tabId, force = false) => {
    if (!force && tabsData[tabId] !== null) return;

    // Only show full loading spinner if we don't have any cached data for this tab yet
    const isInitialLoad = tabsData[tabId] === null;
    if (isInitialLoad) {
      setTabsLoading(prev => ({ ...prev, [tabId]: true }));
    }
    setTabsError(prev => ({ ...prev, [tabId]: null }));

    try {
      let data;
      if (tabId === 'all') {
        data = await getEmails({ limit: 500 });
      } else if (tabId === 'unread') {
        data = await getEmails({ limit: 100, is_read: false });
      } else if (tabId === 'read') {
        data = await getEmails({ limit: 100, is_read: true });
      }

      const fetchedEmails = data?.emails ?? [];
      setTabsData(prev => ({ ...prev, [tabId]: fetchedEmails }));
    } catch (err) {
      setTabsError(prev => ({ ...prev, [tabId]: err.message || 'Failed to fetch emails' }));
    } finally {
      if (isInitialLoad) {
        setTabsLoading(prev => ({ ...prev, [tabId]: false }));
      }
    }
  };

  useEffect(() => {
    fetchTabEmails(activeSubTab);
  }, [activeSubTab]);

  const activeEmails = tabsData[activeSubTab] ?? [];

  // Classify + sentiment all visible emails in the active tab with sequential rate-limiting
  useEffect(() => {
    let cancelled = false;
    
    async function processEmails() {
      for (const em of activeEmails) {
        if (cancelled) break;
        if (!em.id) continue;

        // Read from classifyCacheRef to bypass React stale closure traps during async waits
        const cached = classifyCacheRef.current[em.id];
        const hasClassify = !!cached?.classify;
        const hasSentiment = !!cached?.sentiment;

        // Skip completely if both classify and sentiment are already cached
        if (hasClassify && hasSentiment) {
          continue;
        }

        // Check if already in the pending set (unless it has classify but needs sentiment)
        if (pendingClassify.current.has(em.id)) {
          if (hasClassify && !hasSentiment) {
            // Needs sentiment processing, continue below
          } else {
            continue;
          }
        }
        
        pendingClassify.current.add(em.id);
        
        try {
          let currentClassify = cached?.classify;
          if (!currentClassify) {
            currentClassify = await classify(em);
            setClassifyCache(prev => ({
              ...prev,
              [em.id]: { ...prev[em.id], classify: currentClassify },
            }));
            
            // Wait 3 seconds before sentiment call
            await new Promise(r => setTimeout(r, 3000));
            if (cancelled) break;
          }
          
          let currentSentiment = cached?.sentiment;
          if (!currentSentiment) {
            currentSentiment = await getSentiment(em);
            setClassifyCache(prev => ({
              ...prev,
              [em.id]: { ...prev[em.id], sentiment: currentSentiment },
            }));
            
            // Wait 3 seconds before next email
            await new Promise(r => setTimeout(r, 3000));
          }
          
        } catch { }
      }
    }
    
    processEmails();
    return () => { cancelled = true; };
  }, [activeEmails]);

  // Refresh sentiment for selected email
  async function handleRefreshSentiment() {
    if (!selectedEmail?.id) return;
    const sent = await getSentiment(selectedEmail);
    setClassifyCache(prev => ({
      ...prev,
      [selectedEmail.id]: { ...prev[selectedEmail.id], sentiment: sent },
    }));
  }

  // ── Filter logic — handles AI categories AND manual label:id filters ──
  const filteredEmails = activeEmails.filter(em => {
    if (categoryFilter === 'All') return true;

    // Manual label filter — prefix is "label:{id}"
    if (categoryFilter.startsWith('label:')) {
      const labelId = categoryFilter.replace('label:', '');
      try {
        const applied = JSON.parse(localStorage.getItem('ms_applied')) ?? {};
        const emailLabels = applied[String(em.id)] ?? [];
        return emailLabels.includes(labelId);
      } catch { return false; }
    }

    // AI category filter
    return classifyCache[em.id]?.classify?.category === categoryFilter;
  });

  const getCached = (id) => classifyCache[id];

  // Refresh current sub-tab: instantly load database emails in 0.1s, then sync Gmail in background
  const handleRefresh = async () => {
    try {
      // 1. Instantly load already-saved emails in database (takes < 0.1s)
      await fetchTabEmails(activeSubTab, true);
      
      // 2. Call Gmail background sync (slow Gmail API call)
      if (onRefresh) {
        await onRefresh();
        
        // 3. Reload from database once Gmail sync is complete to show new emails
        await fetchTabEmails(activeSubTab, true);
      }
    } catch (err) {
      console.error("Failed to refresh inbox:", err);
    }
  };

  // Clear classify cache and localStorage
  const handleClearCache = () => {
    clearClassifyCache();
    localStorage.removeItem('ms_classify_cache');
    setClassifyCache({});
    classifyCacheRef.current = {};
    pendingClassify.current.clear();
  };
  
  function handleDeleteClick() {
  if (!selectedEmail) return;
  setShowDeleteDialog(true);
}

function handleDeleteConfirm() {
  if (!selectedEmail) return;
  const deletedId    = selectedEmail.id;
  const currentIndex = filteredEmails.findIndex(e => e.id === deletedId);
  const nextEmail    = filteredEmails[currentIndex + 1] ?? filteredEmails[currentIndex - 1] ?? null;

  // Remove from the active tab's data
  setTabsData(prev => ({
    ...prev,
    [activeSubTab]: (prev[activeSubTab] ?? []).filter(em => em.id !== deletedId),
  }));

  // Clean up classify cache
  setClassifyCache(prev => {
    const next = { ...prev };
    delete next[deletedId];
    return next;
  });
  pendingClassify.current.delete(deletedId);

  setSelectedEmail(nextEmail);
  setShowDeleteDialog(false);
}

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', minWidth: 0, minHeight: 0, height: '100%' }}>
        <EmailList
          emails={filteredEmails}
          selectedId={selectedEmail?.id}
          onSelect={setSelectedEmail}
          classifyCache={getCached}
          onRefresh={handleRefresh}
          onClearCache={handleClearCache}
          activeSubTab={activeSubTab}
          setActiveSubTab={setActiveSubTab}
          tabsLoading={tabsLoading}
          tabsData={tabsData}
          activeLoading={tabsLoading[activeSubTab]}
          activeError={tabsError[activeSubTab]}
        />

        {/* Panel separator */}
        <div style={{ width: 1, background: 'var(--b1)', alignSelf: 'stretch', flexShrink: 0 }} />

        {(() => {
          const currentIndex = filteredEmails.findIndex(e => e.id === selectedEmail?.id);
          const onPrevEmail  = currentIndex > 0
            ? () => setSelectedEmail(filteredEmails[currentIndex - 1])
            : null;
          const onNextEmail  = currentIndex < filteredEmails.length - 1
            ? () => setSelectedEmail(filteredEmails[currentIndex + 1])
            : null;
          return (
            <EmailView
              email={selectedEmail}
              classifyData={selectedEmail ? classifyCache[selectedEmail.id]?.classify   : null}
              sentimentData={selectedEmail ? classifyCache[selectedEmail.id]?.sentiment : null}
              onRefreshSentiment={handleRefreshSentiment}
              onPrevEmail={onPrevEmail}
              onNextEmail={onNextEmail}
              onDeleteEmail={selectedEmail ? handleDeleteClick : null}
            />
          );
        })()}
      </div>
      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <DeleteConfirmDialog
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}

const btnStyle = {
  padding: '8px 18px', background: 'var(--surface2)', border: '1px solid var(--b2)',
  borderRadius: 'var(--rad-sm)', color: 'var(--t2)', cursor: 'pointer',
  fontFamily: 'var(--font)', fontSize: 12.5, transition: 'all .2s ease',
};