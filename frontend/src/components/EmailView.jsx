/**
 * components/EmailView.jsx
 * Replaces the right panel (mail view + AI actions) in Tab 1 from Streamlit.
 * Matches .mail-view from mailsense_premium.html.
 */
import React, { useState, useEffect } from 'react';
import { CategoryBadge, ConfBar } from './CategoryBadge.jsx';
import { cleanForDisplay } from '../utils/cleanEmail.js';
import {
  summarizeEmail, captionEmail, createCalendarEvent
} from '../api/client.js';

const REACTIONS = ['😊', '😢', '😠', '😌', '😐'];

export default function EmailView({ email, classifyData, sentimentData, onRefreshSentiment }) {
  const [reaction, setReaction]     = useState(null);
  const [aiResult, setAiResult]     = useState('');
  const [aiLoading, setAiLoading]   = useState('');
  const [expanded, setExpanded]     = useState(true);
  const [showScores, setShowScores] = useState(false);

  useEffect(() => {
    setAiResult('');
    setReaction(null);
    setExpanded(true);
  }, [email?.id]);

  if (!email) {
    return (
      <div style={{ ...styles.wrap, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--t4)', fontSize: 13 }}>Select an email to view</span>
      </div>
    );
  }

  const body    = cleanForDisplay(email.body ?? email.snippet ?? email.text ?? '');
  const category   = classifyData?.category ?? 'unknown';
  const confidence = classifyData?.confidence ?? 0;
  const allScores  = classifyData?.all_scores ?? {};
  const sentiment  = sentimentData?.sentiment ?? 'unknown';
  const sentEmoji  = sentimentData?.emoji ?? '❓';
  const sentConf   = sentimentData?.confidence ?? 0;
  const sentExp    = sentimentData?.explanation ?? '';
  const toneTags   = sentimentData?.tone_tags ?? [];

  const sClass = { positive: 's-pos', negative: 's-neg' }[sentiment?.toLowerCase()] ?? 's-neu';

  async function runAction(label, apiFn) {
    if (!body) { setAiResult('⚠️ No email content to process.'); return; }
    setAiLoading(label);
    setAiResult('');
    try {
      const res  = await apiFn(body);
      const text = res.summary ?? res.caption ?? (res.status === 200 ? '✅ Done' : JSON.stringify(res));
      setAiResult(text);
    } catch (e) {
      setAiResult('Error: ' + e.message);
    } finally {
      setAiLoading('');
    }
  }

  const initials = (email.sender ?? 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.head}>
        <div style={styles.subj}>{email.subject ?? '(no subject)'}</div>
        <div style={styles.actions}>
          {[
            { title: 'Reply',   path: 'M6 3L2 7l4 4M2 7h9a3 3 0 010 6H9' },
            { title: 'Forward', path: 'M10 3l4 4-4 4M14 7H5a3 3 0 000 6h2' },
            { title: 'Archive', path: 'M3 5v8a1 1 0 001 1h8a1 1 0 001-1V5M6 8.5h4' },
            { title: 'Delete',  path: 'M2 4.5h12M5.5 4.5V3a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1.5M4 4.5l.8 8a1 1 0 001 .9h4.4a1 1 0 001-.9L12 4.5' },
          ].map(btn => (
            <button key={btn.title} style={styles.mvBtn} title={btn.title}>
              <svg viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
                <path d={btn.path}/>
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Sender meta */}
        <div style={styles.meta}>
          <div style={styles.avatar}>{initials}</div>
          <div>
            <div style={styles.from}>{email.sender?.split('<')[0]?.trim() ?? 'Unknown'}</div>
            <div style={styles.email}>{email.sender?.match(/<(.+)>/)?.[1] ?? ''}</div>
          </div>
          <div style={styles.date}>{email.date ?? ''}</div>
        </div>

        {/* Sentiment bar */}
        <div style={styles.sentBar}>
          <span style={styles.sentLabel}>Sentiment:</span>
          <span className={`sentiment-badge ${sClass}`}>{sentEmoji} {sentiment}</span>
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--t4)' }}>{sentConf}% confident</span>
          {toneTags.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--t4)' }}>· {toneTags.join(', ')}</span>
          )}
          <button style={styles.reanalyzeBtn} onClick={onRefreshSentiment}>🔁</button>
        </div>

        {sentExp && (
          <div style={{ padding: '4px 20px 0', fontSize: 11, color: 'var(--t4)' }}>{sentExp}</div>
        )}

        {/* Category badge */}
        <div style={{ padding: '10px 20px 6px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <CategoryBadge category={category} confidence={confidence} />
          <ConfBar confidence={confidence} />
          {Object.keys(allScores).length > 0 && (
            <button style={styles.scoresBtn} onClick={() => setShowScores(v => !v)}>
              {showScores ? 'Hide' : 'View'} all scores
            </button>
          )}
        </div>

        {showScores && (
          <div style={{ padding: '0 20px 10px' }}>
            {Object.entries(allScores)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, score]) => (
                <div key={cat} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 2 }}>
                    <span style={{ color: 'var(--t2)' }}>{cat}</span>
                    <span style={{ color: 'var(--t4)' }}>{score}%</span>
                  </div>
                  <ConfBar confidence={score} />
                </div>
              ))}
          </div>
        )}

        {/* Emoji reactions */}
        <div style={styles.emojiBar}>
          <span style={{ color: 'var(--t4)', fontSize: 11.5 }}>Your reaction:</span>
          {REACTIONS.map(r => (
            <button
              key={r}
              onClick={() => setReaction(r)}
              style={{ ...styles.emojiBtn, ...(reaction === r ? styles.emojiBtnActive : {}) }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={styles.body}>
          {body
            ? body.split('\n').map((line, i) => <p key={i} style={{ marginBottom: 6 }}>{line}</p>)
            : <span style={{ color: 'var(--t4)' }}>No content available.</span>
          }
        </div>

        {/* AI result */}
        {aiResult && (
          <div style={styles.aiResult}>{aiResult}</div>
        )}

        {/* AI actions */}
        <div style={styles.aiBar}>
          {[
            { label: '📝 Summarize', action: () => runAction('summarize', summarizeEmail) },
            { label: '🏷️ Caption',   action: () => runAction('caption',   captionEmail)   },
            { label: '📅 Calendar',  action: () => runAction('calendar',  createCalendarEvent) },
          ].map(btn => (
            <button
              key={btn.label}
              style={{ ...styles.aiBtn, opacity: aiLoading && aiLoading !== btn.label ? 0.5 : 1 }}
              disabled={!!aiLoading}
              onClick={btn.action}
            >
              {aiLoading === btn.label.split(' ')[1]?.toLowerCase() ? '⏳' : ''}{btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg2)', overflow: 'hidden' },
  head: { padding: '16px 22px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--surface)', flexShrink: 0 },
  subj: { fontSize: 17, fontWeight: 700, color: 'var(--t1)', flex: 1, lineHeight: 1.3, letterSpacing: '-.02em' },
  actions: { display: 'flex', gap: 6, flexShrink: 0 },
  mvBtn: { width: 32, height: 32, borderRadius: 'var(--rad-sm)', border: '1px solid var(--b2)', background: 'var(--bg4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' },
  meta: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--b1)' },
  avatar: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, var(--slate), var(--slate2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, color: '#fff',
  },
  from: { fontSize: 13.5, fontWeight: 600, color: 'var(--t1)' },
  email: { fontSize: 11.5, color: 'var(--t3)' },
  date: { marginLeft: 'auto', fontSize: 12, color: 'var(--t3)' },
  sentBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderBottom: '1px solid var(--b1)', background: 'var(--surface)', flexWrap: 'wrap' },
  sentLabel: { fontSize: 11.5, color: 'var(--t4)' },
  reanalyzeBtn: { marginLeft: 'auto', background: 'transparent', border: '1px solid var(--b2)', borderRadius: 6, cursor: 'pointer', padding: '2px 8px', fontSize: 12, color: 'var(--t3)' },
  scoresBtn: { background: 'transparent', border: '1px solid var(--b2)', borderRadius: 6, cursor: 'pointer', padding: '3px 10px', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font)' },
  emojiBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderBottom: '1px solid var(--b1)', background: 'var(--surface3)' },
  emojiBtn: { fontSize: 18, background: 'transparent', border: '2px solid transparent', borderRadius: 8, cursor: 'pointer', padding: '3px 6px', transition: 'all .15s' },
  emojiBtnActive: { borderColor: 'var(--teal3)', background: 'var(--teal-soft)' },
  body: { padding: '18px 22px', flex: 1, fontSize: 13.5, lineHeight: 1.75, color: 'var(--t2)' },
  aiResult: { margin: '0 20px 12px', padding: 14, background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 },
  aiBar: { display: 'flex', gap: 8, padding: '12px 20px 16px', borderTop: '1px solid var(--b1)', background: 'var(--surface)', flexShrink: 0 },
  aiBtn: { flex: 1, padding: '9px 0', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', color: 'var(--t2)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s' },
};
