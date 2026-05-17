/**
 * components/EmailView.jsx
 * Premium Mail View — updated with manual localStorage labeling.
 * Labels panel sits between the email body card and the AI panel.
 */
import React, { useState, useEffect } from 'react';
import { CategoryBadge, ConfBar } from './CategoryBadge.jsx';
import { cleanForDisplay } from '../utils/cleanEmail.js';
import {
  summarizeEmail, captionEmail, createCalendarEvent
} from '../api/client.js';

// ─── localStorage label helpers ───────────────────────────────────────────────
const LABELS_KEY  = 'ms_labels';   // [{id, name, color}]
const APPLIED_KEY = 'ms_applied';  // { emailId: [labelId, ...] }

const PRESET_COLORS = [
  '#1D9E75', '#4A6FA5', '#C43030', '#F59E0B',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

function loadLabels()  {
  try { return JSON.parse(localStorage.getItem(LABELS_KEY))  ?? []; } catch { return []; }
}
function loadApplied() {
  try { return JSON.parse(localStorage.getItem(APPLIED_KEY)) ?? {}; } catch { return {}; }
}
function saveLabels(v)  { localStorage.setItem(LABELS_KEY,  JSON.stringify(v)); }
function saveApplied(v) { localStorage.setItem(APPLIED_KEY, JSON.stringify(v)); }

// ─── Sentiment style ──────────────────────────────────────────────────────────
const getSentimentStyle = (sentiment) => {
  const s = sentiment?.toLowerCase();
  if (s === 'positive') return { background: 'rgba(40,167,69,.15)', color: '#28A745', borderColor: 'rgba(40,167,69,.3)', emoji: '😊' };
  if (s === 'negative') return { background: 'rgba(220,53,69,.15)',  color: '#DC3545', borderColor: 'rgba(220,53,69,.3)',  emoji: '😡' };
  return { background: 'rgba(108,117,125,.15)', color: 'var(--t2)', borderColor: 'rgba(108,117,125,.3)', emoji: '😐' };
};

// ─── LabelPanel component ─────────────────────────────────────────────────────
function LabelPanel({ emailId }) {
  const [labels,  setLabels]  = useState(loadLabels);
  const [applied, setApplied] = useState(loadApplied);
  const [open,    setOpen]    = useState(false);
  const [newName, setNewName] = useState('');

  // Sync to localStorage whenever labels or applied changes
  useEffect(() => { saveLabels(labels);   }, [labels]);
  useEffect(() => { saveApplied(applied); }, [applied]);

  const emailLabelIds = applied[emailId] ?? [];
  const emailLabels   = labels.filter(l => emailLabelIds.includes(l.id));
  const unapplied     = labels.filter(l => !emailLabelIds.includes(l.id));

  function createLabel(name) {
    if (!name.trim()) return null;
    const label = {
      id:    Date.now().toString(),
      name:  name.trim(),
      color: PRESET_COLORS[labels.length % PRESET_COLORS.length],
    };
    setLabels(prev => [...prev, label]);
    return label;
  }

  function applyLabel(labelId) {
    setApplied(prev => {
      const cur = prev[emailId] ?? [];
      if (cur.includes(labelId)) return prev;
      return { ...prev, [emailId]: [...cur, labelId] };
    });
  }

  function removeLabel(labelId) {
    setApplied(prev => ({
      ...prev,
      [emailId]: (prev[emailId] ?? []).filter(id => id !== labelId),
    }));
  }

  function handleCreate() {
    if (!newName.trim()) return;
    const created = createLabel(newName);
    if (created) { applyLabel(created.id); }
    setNewName('');
    setOpen(false);
  }

  return (
    <div style={lp.wrap}>
      <div style={lp.row}>
        <span style={lp.sectionLabel}>Labels</span>

        {/* Applied chips */}
        <div style={lp.chips}>
          {emailLabels.map(label => (
            <div key={label.id} style={{
              ...lp.chip,
              background:   label.color + '22',
              border:       `1px solid ${label.color}55`,
              color:        label.color,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: label.color, flexShrink: 0 }} />
              {label.name}
              <span
                onClick={() => removeLabel(label.id)}
                style={lp.removeX}
                title="Remove label"
              >×</span>
            </div>
          ))}

          {/* Add label button */}
          <button
            onClick={() => setOpen(v => !v)}
            style={lp.addBtn}
          >
            {open ? '✕ Close' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={lp.dropdown}>

          {/* Existing unapplied labels */}
          {unapplied.length > 0 && (
            <>
              <div style={lp.dropSection}>Existing labels</div>
              {unapplied.map(label => (
                <div
                  key={label.id}
                  style={lp.dropItem}
                  onClick={() => { applyLabel(label.id); setOpen(false); }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: label.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--t2)' }}>{label.name}</span>
                </div>
              ))}
              <div style={lp.divider} />
            </>
          )}

          {/* All applied already */}
          {unapplied.length === 0 && labels.length > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--t4)', padding: '6px 10px' }}>
              All labels applied 
            </div>
          )}

          {/* Create new */}
          <div style={lp.dropSection}>Create new label</div>
          <div style={lp.createRow}>
            <input
              autoFocus
              placeholder="Label name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              style={lp.input}
            />
            <button onClick={handleCreate} style={lp.createBtn}>+</button>
          </div>
        </div>
      )}
    </div>
  );
}

