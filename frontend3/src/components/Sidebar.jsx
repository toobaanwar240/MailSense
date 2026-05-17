/**
 * components/Sidebar.jsx
 * Updated: manual localStorage labels shown under CATEGORY FILTER section.
 */
import React, { useState, useEffect } from 'react';
import { CategoryFilterBar } from './CategoryBadge.jsx';

const STATUS_UI = {
  idle:         { icon: '○', label: 'Not indexed' },
  indexing:     { icon: '◒', label: 'Indexing…'   },
  ready:        { icon: '●', label: 'Ready'        },
  error:        { icon: '⨯', label: 'Error'        },
  rate_limited: { icon: '⚠', label: 'Rate limited' },
};

const NAV = [
  { id: 'inbox',   label: 'Inbox'         },
  { id: 'chat',    label: 'RAG Chatbot'   },
  { id: 'search',  label: 'Search Results'},
  { id: 'compose', label: 'Compose'       },
];

// ─── Read manual labels from localStorage ─────────────────────────────────────
function loadManualLabels() {
  try {
    return JSON.parse(localStorage.getItem('ms_labels')) ?? [];
  } catch { return []; }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar({
  activeTab, onTabChange,
  ragStatus, indexedCount, dbTotal, lastChecked,
  onIndex, indexLoading,
  userEmail,
  categoryFilter, setCategoryFilter,
}) {
  const { icon, label } = STATUS_UI[ragStatus] ?? STATUS_UI.idle;

  // Re-read manual labels whenever user comes back to the sidebar
  const [manualLabels, setManualLabels] = useState(loadManualLabels);

  // Refresh labels on mouse enter so newly created labels appear instantly
  function refreshLabels() {
    setManualLabels(loadManualLabels());
  }

  // Also sync on storage events from other tabs
  useEffect(() => {
    const handler = () => setManualLabels(loadManualLabels());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Delete a manual label (removes definition + clears from all emails)
  function deleteLabel(labelId, e) {
    e.stopPropagation();
    try {
      // Remove from label definitions
      const labels  = loadManualLabels().filter(l => l.id !== labelId);
      localStorage.setItem('ms_labels', JSON.stringify(labels));

      // Remove from all applied email labels
      const applied = JSON.parse(localStorage.getItem('ms_applied')) ?? {};
      Object.keys(applied).forEach(emailId => {
        applied[emailId] = applied[emailId].filter(id => id !== labelId);
      });
      localStorage.setItem('ms_applied', JSON.stringify(applied));

      setManualLabels(labels);

      // Reset filter if the deleted label was active
      if (categoryFilter === `label:${labelId}`) {
        setCategoryFilter('All');
      }
    } catch { /* ignore */ }
  }

  return (
    <aside style={styles.sb} className="no-scrollbar" onMouseEnter={refreshLabels}>
      {/* Glow line */}
      <div style={styles.glowLine} />

      {/* Top — logo + compose */}
      <div style={styles.top}>
        <div style={styles.logoRow}>
          <div style={styles.logoMark}>
            <svg viewBox="0 0 16 16" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" width={16} height={16}>
              <path d="M1.5 5l6.5 4.5L14.5 5"/>
              <rect x="1.5" y="3.5" width="13" height="9" rx="2"/>
            </svg>
          </div>
          <span style={styles.logoName}>Mail<span style={{ color: 'var(--maroon3)' }}>Sense</span></span>
        </div>
        <button style={styles.composeBtn} onClick={() => onTabChange('compose')}>
          Compose
        </button>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        <div style={styles.navSec}>MAILBOX</div>
        {NAV.map(item => (
          <div
            key={item.id}
            style={{ ...styles.navItem, ...(activeTab === item.id ? styles.navActive : {}) }}
            onClick={() => onTabChange(item.id)}
          >
            <NavIcon id={item.id} />
            <span style={styles.navLbl}>{item.label}</span>
          </div>
        ))}
      </nav>

      {/* ── AI Category Filters ── */}
      <div style={{ padding: '0 16px 8px' }}>
        <div style={{ ...styles.navSec, padding: '8px 4px' }}>CATEGORY FILTER</div>
        <CategoryFilterBar
          active={categoryFilter}
          onChange={setCategoryFilter}
          vertical={true}
        />
      </div>

      {/* ── Manual Labels Section ── */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ ...styles.navSec, padding: '8px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>MY LABELS</span>
          {manualLabels.length > 0 && (
            <span style={{ fontSize: 9, color: 'var(--t4)', fontWeight: 500, letterSpacing: 0 }}>
              {manualLabels.length} label{manualLabels.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {manualLabels.length === 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--t4)', padding: '6px 4px', fontStyle: 'italic' }}>
            No labels yet — add them in an email.
          </div>
        )}

        {/* "All Emails" reset when a label filter is active */}
        {categoryFilter.startsWith('label:') && (
          <button
            style={{ ...styles.labelBtn, marginBottom: 4, color: 'var(--t3)', borderColor: 'var(--b2)' }}
            onClick={() => setCategoryFilter('All')}
          >
            ← All Emails
          </button>
        )}

        {manualLabels.map(label => {
          const isActive = categoryFilter === `label:${label.id}`;
          return (
            <button
              key={label.id}
              style={{
                ...styles.labelBtn,
                background:  isActive ? label.color + '22' : 'transparent',
                border:      `1px solid ${isActive ? label.color + '88' : 'var(--b1)'}`,
                color:       isActive ? label.color : 'var(--t3)',
                borderLeft:  `3px solid ${label.color}`,
              }}
              onClick={() => setCategoryFilter(isActive ? 'All' : `label:${label.id}`)}
            >
              {/* Colored dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: label.color, flexShrink: 0,
              }} />

              {/* Label name */}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label.name}
              </span>

              {/* Delete × */}
              <span
                onClick={(e) => deleteLabel(label.id, e)}
                title="Delete label"
                style={{
                  fontSize: 14, lineHeight: 1, opacity: 0.45,
                  cursor: 'pointer', flexShrink: 0,
                  transition: 'opacity .15s',
                  paddingLeft: 4,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.45}
              >
                ×
              </span>
            </button>
          );
        })}
      </div>

      {/* User */}
      <div style={styles.userSection}>
        <div style={{ ...styles.user, width: '100%', minWidth: 0 }}>
          <div style={styles.avatar}>{(userEmail?.[0] ?? 'U').toUpperCase()}</div>
          <div style={{ overflowX: 'auto', minWidth: 0, flex: 1 }} className="no-scrollbar">
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--t2)', whiteSpace: 'nowrap' }}>
              {userEmail ?? 'User'}
            </div>
            <div
              style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2, cursor: 'pointer', transition: 'color .2s', whiteSpace: 'nowrap' }}
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              onMouseEnter={e => e.target.style.color = 'var(--maroon3)'}
              onMouseLeave={e => e.target.style.color = 'var(--t4)'}
            >
              Sign out
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Nav icons ────────────────────────────────────────────────────────────────
function NavIcon({ id }) {
  const icons = {
    inbox:   <path d="M1.5 5l6.5 4.5L14.5 5"/>,
    chat:    <><rect x="1" y="1.5" width="14" height="9" rx="2"/><path d="M4.5 14.5l2.5-4h6"/></>,
    search:  <><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></>,
    compose: <path d="M2 8h8M7 5l3 3-3 3M10 8h4"/>,
  };
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      {icons[id]}
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  sb: {
    width: 210,
    background: 'var(--surface)',
    borderRight: '1px solid var(--b1)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    position: 'relative',
    zIndex: 20,
  },
  glowLine: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 2,
    background: 'linear-gradient(180deg,transparent 0%,var(--maroon-glow) 40%,var(--maroon-glow) 70%,transparent 100%)',
    pointerEvents: 'none',
  },
  top: { padding: '24px 20px 20px', borderBottom: '1px solid var(--b1)' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  logoMark: {
    width: 36, height: 36,
    background: 'linear-gradient(135deg, var(--maroon3), var(--maroon))',
    borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: '0 4px 12px var(--maroon-glow)',
  },
  logoName: { fontSize: 18, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--t1)' },
  composeBtn: {
    width: '100%', padding: '12px 16px',
    background: 'linear-gradient(135deg, var(--maroon), var(--maroon3))',
    color: '#FFF', border: 'none',
    borderRadius: 'var(--rad)', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex',
    alignItems: 'center', gap: 10, justifyContent: 'center', transition: 'all .2s',
    boxShadow: '0 4px 12px var(--maroon-glow)',
  },
  nav: { padding: '16px 0' },
  navSec: {
    padding: '8px 20px', fontSize: 10, fontWeight: 700,
    color: 'var(--t4)', letterSpacing: '.12em', textTransform: 'uppercase',
  },
  navItem: {
    display: 'flex', alignItems: 'center', padding: '14px 22px',
    cursor: 'pointer', color: 'var(--t3)', fontSize: 14.5, gap: 14,
    transition: 'all .2s ease', borderLeft: '4px solid transparent',
    borderRadius: 'var(--rad-sm)', margin: '4px 10px',
  },
  navActive: {
    background: 'linear-gradient(135deg, #F1F3F5 0%, #CFD4DA 100%)',
    color: '#800020', borderLeft: '4px solid #800020',
    boxShadow: '0 4px 15px rgba(0,0,0,.15)',
  },
  navLbl: { flex: 1, fontWeight: 600 },

  // Manual label buttons
  labelBtn: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: 'var(--rad-sm)',
    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--font)', transition: 'all .15s ease',
    marginBottom: 4, textAlign: 'left',
  },

  userSection: {
    marginTop: 'auto', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '16px 20px',
    borderTop: '1px solid var(--b1)', background: 'var(--surface2)',
  },
  user: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--slate), var(--slate2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, color: '#fff',
    border: '2px solid var(--b2)', flexShrink: 0,
  },
};