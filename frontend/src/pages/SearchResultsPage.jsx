/**
 * pages/SearchResultsPage.jsx
 * Replaces Tab 3 (🔍 Search Results) from Streamlit.
 */
import React, { useState } from 'react';
import { cleanForDisplay } from '../utils/cleanEmail.js';
import { summarizeEmail, captionEmail, createCalendarEvent } from '../api/client.js';

function highlightKeywords(text, keywords) {
  if (!text || !keywords.length) return text;
  keywords.filter(k => k.length > 2).forEach(kw => {
    text = text.replace(new RegExp(kw, 'gi'), m => `🔴${m.toUpperCase()}🔴`);
  });
  return text;
}

export default function SearchResultsPage({ results, question, onClear }) {
  if (!results) {
    return (
      <div style={styles.empty}>
        No search results yet. Use the Chat tab to ask questions!
      </div>
    );
  }

  const keywords = (question ?? '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const sources  = [...(results.sources ?? [])].sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>
          Question: <em style={{ color: 'var(--teal3)' }}>{question}</em>
        </div>
        <button style={styles.clearBtn} onClick={onClear}>🗑️ Clear</button>
      </div>

      <div style={styles.answer}>{results.answer}</div>

      {sources.length > 0 && (
        <div style={{ padding: '0 20px 6px', fontSize: 12, color: 'var(--t3)' }}>
          ✅ {sources.length} matching email{sources.length > 1 ? 's' : ''}
        </div>
      )}

      <div style={styles.list}>
        {sources.map((src, i) => (
          <SourceCard key={src.email_id ?? i} src={src} idx={i} keywords={keywords} />
        ))}
      </div>
    </div>
  );
}

function SourceCard({ src, idx, keywords }) {
  const [open, setOpen]       = useState(idx < 3);
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState('');

  const clean = cleanForDisplay(src.text ?? '');

  async function runAction(label, apiFn) {
    setAiLoading(label);
    try { const r = await apiFn(clean); setAiResult(r.summary ?? r.caption ?? '✅'); }
    catch (e) { setAiResult('Error: ' + e.message); }
    finally { setAiLoading(''); }
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span style={styles.cardNum}>#{idx + 1}</span>
        <span style={styles.cardSubj}>{src.subject ?? 'No Subject'}</span>
        <span style={styles.cardRel}>{src.relevance ?? 0}% match</span>
      </div>

      <div style={styles.cardMeta}>
        <span style={{ color: 'var(--t3)' }}>From: {src.sender ?? 'Unknown'}</span>
        <span style={{ color: 'var(--t4)', marginLeft: 16 }}>Date: {src.date ?? 'Unknown'}</span>
      </div>

      {src.is_urgent && <div style={styles.urgent}>🔴 URGENT</div>}
      {src.has_deadline && src.deadline !== 'None' && (
        <div style={styles.deadline}>⏰ Deadline: {src.deadline}</div>
      )}

      <button style={styles.toggleBtn} onClick={() => setOpen(v => !v)}>
        {open ? '▲ Hide' : '▼ Show'} content
      </button>

      {open && (
        <>
          <div style={styles.content}>
            {highlightKeywords(clean, keywords)
              .split('\n')
              .map((line, i) => <p key={i} style={{ marginBottom: 4 }}>{line}</p>)
            }
          </div>

          {aiResult && <div style={styles.aiRes}>{aiResult}</div>}

          <div style={styles.tools}>
            {[
              { label: '📝 Summarize', fn: () => runAction('Summarize', summarizeEmail) },
              { label: '🏷️ Caption',   fn: () => runAction('Caption',   captionEmail)   },
              { label: '📅 Event',     fn: () => runAction('Event',     createCalendarEvent) },
            ].map(btn => (
              <button key={btn.label} style={styles.toolBtn} disabled={!!aiLoading} onClick={btn.fn}>
                {aiLoading === btn.label.split(' ')[1] ? '⏳' : ''}{btn.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  wrap:     { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg2)' },
  empty:    { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t4)', fontSize: 14 },
  header:   { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: '1px solid var(--b1)', background: 'var(--surface)', flexShrink: 0 },
  clearBtn: { marginLeft: 'auto', padding: '6px 14px', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', color: 'var(--t3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12 },
  answer:   { padding: '14px 20px', background: 'var(--teal-soft)', borderBottom: '1px solid var(--b1)', fontSize: 13.5, lineHeight: 1.65, color: 'var(--t2)' },
  list:     { flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
  card:     { background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)', padding: 16 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardNum:  { fontSize: 11, fontWeight: 700, color: 'var(--teal3)', background: 'var(--teal-soft)', padding: '2px 7px', borderRadius: 4 },
  cardSubj: { fontSize: 14, fontWeight: 600, color: 'var(--t1)', flex: 1 },
  cardRel:  { fontSize: 11, color: 'var(--t4)', background: 'var(--bg4)', padding: '2px 8px', borderRadius: 10 },
  cardMeta: { fontSize: 12, marginBottom: 8 },
  urgent:   { padding: '4px 10px', background: 'var(--neg-bg)', color: 'var(--neg-t)', borderRadius: 4, fontSize: 12, fontWeight: 600, display: 'inline-block', marginBottom: 6 },
  deadline: { padding: '4px 10px', background: '#2A1800', color: '#F5A623', borderRadius: 4, fontSize: 12, fontWeight: 600, display: 'inline-block', marginBottom: 6 },
  toggleBtn:{ background: 'transparent', border: 'none', color: 'var(--teal3)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)', padding: '4px 0' },
  content:  { marginTop: 10, fontSize: 13, lineHeight: 1.7, color: 'var(--t2)', whiteSpace: 'pre-wrap' },
  aiRes:    { marginTop: 10, padding: 12, background: 'var(--surface2)', border: '1px solid var(--b1)', borderRadius: 'var(--rad-sm)', fontSize: 13, color: 'var(--t2)' },
  tools:    { display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--b1)' },
  toolBtn:  { flex: 1, padding: '8px 0', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', color: 'var(--t2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' },
};