// LabelPanel styles
const lp = {
  wrap: {
    padding: '12px 24px 14px',
    borderBottom: '1px solid var(--b1)',
    background: 'var(--surface2)',
    position: 'relative',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  },
  sectionLabel: {
    fontSize: 11.5, fontWeight: 600, color: 'var(--t3)',
    textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0,
  },
  chips: {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1,
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 9px', borderRadius: 12,
    fontSize: 11, fontWeight: 600, cursor: 'default',
  },
  removeX: {
    cursor: 'pointer', fontSize: 14, opacity: 0.65,
    marginLeft: 2, lineHeight: 1,
    transition: 'opacity .15s',
  },
  addBtn: {
    padding: '3px 12px', borderRadius: 12,
    background: 'var(--surface)', border: '1px solid var(--b2)',
    color: 'var(--t3)', fontSize: 11.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 24,
    zIndex: 100, marginTop: 6,
    background: 'var(--surface)', border: '1px solid var(--b2)',
    borderRadius: 'var(--rad-sm)', padding: '8px 0',
    minWidth: 200, maxWidth: 260,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  },
  dropSection: {
    fontSize: 10, fontWeight: 700, color: 'var(--t4)',
    textTransform: 'uppercase', letterSpacing: '.08em',
    padding: '4px 12px 4px',
  },
  dropItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 12px', cursor: 'pointer',
    transition: 'background .12s',
  },
  divider: { height: 1, background: 'var(--b1)', margin: '6px 0' },
  createRow: {
    display: 'flex', gap: 6, padding: '6px 12px 4px',
  },
  input: {
    flex: 1, padding: '6px 10px', fontSize: 12,
    background: 'var(--bg3)', border: '1px solid var(--b2)',
    borderRadius: 6, color: 'var(--t1)',
    fontFamily: 'var(--font)', outline: 'none',
  },
  createBtn: {
    padding: '6px 12px', fontSize: 14, fontWeight: 700,
    background: 'var(--teal-soft)', border: '1px solid var(--teal)55',
    borderRadius: 6, color: 'var(--teal3)',
    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
  },
};

