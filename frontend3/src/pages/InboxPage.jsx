
import React, { useState, useEffect, useRef } from 'react';
import EmailList from '../components/EmailList.jsx';
import EmailView from '../components/EmailView.jsx';

// Confirmation Dialog 
function DeleteConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <div style={dialogIconStyle}>🗑</div>
        <h3 style={dialogTitleStyle}>Delete this email?</h3>
        <p style={dialogBodyStyle}>
          This will remove the email from your inbox. This action cannot be undone.
        </p>
        <div style={dialogActionsStyle}>
          <button onClick={onCancel} style={cancelBtnStyle}>
            Cancel
          </button>
          <button onClick={onConfirm} style={confirmBtnStyle}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}


export default function InboxPage({
  emails,
  setEmails,           
  loading,
  error,
  onRefresh,
  classify,
  getSentiment,
  clearClassifyCache,
  categoryFilter,
  selectedEmail,
  setSelectedEmail,
}) {
  const [classifyCache, setClassifyCache]   = useState({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const pendingClassify = useRef(new Set());

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

  // ── Filter logic — handles AI categories AND manual label:id filters ──────
  const filteredEmails = emails.filter(em => {
    if (categoryFilter === 'All') return true;

    if (categoryFilter.startsWith('label:')) {
      const labelId = categoryFilter.replace('label:', '');
      try {
        const applied     = JSON.parse(localStorage.getItem('ms_applied')) ?? {};
        const emailLabels = applied[String(em.id)] ?? [];
        return emailLabels.includes(labelId);
      } catch { return false; }
    }

    return classifyCache[em.id]?.classify?.category === categoryFilter;
  });

  //Delete helpers 
  function handleDeleteClick() {
    if (!selectedEmail) return;
    setShowDeleteDialog(true);
  }

  function handleDeleteConfirm() {
    if (!selectedEmail) return;
    const deletedId    = selectedEmail.id;
    const currentIndex = filteredEmails.findIndex(e => e.id === deletedId);

    // Auto-advance: try next email, fall back to previous, else null
    const nextEmail =
      filteredEmails[currentIndex + 1] ??
      filteredEmails[currentIndex - 1] ??
      null;

    // Remove from parent emails array
    if (typeof setEmails === 'function') {
      setEmails(prev => prev.filter(em => em.id !== deletedId));
    }

    // Clean up classify cache
    setClassifyCache(prev => {
      const next = { ...prev };
      delete next[deletedId];
      return next;
    });
    pendingClassify.current.delete(deletedId);

    // Update selection
    setSelectedEmail(nextEmail);
    setShowDeleteDialog(false);
  }

  function handleDeleteCancel() {
    setShowDeleteDialog(false);
  }

  const getCached = (id) => classifyCache[id];

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%' }}>
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
              onRefresh={() => {
                clearClassifyCache();
                setClassifyCache({});
                onRefresh();
                pendingClassify.current.clear();
              }}
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
                  classifyData={selectedEmail  ? classifyCache[selectedEmail.id]?.classify  : null}
                  sentimentData={selectedEmail ? classifyCache[selectedEmail.id]?.sentiment : null}
                  onRefreshSentiment={handleRefreshSentiment}
                  onPrevEmail={onPrevEmail}
                  onNextEmail={onNextEmail}
                  onDeleteEmail={selectedEmail ? handleDeleteClick : null}
                />
              );
            })()}
          </>
        )}
      </div>

      {/* Confirmation dialog — rendered outside the flex layout so it overlays everything */}
      {showDeleteDialog && (
        <DeleteConfirmDialog
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const btnStyle = {
  padding: '8px 18px',
  background: 'var(--surface2)',
  border: '1px solid var(--b2)',
  borderRadius: 'var(--rad-sm)',
  color: 'var(--t2)',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  fontSize: 12.5,
  transition: 'all .2s ease',
};

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const dialogStyle = {
  background: 'var(--surface1, #1e1e1e)',
  border: '1px solid var(--b2, #333)',
  borderRadius: 'var(--rad, 12px)',
  padding: '32px 28px 24px',
  width: 340,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
};

const dialogIconStyle = {
  fontSize: 32,
  lineHeight: 1,
  marginBottom: 4,
};

const dialogTitleStyle = {
  margin: 0,
  fontFamily: 'var(--font)',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--t1, #fff)',
};

const dialogBodyStyle = {
  margin: 0,
  fontFamily: 'var(--font)',
  fontSize: 13,
  color: 'var(--t3, #888)',
  textAlign: 'center',
  lineHeight: 1.5,
};

const dialogActionsStyle = {
  display: 'flex',
  gap: 10,
  marginTop: 12,
  width: '100%',
};

const cancelBtnStyle = {
  flex: 1,
  padding: '9px 0',
  background: 'var(--surface2, #2a2a2a)',
  border: '1px solid var(--b2, #333)',
  borderRadius: 'var(--rad-sm, 8px)',
  color: 'var(--t2, #ccc)',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  fontSize: 13,
  fontWeight: 500,
  transition: 'all .15s ease',
};

const confirmBtnStyle = {
  flex: 1,
  padding: '9px 0',
  background: 'var(--maroon3, #c0392b)',
  border: '1px solid transparent',
  borderRadius: 'var(--rad-sm, 8px)',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  fontSize: 13,
  fontWeight: 600,
  transition: 'all .15s ease',
};