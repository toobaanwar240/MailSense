/**
 * components/EmailList.jsx
 * Replaces the left-column email selector in Tab 1 (Inbox).
 * Matches the .mail-list section from mailsense_premium.html.
 */
import React, { useState } from 'react';

const SENT_CLASS = { positive: 's-pos', negative: 's-neg', neutral: 's-neu', unknown: 's-neu' };

export default function EmailList({ emails, selectedId, onSelect, classifyCache, onRefresh }) {
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
      filter === 'Unread' ? !em.is_read :
      true;
    return matchSearch && matchFilter;
  });

  return (
    <div style={styles.wrap} className="glass">
      <div style={styles.head}>
        <span style={styles.title}>Inbox</span>
        <span style={styles.badge}>{emails.filter(e => !e.is_read).length} unread</span>
        {onRefresh && (
          <button style={styles.refreshTxtBtn} onClick={onRefresh}>
            Refresh
          </button>
        )}
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
          <div style={{ padding: 30, color: 'var(--t4)', textAlign: 'center', fontSize: 13 }}>
            No emails found.
          </div>
        )}
        {filtered.map((em) => {
          const cached = classifyCache?.(em.id);
          const sentiment = cached?.sentiment?.sentiment ?? 'neutral';
          const sClass = SENT_CLASS[sentiment?.toLowerCase()] ?? 's-neu';
          const sEmoji = cached?.sentiment?.emoji ?? '';
          const isActive = em.id === selectedId;

          return (
            <div
              key={em.id}
              style={{ ...styles.item, ...(isActive ? styles.itemActive : {}), ...(em.is_read ? styles.itemRead : {}) }}
              className="email-card"
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
                  <span className={`tag cat-${cached.classify.category}`}>
                    {cached.classify.category.replace(/_/g, ' ')}
                  </span>
                )}
                {sEmoji && <span style={styles.emoji} title={sentiment}>{sEmoji}</span>}
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

const styles = {
  wrap: { width: 340, borderRight: '1px solid var(--b1)', display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 5 },
  head: { padding: '20px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--t1)', flex: 1, letterSpacing: '-.02em' },
  badge: { fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 12, background: 'var(--maroon-dim)', color: 'var(--maroon3)' },
  filterBar: { display: 'flex', borderBottom: '1px solid var(--b1)', padding: '0 16px' },
  filterTab: {
    padding: '12px 16px', fontSize: 12.5, cursor: 'pointer',
    color: 'var(--t4)', fontWeight: 500, background: 'transparent',
    border: 'none', borderBottom: '3px solid transparent',
    fontFamily: 'var(--font)', transition: 'all .2s ease',
  },
  filterActive: { color: 'var(--maroon3)', borderBottomColor: 'var(--maroon3)', fontWeight: 600 },
  list: { flex: 1, overflowY: 'auto' },
  item: { padding: '16px 20px', borderBottom: '1px solid var(--b1)', cursor: 'pointer', transition: 'all .2s ease', position: 'relative' },
  itemActive: { background: 'var(--surface2)', borderLeft: '4px solid var(--maroon3)', paddingLeft: '16px' },
  itemRead: { opacity: 0.8 },
  r1: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  udot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--maroon3)', flexShrink: 0, boxShadow: '0 0 6px var(--maroon-glow)' },
  udotRead: { background: 'transparent', boxShadow: 'none' },
  sender: { fontSize: 14, fontWeight: 800, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t1)' },
  senderRead: { fontWeight: 700, color: 'var(--t2)' },
  time: { fontSize: 11.5, color: 'var(--t4)', flexShrink: 0 },
  subj: { fontSize: 13, color: 'var(--t1)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 },
  subjRead: { fontWeight: 400, color: 'var(--t3)' },
  prev: { fontSize: 12.5, color: 'var(--t4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 },
  tags: { display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' },
  emoji: { fontSize: 16, marginLeft: 'auto', background: 'var(--surface2)', borderRadius: '50%', padding: '4px' },
  refreshTxtBtn: { background: 'transparent', border: '1px solid var(--b2)', borderRadius: 'var(--rad-xs)', padding: '4px 10px', fontSize: 12, fontWeight: 600, color: 'var(--t2)', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s' }
};
