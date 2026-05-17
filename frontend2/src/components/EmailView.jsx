/**
 * components/EmailView.jsx
 * Premium Mail View
 */
import React, { useState, useEffect } from 'react';
import { CategoryBadge, ConfBar } from './CategoryBadge.jsx';
import { cleanForDisplay } from '../utils/cleanEmail.js';
import {
  summarizeEmail, captionEmail, createCalendarEvent
} from '../api/client.js';

const REACTIONS = ['😊', '😢', '😠', '😌', '😐'];

export default function EmailView({ email, classifyData, sentimentData, onRefreshSentiment, onPrevEmail, onNextEmail }) {
  const [reaction, setReaction]     = useState(null);
  const [aiResult, setAiResult]     = useState('');
  const [aiLoading, setAiLoading]   = useState('');
  const [expanded, setExpanded]     = useState(false);
  const [showScores, setShowScores] = useState(false);

  useEffect(() => {
    setAiResult('');
    setReaction(null);
    setExpanded(false);
  }, [email?.id]);

  if (!email) {
    return (
      <div style={{ ...styles.wrap, alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.emptyState}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--b3)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span style={{ color: 'var(--t3)', fontSize: 14, fontWeight: 500 }}>Select an email to read</span>
        </div>
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
      <div style={styles.head} className="glass">
        <div style={styles.subj}>{email.subject ?? '(no subject)'}</div>
        <div style={styles.actions}>
          <button
            onClick={onPrevEmail}
            disabled={!onPrevEmail}
            style={{ ...styles.mvBtn, opacity: onPrevEmail ? 1 : 0.4, cursor: onPrevEmail ? 'pointer' : 'not-allowed' }}
            title="Previous Email"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
              <path d="M10 13L5 8l5-5"/>
            </svg>
          </button>
          <button
            onClick={onNextEmail}
            disabled={!onNextEmail}
            style={{ ...styles.mvBtn, opacity: onNextEmail ? 1 : 0.4, cursor: onNextEmail ? 'pointer' : 'not-allowed' }}
            title="Next Email"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
              <path d="M6 3l5 5-5 5"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ flex: '1 1 0px', overflowY: 'auto', padding: '0 20px 20px', position: 'relative' }}>
        
        {/* Email Content Card */}
        <div style={styles.contentCard} className="glass-panel">
          {/* Sender meta */}
          <div style={styles.meta}>
            <div style={styles.avatar}>{initials}</div>
            <div style={{ flex: 1 }}>
              <div style={styles.from}>{email.sender?.split('<')[0]?.trim() ?? 'Unknown'}</div>
              <div style={styles.email}>{email.sender?.match(/<(.+)>/)?.[1] ?? ''}</div>
            </div>
            <div style={styles.date}>{email.date ?? ''}</div>
          </div>

          {/* Body */}
          <div style={styles.body}>
            {(() => {
              if (!body) return <span style={{ color: 'var(--t4)' }}>No content available.</span>;
              
              const fullText = body;
              
              if (!expanded && fullText.length > 250) {
                const truncated = fullText.slice(0, 250) + '...';
                return (
                  <div>
                    {truncated.split('\n').map((line, i) => <p key={i} style={{ marginBottom: 8 }}>{line}</p>)}
                    <button
                      onClick={() => setExpanded(true)}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--b2)',
                        borderRadius: 'var(--rad-xs)',
                        padding: '6px 14px',
                        color: 'var(--maroon3)',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        marginTop: '12px',
                        fontFamily: 'var(--font)',
                        textTransform: 'uppercase',
                        letterSpacing: '.04em',
                        transition: 'all .2s'
                      }}
                      onMouseEnter={(e) => { e.target.style.background = 'var(--maroon-dim)'; e.target.style.color = 'var(--maroon4)'; }}
                      onMouseLeave={(e) => { e.target.style.background = 'var(--surface2)'; e.target.style.color = 'var(--maroon3)'; }}
                    >
                      Read More
                    </button>
                  </div>
                );
              }
              
              return (
                <div>
                  {fullText.split('\n').map((line, i) => <p key={i} style={{ marginBottom: 8 }}>{line}</p>)}
                  {fullText.length > 250 && (
                    <button
                      onClick={() => setExpanded(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--t4)',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginTop: '12px',
                        fontFamily: 'var(--font)',
                        textDecoration: 'underline'
                      }}
                    >
                      Show Less
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* AI & Meta Panel */}
        <div style={styles.aiPanel} className="glass-panel">
          {/* Sentiment bar */}
          <div style={styles.sentBar}>
            <span style={styles.sentLabel}>Sentiment Analysis:</span>
            <span className={`sentiment-badge ${sClass}`}>{sentEmoji} {sentiment}</span>
            <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--t3)' }}>{sentConf}% confident</span>
            {toneTags.length > 0 && (
              <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--t4)' }}>· {toneTags.join(', ')}</span>
            )}
            <button style={styles.reanalyzeBtn} onClick={onRefreshSentiment} title="Reanalyze Sentiment">Refresh</button>
          </div>



          {/* Category badge */}
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--b1)' }}>
            <span style={styles.sentLabel}>Category:</span>
            <span className={`tag cat-${category}`}>{category.replace(/_/g, ' ')}</span>
            <div style={{ width: '120px' }}>
              <ConfBar confidence={confidence} />
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--t4)' }}>{confidence}%</span>
            
            {Object.keys(allScores).length > 0 && (
              <button style={styles.scoresBtn} onClick={() => setShowScores(v => !v)}>
                {showScores ? 'Hide' : 'View All Scores'}
              </button>
            )}
          </div>

          {showScores && (
            <div style={{ padding: '0 24px 16px' }}>
              <div style={{ background: 'var(--surface2)', padding: '12px 16px', borderRadius: 'var(--rad-sm)', border: '1px solid var(--b2)' }}>
              {Object.entries(allScores)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, score]) => (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                      <span style={{ color: 'var(--t2)' }}>{cat.replace(/_/g, ' ')}</span>
                      <span style={{ color: 'var(--t4)' }}>{score}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--bg3)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${score}%`, height: '100%', background: 'var(--maroon3)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* AI actions */}
          <div style={styles.aiBar}>
            {[
              { label: 'Summarize', action: () => runAction('summarize', summarizeEmail) },
              { label: 'Caption',   action: () => runAction('caption',   captionEmail)   },
              { label: 'Calendar',  action: () => runAction('calendar',  createCalendarEvent) },
            ].map(btn => (
              <button
                key={btn.label}
                style={{ ...styles.aiBtn, opacity: aiLoading && aiLoading !== btn.label ? 0.5 : 1 }}
                disabled={!!aiLoading}
                onClick={btn.action}
              >
                {aiLoading === btn.label.toLowerCase() ? 'Processing…' : btn.label}
              </button>
            ))}
          </div>

          {/* AI result */}
          {aiResult && (
            <div style={styles.aiResult}>
              {(() => {
                if (aiResult.includes('- ') || aiResult.includes('* ') || aiResult.includes('\n')) {
                  const lines = aiResult.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .map(line => line.replace(/^[\s-*•\d\.)]+/, '').trim());
                  
                  return (
                    <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
                      {lines.map((line, idx) => (
                        <li key={idx} style={{ marginBottom: '8px', color: 'var(--t2)', fontSize: '13.5px', lineHeight: '1.6' }}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  );
                }
                return <div style={{ whiteSpace: 'pre-wrap' }}>{aiResult}</div>;
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--panel-gradient)', overflow: 'hidden', minWidth: 0, minHeight: 0, height: '100%' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: 0.5 },
  emptyIcon: { fontSize: 48, filter: 'grayscale(100%) brightness(1.5)' },
  head: { padding: '24px', display: 'flex', alignItems: 'flex-start', gap: 16, flexShrink: 0, borderBottom: '1px solid var(--b1)', background: 'var(--surface)' },
  subj: { fontSize: 22, fontWeight: 700, color: 'var(--t1)', flex: 1, lineHeight: 1.3, letterSpacing: '-.02em' },
  actions: { display: 'flex', gap: 8, flexShrink: 0 },
  mvBtn: { width: 36, height: 36, borderRadius: 'var(--rad-sm)', border: '1px solid var(--b2)', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', color: 'var(--t2)' },
  contentCard: { background: 'var(--card-gradient)', borderRadius: 'var(--rad-lg)', margin: '20px 0 16px', border: '1px solid var(--b2)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', transition: 'box-shadow 0.3s ease' },
  meta: {
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '14px 20px',
    borderBottom: '1px solid var(--b2)',
    background: '#1C1218',   // ← slightly lighter than email body background
    borderTop: '1px solid #3A2830',
    borderLeft: '3px solid var(--maroon3)',
    paddingLeft: '17px',
  },
  avatar: {
    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, var(--maroon3), var(--maroon))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, color: '#fff', boxShadow: '0 4px 12px var(--maroon-glow)'
  },
  from: { fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 },
  email: { fontSize: 12.5, color: 'var(--t3)' },
  date: { marginLeft: 'auto', fontSize: 12.5, color: 'var(--t3)' },
  body: { padding: '24px', fontSize: 14.5, lineHeight: 1.8, color: 'var(--t2)' },
  
  aiPanel: { background: 'var(--ai-panel-gradient)', borderRadius: 'var(--rad-lg)', border: '1px solid var(--b2)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', marginBottom: '20px' },
  sentBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px', borderBottom: '1px solid var(--b1)', background: 'rgba(0,0,0,0.2)', flexWrap: 'wrap' },
  sentLabel: { fontSize: 12.5, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' },
  reanalyzeBtn: { marginLeft: 'auto', background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', cursor: 'pointer', padding: '6px 12px', fontSize: 12, color: 'var(--t2)', transition: 'all .2s' },
  scoresBtn: { marginLeft: 'auto', background: 'transparent', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', cursor: 'pointer', padding: '6px 14px', fontSize: 11.5, color: 'var(--t2)', fontFamily: 'var(--font)', transition: 'all .2s' },
  aiResult: { margin: '0 24px 24px', padding: '16px 20px', background: 'var(--ai-bubble-gradient)', border: '1px solid var(--b3)', borderLeft: '4px solid var(--maroon3)', borderRadius: 'var(--rad)', fontSize: 13.5, color: 'var(--t1)', lineHeight: 1.7, boxShadow: '0 4px 16px var(--maroon-glow)' },
  aiBar: { display: 'flex', gap: 12, padding: '16px 24px 24px', borderTop: '1px solid var(--b1)', flexShrink: 0 },
  aiBtn: { flex: 1, padding: '12px 0', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)', color: 'var(--t1)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
};
