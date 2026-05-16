/**
 * components/Sidebar.jsx
 * Matches the .sb sidebar from mailsense_premium.html
 */
import React from 'react';

const STATUS_UI = {
  idle:         { icon: '⚪', label: 'Not indexed' },
  indexing:     { icon: '🟡', label: 'Indexing…'   },
  ready:        { icon: '🟢', label: 'Ready'        },
  error:        { icon: '🔴', label: 'Error'        },
  rate_limited: { icon: '🟠', label: 'Rate limited' },
};

const NAV = [
  { id: 'inbox',   label: 'Inbox',          count: null,   countClass: 'hi' },
  { id: 'chat',    label: 'RAG Chatbot',     count: null,   countClass: '' },
  { id: 'search',  label: 'Search Results',  count: null,   countClass: '' },
  { id: 'compose', label: 'Compose',         count: null,   countClass: '' },
];

export default function Sidebar({ activeTab, onTabChange, ragStatus, indexedCount, dbTotal, lastChecked, onIndex, indexLoading, userEmail }) {
  const { icon, label } = STATUS_UI[ragStatus] ?? STATUS_UI.idle;

  return (
    <aside style={styles.sb}>
      {/* Glow line */}
      <div style={styles.glowLine} />

      {/* Top — logo + compose */}
      <div style={styles.top}>
        <div style={styles.logoRow}>
          <div style={styles.logoMark}>
            <svg viewBox="0 0 16 16" fill="none" stroke="#F0C8C8" strokeWidth="1.6" strokeLinecap="round" width={16} height={16}>
              <path d="M1.5 5l6.5 4.5L14.5 5"/>
              <rect x="1.5" y="3.5" width="13" height="9" rx="2"/>
            </svg>
          </div>
          <span style={styles.logoName}>Mail<span style={{ color: 'var(--teal3)' }}>Sense</span></span>
          <span style={styles.logoBadge}>AI</span>
        </div>
        <button style={styles.composeBtn} onClick={() => onTabChange('compose')}>
          <span style={{ fontSize: 13 }}>✏️</span> Compose
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

      {/* Index status */}
      <div style={styles.indexBox}>
        <div style={styles.indexTitle}>EMAIL INDEX</div>
        <div style={styles.statusRow}>
          <span>{icon}</span>
          <span style={{ color: 'var(--t3)', fontSize: 12 }}>{label}</span>
        </div>
        {ragStatus === 'ready' && (
          <div style={{ color: 'var(--t4)', fontSize: 11, marginTop: 4 }}>
            ✅ {indexedCount} indexed · {dbTotal} total
            {lastChecked && <> · {lastChecked}</>}
          </div>
        )}
        <button
          style={{ ...styles.indexBtn, opacity: (ragStatus === 'indexing' || indexLoading) ? 0.5 : 1 }}
          disabled={ragStatus === 'indexing' || indexLoading}
          onClick={onIndex}
        >
          {ragStatus === 'indexing' ? '⏳ Indexing…' : '🔄 Index Emails'}
        </button>
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <div style={styles.statsTitle}>TODAY'S OVERVIEW</div>
        <StatRow label="Indexed" value={indexedCount} color="var(--teal3)" />
        <StatRow label="Total emails" value={dbTotal} />
        <StatRow label="Index status" value={label} />
      </div>

      {/* User */}
      <div style={styles.user}>
        <div style={styles.avatar}>{(userEmail?.[0] ?? 'U').toUpperCase()}</div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--t2)' }}>
            {userEmail ?? 'User'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2, cursor: 'pointer' }}
               onClick={() => { localStorage.clear(); window.location.reload(); }}>
            Sign out
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
      <span style={{ color: 'var(--t4)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? 'var(--t3)' }}>{value}</span>
    </div>
  );
}

function NavIcon({ id }) {
  const icons = {
    inbox:   <path d="M1.5 5l6.5 4.5L14.5 5"/>,
    chat:    <><rect x="1" y="1.5" width="14" height="9" rx="2"/><path d="M4.5 14.5l2.5-4h6"/></>,
    search:  <><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></>,
    compose: <path d="M2 8h8M7 5l3 3-3 3M10 8h4"/>,
  };
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
      {icons[id]}
    </svg>
  );
}

const styles = {
  sb: {
    width: 240,
    background: 'linear-gradient(180deg, var(--bg) 0%, var(--void) 100%)',
    borderRight: '1px solid var(--b1)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflowY: 'auto',
    position: 'relative',
  },
  glowLine: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 1,
    background: 'linear-gradient(180deg,transparent 0%,#1D9E7544 40%,#1D9E7522 70%,transparent 100%)',
    pointerEvents: 'none',
  },
  top: { padding: '18px 16px 14px', borderBottom: '1px solid var(--b1)' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  logoMark: {
    width: 34, height: 34,
    background: 'linear-gradient(135deg, var(--crim2), var(--crim))',
    borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: '0 0 16px #8C202033',
  },
  logoName: { fontSize: 16, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--t1)' },
  logoBadge: {
    fontSize: 9, fontWeight: 600, color: 'var(--teal3)',
    background: 'var(--teal-dim)', border: '1px solid #1D9E7544',
    borderRadius: 3, padding: '1px 5px', marginLeft: 'auto',
    letterSpacing: '.04em', textTransform: 'uppercase',
  },
  composeBtn: {
    width: '100%', padding: '10px 14px',
    background: 'linear-gradient(135deg, var(--teal-dim), var(--teal-soft))',
    color: 'var(--teal3)', border: '1px solid #1D9E7555',
    borderRadius: 'var(--rad-sm)', fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex',
    alignItems: 'center', gap: 8, justifyContent: 'center', transition: 'all .2s',
  },
  nav: { flex: 1, padding: '8px 0' },
  navSec: { padding: '14px 16px 5px', fontSize: 9.5, fontWeight: 700, color: 'var(--t4)', letterSpacing: '.1em', textTransform: 'uppercase' },
  navItem: {
    display: 'flex', alignItems: 'center', padding: '9px 16px',
    cursor: 'pointer', color: 'var(--t3)', fontSize: 12.5, gap: 10,
    transition: 'all .15s', borderLeft: '2px solid transparent',
  },
  navActive: {
    background: 'linear-gradient(90deg, var(--teal-soft), transparent)',
    color: 'var(--t1)', borderLeft: '2px solid var(--teal3)',
  },
  navLbl: { flex: 1 },
  indexBox: { padding: '14px 16px', borderTop: '1px solid var(--b1)' },
  indexTitle: { fontSize: 9.5, fontWeight: 700, color: 'var(--t4)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 },
  statusRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 },
  indexBtn: {
    width: '100%', marginTop: 10, padding: '8px 0',
    background: 'var(--surface2)', border: '1px solid var(--b2)',
    borderRadius: 'var(--rad-sm)', color: 'var(--t2)', fontSize: 12,
    fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
  },
  stats: { padding: '14px 16px', borderTop: '1px solid var(--b1)' },
  statsTitle: { fontSize: 9.5, fontWeight: 700, color: 'var(--t5)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 },
  user: { display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderTop: '1px solid var(--b1)' },
  avatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--slate), var(--slate2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: '#fff', border: '2px solid var(--b2)', flexShrink: 0,
  },
};
