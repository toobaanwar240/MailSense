/**
 * components/EmailList.jsx
 * Replaces the left-column email selector in Tab 1 (Inbox).
 * Matches the .mail-list section from mailsense_premium.html.
 */
import React, { useState } from 'react';

const SENT_CLASS = { positive: 's-pos', negative: 's-neg', neutral: 's-neu', unknown: 's-neu' };

export default function EmailList({ emails, selectedId, onSelect, classifyCache }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = emails.filter(em => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      em.subject?.toLowerCase().includes(s) ||
      em.sender?.toLowerCase().includes(s) ||
      em.snippet?.toLowerCase().includes(s);
    const matchFilter =
      filter === 'All' ? true :
      filter === 'Unread' ? em.is_read === false :
      true;
    return matchSearch && matchFilter;
  });

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <span style={styles.title}>Inbox</span>
        <span style={styles.badge}>{emails.filter(e => !e.is_read).length} unread</span>
      </div>

      <div style={styles.searchWrap}>
        <svg style={styles.searchIcon} viewBox="0 0 13 13" fill="none" stroke="var(--t4)" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="5.5" cy="5.5" r="3.5"/>
          <path d="M8.5 8.5l2.5 2.5"/>
        </svg>
        <input
          style={styles.searchInput}
          placeholder="Search emails..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div style={styles.filterBar}>
        {['All', 'Unread'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...styles.filterTab, ...(filter === f ? styles.filterActive : {}) }}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={styles.list}>
        {filtered.length === 0 && (
          <div style={{ padding: 20, color: 'var(--t4)', textAlign: 'center', fontSize: 12 }}>
            No emails found.
          </div>
        )}
        {filtered.map((em) => {
          const cached = classifyCache?.(em.id);
          const sentiment = cached?.sentiment?.sentiment ?? 'neutral';
          const sClass = SENT_CLASS[sentiment?.toLowerCase()] ?? 's-neu';
          const sEmoji = cached?.sentiment?.emoji ?? '😐';
          const isActive = em.id === selectedId;

          return (
            <div
              key={em.id}
              style={{ ...styles.item, ...(isActive ? styles.itemActive : {}), ...(em.is_read ? styles.itemRead : {}) }}
              onClick={() => onSelect(em)}
            >
              <div style={styles.r1}>
                <div style={{ ...styles.udot, ...(em.is_read ? styles.udotRead : {}) }} />
                <span style={{ ...styles.sender, ...(em.is_read ? styles.senderRead : {}) }} className="truncate">
                  {em.sender?.split('<')[0]?.trim() ?? 'Unknown'}
                </span>
                <span style={styles.time}>{formatDate(em.date)}</span>
              </div>
              <div style={{ ...styles.subj, ...(em.is_read ? styles.subjRead : {}) }} className="truncate">
                {em.subject ?? '(no subject)'}
              </div>
              <div style={styles.prev} className="truncate">
                {em.snippet ?? ''}
              </div>
              <div style={styles.tags}>
                {cached?.classify?.category && cached.classify.category !== 'unknown' && (
                  <span className={`tag`} style={tagStyle(cached.classify.category)}>
                    {cached.classify.category.replace(/_/g, ' ')}
                  </span>
                )}
                <span style={styles.emoji}>{sEmoji}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  // Return last segment that looks like a time or short date
  return dateStr.split(',').pop()?.trim() ?? dateStr;
}

function tagStyle(category) {
  const map = {
    account_alerts:     { background: '#fef3c7', color: '#d97706' },
    career_personal:    { background: '#fef9c3', color: '#854d0e' },
    finance_legal:      { background: '#dbeafe', color: '#1d4ed8' },
    marketing_outreach: { background: '#ffedd5', color: '#c2410c' },
    work_operations:    { background: '#dcfce7', color: '#15803d' },
  };
  return map[category] ?? { background: 'var(--bg4)', color: 'var(--t3)' };
}

const styles = {
  wrap: { width: 310, background: 'var(--surface)', borderRight: '1px solid var(--b1)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  head: { padding: '14px 16px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: 10 },
  title: { fontSize: 14.5, fontWeight: 700, color: 'var(--t1)', flex: 1, letterSpacing: '-.02em' },
  badge: { fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--crim-dim)', color: 'var(--crim3)' },
  searchWrap: { padding: '10px 14px', borderBottom: '1px solid var(--b1)', position: 'relative' },
  searchIcon: { position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13 },
  searchInput: {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--b1)',
    borderRadius: 'var(--rad-sm)', padding: '8px 10px 8px 30px',
    fontSize: 12.5, color: 'var(--t2)', fontFamily: 'var(--font)', outline: 'none',
  },
  filterBar: { display: 'flex', borderBottom: '1px solid var(--b1)' },
  filterTab: {
    padding: '9px 14px', fontSize: 11.5, cursor: 'pointer',
    color: 'var(--t4)', fontWeight: 500, background: 'transparent',
    border: 'none', borderBottom: '2px solid transparent',
    fontFamily: 'var(--font)', transition: 'all .15s',
  },
  filterActive: { color: 'var(--teal3)', borderBottomColor: 'var(--teal3)' },
  list: { flex: 1, overflowY: 'auto' },
  item: { padding: '13px 16px', borderBottom: '1px solid var(--b1)', cursor: 'pointer', transition: 'background .12s', position: 'relative' },
  itemActive: { background: 'linear-gradient(90deg, var(--teal-soft), var(--bg3))', borderLeft: '2px solid var(--teal3)' },
  itemRead: { opacity: 0.75 },
  r1: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 },
  udot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--teal3)', flexShrink: 0 },
  udotRead: { background: 'transparent' },
  sender: { fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t1)' },
  senderRead: { fontWeight: 400, color: 'var(--t3)' },
  time: { fontSize: 11, color: 'var(--t4)', flexShrink: 0 },
  subj: { fontSize: 12, color: 'var(--t2)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 },
  subjRead: { fontWeight: 400, color: 'var(--t3)' },
  prev: { fontSize: 11.5, color: 'var(--t4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tags: { display: 'flex', gap: 5, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' },
  emoji: { fontSize: 14, marginLeft: 'auto' },
};