// ─── EmailView ────────────────────────────────────────────────────────────────
export default function EmailView({ email, classifyData, sentimentData, onRefreshSentiment, onPrevEmail, onNextEmail }) {
  const [reaction,     setReaction]     = useState(null);
  const [aiResult,     setAiResult]     = useState('');
  const [aiLoading,    setAiLoading]    = useState('');
  const [activeAction, setActiveAction] = useState('');
  const [expanded,     setExpanded]     = useState(false);
  const [showScores,   setShowScores]   = useState(false);

  useEffect(() => {
    setAiResult('');
    setReaction(null);
    setExpanded(false);
    setActiveAction('');
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

  const body       = cleanForDisplay(email.body ?? email.snippet ?? email.text ?? '');
  const category   = classifyData?.category ?? 'unknown';
  const confidence = classifyData?.confidence ?? 0;
  const allScores  = classifyData?.all_scores ?? {};
  const sentiment  = sentimentData?.sentiment ?? 'unknown';
  const sentConf   = sentimentData?.confidence ?? 0;
  const sentExp    = sentimentData?.explanation ?? '';
  const toneTags   = sentimentData?.tone_tags ?? [];
  const sInfo      = getSentimentStyle(sentiment);

  async function runAction(label, apiFn) {
    if (!body) { setAiResult('No email content to process.'); return; }
    setAiLoading(label);
    setAiResult('');
    setActiveAction(label);
    try {
      const res  = await apiFn(body);
      const text = res.summary ?? res.caption ?? (res.status === 200 ? ' Done' : JSON.stringify(res));
      setAiResult(text);
    } catch (e) {
      setAiResult('Error: ' + e.message);
    } finally {
      setAiLoading('');
    }
  }

  function formatSummaryAsBullets(text) {
    if (!text) return null;
    let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 1) lines = lines[0].split(/(?<=\.)\s+/).map(s => s.trim()).filter(s => s.length > 0);
    const cleaned = lines.map(l => l.replace(/^[\s\-*•\d\.)]+/, '').trim()).filter(l => l.length > 0);
    return (
      <ul style={{ margin: 0, paddingLeft: 16, listStyleType: 'disc' }}>
        {cleaned.map((line, idx) => (
          <li key={idx} style={{ marginBottom: 8, color: 'var(--t2)', fontSize: 13.5, lineHeight: 1.6 }}>{line}</li>
        ))}
      </ul>
    );
  }

  const initials = (email.sender ?? 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={styles.wrap}>
      <div style={{ flex: '1 1 0px', overflowY: 'auto', padding: 20, position: 'relative' }}>

        {/* ── Email Content Card ── */}
        <div style={styles.contentCard} className="glass-panel">

          {/* Subject + Nav */}
          <div style={styles.unifiedHeader}>
            <div className="email-view-subject" style={styles.subj}>
              {email.subject ?? '(no subject)'}
            </div>
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

          {/* Sender meta */}
          <div style={styles.meta}>
            <div style={styles.avatar}>{initials}</div>
            <div style={{ flex: 1 }}>
              <div style={styles.from}>{email.sender?.split('<')[0]?.trim() ?? 'Unknown'}</div>
              <div style={styles.emailAddr}>{email.sender?.match(/<(.+)>/)?.[1] ?? ''}</div>
            </div>
            <div style={styles.date}>{email.date ?? ''}</div>
          </div>

          {/* ── Manual Labels Panel ── */}
          <LabelPanel emailId={String(email.id)} />

          {/* Body */}
          <div style={styles.body}>
            {(() => {
              if (!body) return <span style={{ color: 'var(--t4)' }}>No content available.</span>;
              if (!expanded && body.length > 250) {
                return (
                  <div>
                    {body.slice(0, 250).split('\n').map((line, i) => <p key={i} style={{ marginBottom: 8 }}>{line}</p>)}
                    <span style={{ color: 'var(--t4)' }}>…</span>
                    <button
                      onClick={() => setExpanded(true)}
                      style={styles.readMoreBtn}
                      onMouseEnter={e => { e.target.style.background = 'var(--maroon-dim)'; e.target.style.color = 'var(--maroon4)'; }}
                      onMouseLeave={e => { e.target.style.background = 'var(--surface2)';   e.target.style.color = 'var(--maroon3)'; }}
                    >
                      Read More
                    </button>
                  </div>
                );
              }
              return (
                <div>
                  {body.split('\n').map((line, i) => <p key={i} style={{ marginBottom: 8 }}>{line}</p>)}
                  {body.length > 250 && (
                    <button
                      onClick={() => setExpanded(false)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--t4)', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginTop: 12, fontFamily: 'var(--font)', textDecoration: 'underline' }}
                    >
                      Show Less
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── AI & Meta Panel ── */}
        <div style={styles.aiPanel} className="glass-panel">

          {/* Sentiment */}
          <div style={styles.sentBar}>
            <span style={styles.sentLabel}>Sentiment Analysis:</span>
            <span style={{
              background: sInfo.background, color: sInfo.color,
              borderColor: sInfo.borderColor, fontSize: 12.5,
              padding: '6px 14px', borderRadius: 20,
              border: '1px solid', display: 'inline-flex',
              alignItems: 'center', gap: 6, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0,0,0,.05)',
            }}>
              <span style={{ fontSize: 15 }}>{sInfo.emoji}</span>
              {sentiment.toUpperCase()}
            </span>
            <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--t3)', fontWeight: 550 }}>{sentConf}% confident</span>
            {toneTags.length > 0 && (
              <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--t4)' }}>· {toneTags.join(', ')}</span>
            )}
            <button style={styles.reanalyzeBtn} onClick={onRefreshSentiment} title="Reanalyze Sentiment">Refresh</button>
          </div>

          {/* Category */}
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--b1)' }}>
            <span style={styles.sentLabel}>Category:</span>
            <span className={`tag cat-${category}`}>{category.replace(/_/g, ' ')}</span>
            <div style={{ width: 120 }}>
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
                      <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${score}%`, height: '100%', background: 'var(--maroon3)' }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* AI action buttons */}
          <div style={styles.aiBar}>
            {[
              { label: 'Summarize', action: () => runAction('summarize', summarizeEmail) },
              { label: 'Caption',   action: () => runAction('caption',   captionEmail)   },
              { label: 'Calendar',  action: () => runAction('calendar',  createCalendarEvent) },
            ].map(btn => (
              <button
                key={btn.label}
                style={{ ...styles.aiBtn, opacity: aiLoading && aiLoading !== btn.label.toLowerCase() ? 0.5 : 1 }}
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
              {activeAction === 'summarize'
                ? formatSummaryAsBullets(aiResult)
                : <div style={{ whiteSpace: 'pre-wrap' }}>{aiResult}</div>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--panel-gradient)', overflow: 'hidden', minWidth: 0, minHeight: 0, height: '100%' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: 0.5 },
  unifiedHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--b2)',
    background: 'var(--surface2)',
    borderTopLeftRadius: 'var(--rad-lg)', borderTopRightRadius: 'var(--rad-lg)',
  },
  subj: { fontSize: 16.5, fontWeight: 800, color: 'var(--t1)', flex: 1, lineHeight: 1.35, letterSpacing: '-.015em' },
  actions: { display: 'flex', gap: 8, flexShrink: 0 },
  mvBtn: { width: 36, height: 36, borderRadius: 'var(--rad-sm)', border: '1px solid var(--b2)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', color: 'var(--t2)' },
  contentCard: { background: 'var(--card-gradient)', borderRadius: 'var(--rad-lg)', border: '1px solid var(--b2)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.15)', transition: 'box-shadow .3s ease', marginBottom: 20 },
  meta: { display: 'flex', alignItems: 'center', gap: 11, padding: '14px 20px', borderBottom: '1px solid var(--b2)', background: 'var(--surface2)', borderLeft: '3px solid var(--maroon3)', paddingLeft: 17 },
  avatar: { width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,var(--maroon3),var(--maroon))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', boxShadow: '0 4px 12px var(--maroon-glow)' },
  from: { fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 },
  emailAddr: { fontSize: 12.5, color: 'var(--t3)' },
  date: { marginLeft: 'auto', fontSize: 12.5, color: 'var(--t3)' },
  body: { padding: 24, fontSize: 14.5, lineHeight: 1.8, color: 'var(--t2)' },
  readMoreBtn: { background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-xs)', padding: '6px 14px', color: 'var(--maroon3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 12, fontFamily: 'var(--font)', textTransform: 'uppercase', letterSpacing: '.04em', transition: 'all .2s', display: 'block' },
  aiPanel: { background: 'var(--card-gradient)', borderRadius: 'var(--rad-lg)', border: '1px solid var(--b2)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.15)', marginBottom: 20 },
  sentBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px', borderBottom: '1px solid var(--b2)', background: 'var(--surface2)', flexWrap: 'wrap', borderTopLeftRadius: 'var(--rad-lg)', borderTopRightRadius: 'var(--rad-lg)' },
  sentLabel: { fontSize: 12.5, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' },
  reanalyzeBtn: { marginLeft: 'auto', background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', cursor: 'pointer', padding: '6px 12px', fontSize: 12, color: 'var(--t2)', transition: 'all .2s' },
  scoresBtn: { marginLeft: 'auto', background: 'transparent', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', cursor: 'pointer', padding: '6px 14px', fontSize: 11.5, color: 'var(--t2)', fontFamily: 'var(--font)', transition: 'all .2s' },
  aiResult: { margin: '0 24px 24px', padding: '16px 20px', background: 'var(--ai-bubble-gradient)', border: '1px solid var(--b3)', borderLeft: '4px solid var(--maroon3)', borderRadius: 'var(--rad)', fontSize: 13.5, color: 'var(--t1)', lineHeight: 1.7, boxShadow: '0 4px 16px var(--maroon-glow)' },
  aiBar: { display: 'flex', gap: 12, padding: '16px 24px 24px', borderTop: '1px solid var(--b1)', flexShrink: 0 },
  aiBtn: { flex: 1, padding: '12px 0', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)', color: 'var(--t1)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s ease', boxShadow: '0 2px 8px rgba(0,0,0,.05)' },
};