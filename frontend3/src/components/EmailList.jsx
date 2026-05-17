/**
 * components/EmailList.jsx
 * Inbox list sidebar featuring high-visibility color-coded sentiment pills.
 * Updated: manual localStorage labels displayed on each email row.
 */
import React, { useState, useEffect } from 'react';

// ─── localStorage label helpers (same keys as EmailView's LabelPanel) ─────────
const LABELS_KEY  = 'ms_labels';
const APPLIED_KEY = 'ms_applied';

function getEmailLabels(emailId) {
  try {
    const labels  = JSON.parse(localStorage.getItem(LABELS_KEY))  ?? [];
    const applied = JSON.parse(localStorage.getItem(APPLIED_KEY)) ?? {};
    const ids     = applied[String(emailId)] ?? [];
    return labels.filter(l => ids.includes(l.id));
  } catch { return []; }
}

// ─── Sentiment style helper ───────────────────────────────────────────────────
const getSentimentStyle = (sentiment) => {
  const s = sentiment?.toLowerCase();
  if (s === 'positive') {
    return {
      background:  'rgba(40, 167, 69, 0.15)',
      color:       '#28A745',
      borderColor: 'rgba(40, 167, 69, 0.3)',
      emoji:       '😊'
    };
  } else if (s === 'negative') {
    return {
      background:  'rgba(220, 53, 69, 0.15)',
      color:       '#DC3545',
      borderColor: 'rgba(220, 53, 69, 0.3)',
      emoji:       '😡'
    };
  } else {
    return {
      background:  'rgba(108, 117, 125, 0.15)',
      color:       'var(--t2)',
      borderColor: 'rgba(108, 117, 125, 0.3)',
      emoji:       '😐'
    };
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function EmailList({ emails, selectedId, onSelect, classifyCache, onRefresh }) {
  const [search, setSearch]   = useState('');

  // Force re-render when user moves mouse back into the list
  // so labels added in EmailView appear immediately
  const [, rerender] = useState(0);

  // Also listen for storage events from other tabs
  useEffect(() => {
    const handler = () => rerender(n => n + 1);
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const filtered = emails.filter(em => {
    const s = search.toLowerCase();
    return !s ||
      em.subject?.toLowerCase().includes(s) ||
      em.sender?.toLowerCase().includes(s) ||
      em.snippet?.toLowerCase().includes(s);
  });

  return (
    <div
      style={styles.wrap}
      className="glass"
      onMouseEnter={() => rerender(n => n + 1)}
    >
      {/* ── Header ── */}
      <div style={styles.head}>
        <span style={styles.title}>Inbox</span>
        <span style={styles.badge}>{emails.filter(e => !e.is_read).length} unread</span>
        {onRefresh && (
          <button style={styles.refreshTxtBtn} onClick={onRefresh}>
            Refresh
          </button>
        )}
      </div>

      {/* ── Search ── */}
      <div style={styles.searchWrap}>
        <svg style={styles.searchIcon} viewBox="0 0 13 13" fill="none" stroke="var(--t4)" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="5.5" cy="5.5" r="3.5"/>
          <path d="M8.5 8.5l2.5 2.5"/>
        </svg>
        <input
          style={styles.searchInput}
          placeholder="Search emails…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={styles.clearSearch}
          >×</button>
        )}
      </div>

      {/* ── List ── */}
      <div style={styles.list}>
        {filtered.length === 0 && (
          <div style={{ padding: 30, color: 'var(--t4)', textAlign: 'center', fontSize: 13 }}>
            No emails found.
          </div>
        )}

        {filtered.map((em) => {
          const cached    = classifyCache?.(em.id);
          const sentiment = cached?.sentiment?.sentiment ?? 'neutral';
          const isActive  = em.id === selectedId;
          const summary   = cached?.classify?.summary ?? cached?.summary ?? '';
          const caption   = cached?.classify?.caption ?? cached?.caption ?? '';

          // Manual labels from localStorage
          const manualLabels = getEmailLabels(em.id);

          return (
            <div
              key={em.id}
              style={{
                ...styles.item,
                ...(isActive  ? styles.itemActive : {}),
                ...(em.is_read ? styles.itemRead   : {}),
              }}
              className="email-card"
              onClick={() => onSelect(em)}
            >
              {/* Row 1 — sender + date */}
              <div style={styles.r1}>
                <div style={{ ...styles.udot, ...(em.is_read ? styles.udotRead : {}) }} />
                <span
                  style={{ ...styles.sender, ...(em.is_read ? styles.senderRead : {}) }}
                  className="truncate"
                >
                  {em.sender?.split('<')[0]?.trim() ?? 'Unknown'}
                </span>
                <span style={styles.time}>{formatDate(em.date)}</span>
              </div>

              {/* Row 2 — subject */}
              <div
                style={{ ...styles.subj, ...(em.is_read ? styles.subjRead : {}) }}
                className="email-list-subject truncate"
              >
                {em.subject ?? '(no subject)'}
              </div>

              {/* Row 3 — AI summary (if available) */}
              {summary && (
                <div style={styles.summaryLine} className="truncate">
                   {summary}
                </div>
              )}

              {/* Row 4 — snippet */}
              <div style={styles.prev} className="truncate">
                {em.snippet ?? ''}
              </div>

              {/* Row 5 — tags */}
              <div style={styles.tags}>

                {/* ── Manual labels (localStorage) ── */}
                {manualLabels.slice(0, 2).map(label => (
                  <span key={label.id} style={{
                    display:     'inline-flex',
                    alignItems:  'center',
                    gap:          4,
                    padding:     '3px 8px',
                    borderRadius: 10,
                    background:   label.color + '22',
                    border:      `1px solid ${label.color}44`,
                    color:        label.color,
                    fontSize:     10.5,
                    fontWeight:   700,
                    flexShrink:   0,
                  }}>
                     {label.name}
                  </span>
                ))}

                {/* +N overflow badge */}
                {manualLabels.length > 2 && (
                  <span style={{
                    fontSize:   10.5,
                    color:      'var(--t4)',
                    fontWeight:  600,
                    flexShrink:  0,
                  }}>
                    +{manualLabels.length - 2}
                  </span>
                )}

                {/* ── AI category tag ── */}
                {cached?.classify?.category && cached.classify.category !== 'unknown' && (
                  <span className={`tag cat-${cached.classify.category}`}>
                    {cached.classify.category.replace(/_/g, ' ')}
                  </span>
                )}

                {/* ── AI caption tag ── */}
                {caption && (
                  <span className="tag" style={{
                    background: 'var(--maroon-dim)',
                    color:      'var(--maroon3)',
                    border:     '1px solid var(--b2)',
                  }}>
                     {caption}
                  </span>
                )}

                {/* ── Sentiment pill ── */}
                {(() => {
                  const sInfo = getSentimentStyle(sentiment);
                  return (
                    <span style={{
                      background:   sInfo.background,
                      color:        sInfo.color,
                      borderColor:  sInfo.borderColor,
                      fontSize:    '12px',
                      padding:     '4px 10px',
                      borderRadius: '12px',
                      border:       '1px solid',
                      display:      'inline-flex',
                      alignItems:   'center',
                      gap:          '6px',
                      fontWeight:   '600',
                      boxShadow:    '0 2px 6px rgba(0,0,0,0.05)',
                      flexShrink:    0,
                    }}>
                      <span style={{ fontSize: '14px' }}>{sInfo.emoji}</span>
                      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                    </span>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.split(',').pop()?.trim() ?? dateStr;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  wrap: {
    width: 340, borderRight: '1px solid var(--b1)',
    display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 5,
  },
  head: {
    padding: '20px', borderBottom: '1px solid var(--b1)',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  title: {
    fontSize: 18, fontWeight: 700, color: 'var(--t1)',
    flex: 1, letterSpacing: '-.02em',
  },
  badge: {
    fontSize: 11, fontWeight: 600, padding: '4px 10px',
    borderRadius: 12, background: 'var(--maroon-dim)', color: 'var(--maroon3)',
  },
  refreshTxtBtn: {
    background: 'transparent', border: '1px solid var(--b2)',
    borderRadius: 'var(--rad-xs)', padding: '4px 10px',
    fontSize: 12, fontWeight: 600, color: 'var(--t2)',
    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s',
  },

  // Search bar
  searchWrap: {
    padding: '10px 14px', borderBottom: '1px solid var(--b1)',
    position: 'relative', display: 'flex', alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute', left: 24, width: 13, height: 13, flexShrink: 0,
  },
  searchInput: {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--b1)',
    borderRadius: 'var(--rad-sm)', padding: '8px 28px 8px 30px',
    fontSize: 12.5, color: 'var(--t2)', fontFamily: 'var(--font)', outline: 'none',
  },
  clearSearch: {
    position: 'absolute', right: 20, background: 'transparent',
    border: 'none', color: 'var(--t4)', fontSize: 16,
    cursor: 'pointer', lineHeight: 1, padding: 0,
  },

  // List
  list: { flex: 1, overflowY: 'auto' },
  item: {
    padding: '16px 20px', borderBottom: '1px solid var(--b1)',
    cursor: 'pointer', transition: 'all .2s ease', position: 'relative',
  },
  itemActive: {
    background: 'var(--surface2)', borderLeft: '4px solid var(--maroon3)', paddingLeft: 16,
  },
  itemRead: { opacity: 0.8 },

  // Row elements
  r1: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  udot: {
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--maroon3)', flexShrink: 0,
    boxShadow: '0 0 6px var(--maroon-glow)',
  },
  udotRead: { background: 'transparent', boxShadow: 'none' },
  sender: {
    fontSize: 14, fontWeight: 800, flex: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t1)',
  },
  senderRead: { fontWeight: 700, color: 'var(--t2)' },
  time: { fontSize: 11.5, color: 'var(--t4)', flexShrink: 0 },
  subj: {
    fontSize: 13, color: 'var(--t1)', marginBottom: 4,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600,
  },
  subjRead: { fontWeight: 400, color: 'var(--t3)' },
  summaryLine: {
    fontSize: 12, color: 'var(--maroon3)', fontStyle: 'italic',
    marginBottom: 4, fontWeight: 500,
  },
  prev: {
    fontSize: 12.5, color: 'var(--t4)', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4, marginBottom: 4,
  },
  tags: {
    display: 'flex', gap: 6, marginTop: 10,
    alignItems: 'center', flexWrap: 'wrap',
  },
};