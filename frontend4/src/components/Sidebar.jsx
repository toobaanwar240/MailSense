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
  activeSubTab, setActiveSubTab,
  emails = [],
  ragStatus, indexedCount, dbTotal, lastChecked,
  onIndex, indexLoading,
  userEmail,
  categoryFilter, setCategoryFilter,
}) {
  const { icon, label } = STATUS_UI[ragStatus] ?? STATUS_UI.idle;

  // Re-read manual labels whenever user comes back to the sidebar
  const [manualLabels, setManualLabels] = useState(loadManualLabels);

  const [inboxExpanded, setInboxExpanded] = useState(true);

  const allCount = emails.length;
  const unreadCount = emails.filter(e => !e.is_read).length;
  const readCount = emails.filter(e => e.is_read).length;

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
        
        {/* Inbox Collapsible Shutter Item */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{ 
              ...styles.navItem, 
              ...(activeTab === 'inbox' ? styles.navActive : {}),
              marginBottom: inboxExpanded ? 4 : 8 
            }}
            onClick={() => {
              onTabChange('inbox');
              setInboxExpanded(!inboxExpanded);
            }}
          >
            <NavIcon id="inbox" />
            <span style={styles.navLbl}>Inbox</span>
            <span style={{ 
              fontSize: 10, 
              transform: inboxExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', 
              transition: 'transform 0.2s', 
              color: activeTab === 'inbox' ? '#800020' : 'var(--t4)',
              display: 'inline-block',
              marginLeft: 'auto'
            }}>
              ▼
            </span>
          </div>

          {/* Collapsible Sub-items enclosed in a small box card */}
          {inboxExpanded && (
            <div style={styles.subItemsBox}>
              <div
                style={{ ...styles.subItem, ...(activeTab === 'inbox' && activeSubTab === 'all' ? styles.subItemActive : {}) }}
                onClick={() => {
                  onTabChange('inbox');
                  setActiveSubTab('all');
                }}
              >
                <span style={styles.subItemDot}>○</span>
                <span style={styles.subItemLbl}>All</span>
              </div>
              <div
                style={{ ...styles.subItem, ...(activeTab === 'inbox' && activeSubTab === 'unread' ? styles.subItemActive : {}) }}
                onClick={() => {
                  onTabChange('inbox');
                  setActiveSubTab('unread');
                }}
              >
                <span style={{ ...styles.subItemDot, color: 'var(--maroon3)' }}>●</span>
                <span style={styles.subItemLbl}>Unread</span>
              </div>
              <div
                style={{ ...styles.subItem, ...(activeTab === 'inbox' && activeSubTab === 'read' ? styles.subItemActive : {}) }}
                onClick={() => {
                  onTabChange('inbox');
                  setActiveSubTab('read');
                }}
              >
                <span style={{ ...styles.subItemDot, opacity: 0.5 }}>●</span>
                <span style={styles.subItemLbl}>Read</span>
              </div>
            </div>
          )}
        </div>

        {/* Separator line 1 */}
        <hr style={styles.divider} />

        {/* RAG Chatbot */}
        <div
          style={{ ...styles.navItem, ...(activeTab === 'chat' ? styles.navActive : {}) }}
          onClick={() => onTabChange('chat')}
        >
          <NavIcon id="chat" />
          <span style={styles.navLbl}>RAG Chatbot</span>
        </div>

        {/* Separator line 2 */}
        <hr style={styles.divider} />

        {/* Search Results */}
        <div
          style={{ ...styles.navItem, ...(activeTab === 'search' ? styles.navActive : {}) }}
          onClick={() => onTabChange('search')}
        >
          <NavIcon id="search" />
          <span style={styles.navLbl}>Search Results</span>
        </div>

        {/* Separator line 3 */}
        <hr style={styles.divider} />

        {/* Compose */}
        <div
          style={{ ...styles.navItem, ...(activeTab === 'compose' ? styles.navActive : {}) }}
          onClick={() => onTabChange('compose')}
        >
          <NavIcon id="compose" />
          <span style={styles.navLbl}>Compose</span>
        </div>
      </nav>
      {/* ── AI Category Filters ── */}
      <div style={{ padding: '24px 16px 8px' }}>
        <div style={{ ...styles.navSec, padding: '8px 4px' }}>CATEGORY FILTER</div>
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--b1)',
          borderRadius: 'var(--rad)',
          padding: '10px',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <CategoryFilterBar
            active={categoryFilter}
            onChange={setCategoryFilter}
            vertical={true}
          />
        </div>
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



        {manualLabels.map(label => {
          const isActive = categoryFilter === `label:${label.id}`;
          return (
            <button
              key={label.id}
              style={{
                ...styles.labelBtn,
                padding: '6px 10px',
                borderRadius: 'var(--rad)',
                border: `1px solid ${isActive ? '#800020' : 'var(--b2)'}`,
                background: isActive ? 'linear-gradient(135deg, #F1F3F5 0%, #CFD4DA 100%)' : 'var(--surface2)',
                color: isActive ? '#800020' : 'var(--t2)',
                fontSize: 11,
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                transition: 'all .2s ease',
                textAlign: 'left',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
                boxShadow: isActive ? '0 2px 8px var(--maroon-glow)' : 'none',
              }}
              onClick={() => setCategoryFilter(isActive ? 'All' : `label:${label.id}`)}
            >
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
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={13.5} height={13.5}>
      {icons[id]}
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  sb: {
    width: 210,
    background: 'var(--surface)',
    borderRight: '1px solid var(--b2)',
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
  navBox: {
    background: 'linear-gradient(135deg, #1A0207, #0C0003)',
    border: '1px solid rgba(255,255,255,0.03)',
    borderRadius: '10px',
    padding: '11px 16px',
    margin: '8px auto',
    width: '178px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '550',
    fontSize: '13.5px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'all 0.25s ease',
    boxSizing: 'border-box',
  },
  navBoxActive: {
    background: 'linear-gradient(135deg, #3A000A, #1F0004)',
    border: '1px solid rgba(128,0,32,0.3)',
    color: '#FFFFFF',
    boxShadow: '0 4px 12px rgba(74,0,18,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
    transform: 'translateY(-0.5px)',
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

  subItemsBox: {
    background: 'var(--bg2)',
    border: '1px solid var(--b1)',
    borderRadius: 'var(--rad)',
    padding: '8px',
    margin: '4px 10px 8px',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
  },
  divider: {
    border: 'none',
    height: '1px',
    background: 'var(--b1)',
    margin: '6px 10px',
    opacity: 0.8,
  },
  subItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px 8px 16px',
    cursor: 'pointer',
    color: 'var(--t3)',
    fontSize: 13,
    gap: 10,
    borderRadius: 'var(--rad-sm)',
    transition: 'all 0.15s ease',
    margin: '2px 4px',
  },
  subItemActive: {
    background: 'var(--maroon-dim)',
    color: 'var(--maroon3)',
    fontWeight: 650,
  },
  subItemDot: {
    fontSize: 10.5,
    width: 12,
    textAlign: 'center',
    fontWeight: 700,
  },
  subItemLbl: {
    flex: 1,
  },
  subItemCount: {
    fontSize: 10.5,
    color: 'var(--t4)',
    background: 'var(--surface2)',
    padding: '2px 6px',
    borderRadius: 8,
    minWidth: 20,
    textAlign: 'center',
    fontWeight: 600,
  },

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