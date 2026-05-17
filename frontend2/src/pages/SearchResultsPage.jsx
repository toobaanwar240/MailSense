/**
 * pages/SearchResultsPage.jsx
 * Premium Search Results Page
 */
import React, { useState } from 'react';
import { cleanForDisplay } from '../utils/cleanEmail.js';
import { summarizeEmail, captionEmail, createCalendarEvent } from '../api/client.js';

function highlightKeywords(text, keywords) {
  if (!text || !keywords.length) return text;
  keywords.filter(k => k.length > 2).forEach(kw => {
    text = text.replace(new RegExp(kw, 'gi'), m => `<span style="background:var(--maroon-glow); color:var(--maroon3); font-weight:600; padding:0 2px; border-radius:2px;">${m}</span>`);
  });
  return text;
}

export default function SearchResultsPage({ results, question, onClear }) {
  if (!results) {
    return (
      <div style={styles.empty}>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.5 }}>🔍</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t2)' }}>No active search.</div>
        <div style={{ fontSize: 13, color: 'var(--t4)', marginTop: 8 }}>Use the Chat tab to query your inbox!</div>
      </div>
    );
  }

  const keywords = (question ?? '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const sources  = [...(results.sources ?? [])].sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));

  return (
    <div style={styles.wrap}>
      <div style={styles.header} className="glass">
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>
          Search Query: <span style={{ color: 'var(--maroon3)', fontWeight: 600 }}>"{question}"</span>
        </div>
        <button style={styles.clearBtn} onClick={onClear}>🗑️ Clear Results</button>
      </div>

      <div style={styles.answerSection} className="glass-panel">
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--maroon3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>AI Answer</div>
        <div style={styles.answer}>{results.answer}</div>
      </div>

      {sources.length > 0 && (
        <div style={{ padding: '24px 24px 8px', fontSize: 13, fontWeight: 600, color: 'var(--t3)', textTransform: 'none', letterSpacing: '.03em' }}>
          {sources.length} email{sources.length !== 1 ? 's' : ''} retrieved
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
  
  // Highlight keywords safely
  const renderHighlighted = () => {
    return { __html: highlightKeywords(clean, keywords).replace(/\n/g, '<br/>') };
  };

  async function runAction(label, apiFn) {
    setAiLoading(label);
    try { const r = await apiFn(clean); setAiResult(r.summary ?? r.caption ?? '✅'); }
    catch (e) { setAiResult('Error: ' + e.message); }
    finally { setAiLoading(''); }
  }

  return (
    <div style={styles.card} className="glass-panel">
      <div style={styles.cardHead}>
        <span style={styles.cardNum}>#{idx + 1}</span>
        <span style={styles.cardSubj}>{src.subject ?? 'No Subject'}</span>
        <span style={styles.cardRel}>{src.relevance ?? 0}% match</span>
      </div>

      <div style={styles.cardMeta}>
        <span style={{ color: 'var(--t2)', fontWeight: 500 }}>From: {src.sender ?? 'Unknown'}</span>
        <span style={{ color: 'var(--t4)', marginLeft: 16 }}>Date: {src.date ?? 'Unknown'}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {src.is_urgent && <div style={styles.urgent}>URGENT</div>}
        {src.has_deadline && src.deadline !== 'None' && (
          <div style={styles.deadline}>Due: {src.deadline}</div>
        )}
      </div>

      <button style={styles.toggleBtn} onClick={() => setOpen(v => !v)}>
        {open ? '▲ Hide Content' : '▼ View Content'}
      </button>

      {open && (
        <>
          <div style={styles.content}>
            <div dangerouslySetInnerHTML={renderHighlighted()} />
          </div>

          {aiResult && <div style={styles.aiRes}>{aiResult}</div>}

          <div style={styles.tools}>
            {[
              { label: 'Summarize', fn: () => runAction('Summarize', summarizeEmail) },
              { label: 'Caption',   fn: () => runAction('Caption',   captionEmail)   },
              { label: 'Event',     fn: () => runAction('Event',     createCalendarEvent) },
            ].map(btn => (
              <button key={btn.label} style={styles.toolBtn} disabled={!!aiLoading} onClick={btn.fn}>
                {aiLoading === btn.label ? 'Processing…' : btn.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  wrap:     { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg)' },
  empty:    { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--t4)', background: 'var(--bg2)' },
  header:   { display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--b1)', background: 'var(--surface)', flexShrink: 0, zIndex: 10 },
  clearBtn: { marginLeft: 'auto', padding: '8px 16px', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', color: 'var(--t2)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 500, transition: 'all .2s' },
  answerSection: { margin: '12px 24px 0', padding: '12px 16px', background: 'var(--card-gradient)', border: '1px solid var(--b2)', borderLeft: '4px solid var(--maroon3)', borderRadius: 'var(--rad)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', maxHeight: '120px', overflowY: 'auto' },
  answer:   { fontSize: 13.5, lineHeight: 1.6, color: 'var(--t1)' },
  list:     { flex: 1, overflowY: 'auto', padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  card:     { background: 'var(--surface)', border: '1px solid var(--b1)', borderRadius: 'var(--rad-lg)', padding: '20px 24px', transition: 'all .2s ease' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardNum:  { fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--maroon3)', padding: '2px 8px', borderRadius: 6, boxShadow: '0 2px 8px var(--maroon-glow)' },
  cardSubj: { fontSize: 15, fontWeight: 700, color: 'var(--t1)', flex: 1 },
  cardRel:  { fontSize: 12, fontWeight: 600, color: 'var(--maroon3)', background: 'var(--maroon-dim)', padding: '4px 10px', borderRadius: 12, border: '1px solid var(--maroon-glow)' },
  cardMeta: { fontSize: 13, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--b1)' },
  urgent:   { padding: '4px 12px', background: 'var(--neg-bg)', color: 'var(--neg-t)', border: '1px solid var(--neg)', borderRadius: 6, fontSize: 11.5, fontWeight: 700, display: 'inline-block' },
  deadline: { padding: '4px 12px', background: '#2C1A00', color: '#E5A020', border: '1px solid #664400', borderRadius: 6, fontSize: 11.5, fontWeight: 700, display: 'inline-block' },
  toggleBtn:{ background: 'transparent', border: 'none', color: 'var(--maroon3)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', padding: '8px 0', transition: 'color .2s' },
  content:  { marginTop: 12, padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--rad)', border: '1px solid var(--b2)', fontSize: 13.5, lineHeight: 1.7, color: 'var(--t2)' },
  aiRes:    { marginTop: 12, padding: '14px 16px', background: 'var(--ai-bubble-gradient)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)', fontSize: 13.5, color: 'var(--t1)', borderLeft: '3px solid var(--maroon3)' },
  tools:    { display: 'flex', gap: 10, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--b1)' },
  toolBtn:  { flex: 1, padding: '10px 0', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', color: 'var(--t2)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s' },
};
