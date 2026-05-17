/**
 * pages/ComposePage.jsx
 * Premium Compose Email Page
 */
import React, { useState, useEffect } from 'react';
import { cleanForDisplay } from '../utils/cleanEmail.js';
import { sendEmail, generateReply, generateEmail as apiGenerateEmail } from '../api/client.js';

const TONES = ['professional', 'formal', 'casual', 'friendly', 'assertive'];

export default function ComposePage({ selectedEmail, emails = [] }) {
  const [mode, setMode]         = useState('new');   // 'new' | 'reply'
  const [to, setTo]             = useState('');
  const [subject, setSubject]   = useState('');
  const [body, setBody]         = useState('');
  const [tone, setTone]         = useState('professional');
  const [topic, setTopic]       = useState('');
  const [extraCtx, setExtraCtx] = useState('');
  const [preview, setPreview]   = useState(null);    // {subject, body, intent?}
  const [aiLoading, setAiLoading] = useState(false);
  const [sendState, setSendState] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  const [sendMsg, setSendMsg]   = useState('');
  const [currentReplyEmail, setCurrentReplyEmail] = useState(selectedEmail || null);

  const isReply = mode === 'reply';
  const top20Emails = (emails || []).slice(0, 20);

  // Sync selected email from props
  useEffect(() => {
    if (selectedEmail) {
      setCurrentReplyEmail(selectedEmail);
    }
  }, [selectedEmail?.id]);

  // Pre-select first email of top 20 if in reply mode and none selected
  useEffect(() => {
    if (isReply && !currentReplyEmail && top20Emails.length > 0) {
      setCurrentReplyEmail(top20Emails[0]);
    }
  }, [isReply, emails]);

  // Prefill fields when mode or selected reply email changes
  useEffect(() => {
    if (isReply && currentReplyEmail) {
      setTo(currentReplyEmail.sender ?? currentReplyEmail.from ?? '');
      setSubject('Re: ' + (currentReplyEmail.subject ?? ''));
      setBody('');
    } else if (!isReply) {
      setTo(''); setSubject(''); setBody('');
    }
    setPreview(null);
  }, [mode, currentReplyEmail?.id]);

  async function handleGenerateReply() {
    if (!currentReplyEmail) return;
    setAiLoading(true);
    try {
      const res = await generateReply({
        sender:     currentReplyEmail.sender ?? '',
        subject:    currentReplyEmail.subject ?? '',
        email_text: cleanForDisplay(currentReplyEmail.body ?? ''),
        your_name:  'Assistant',
        tone,
      });
      setPreview({ subject: res.reply_subject ?? '', body: res.reply_body ?? '', intent: res.detected_intent });
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleGenerateNew() {
    if (!topic.trim()) { alert('Describe what the email should be about.'); return; }
    setAiLoading(true);
    try {
      const res = await apiGenerateEmail({ to, topic, tone, additional_context: extraCtx });
      setPreview({ subject: res.subject ?? '', body: res.body ?? '' });
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  }

  function applyPreview() {
    if (!preview) return;
    setSubject(preview.subject);
    setBody(preview.body);
    setPreview(null);
  }

  async function handleSend() {
    if (!to.trim())      { setSendMsg('Enter recipient.'); return; }
    if (!subject.trim()) { setSendMsg('Enter subject.');   return; }
    if (!body.trim())    { setSendMsg('Enter body.');      return; }
    setSendState('sending'); setSendMsg('');
    try {
      await sendEmail({ to, subject, body });
      setSendState('sent');
      setSendMsg(`Sent to ${to}!`);
      setTo(''); setSubject(''); setBody('');
    } catch (e) {
      setSendState('error');
      setSendMsg('Failed: ' + e.message);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.inner} className="glass-panel">
        <div style={styles.header}>
          <div style={styles.pageTitle}>{isReply ? 'Reply to Email' : 'Compose New'}</div>
          
          {/* Mode toggle */}
          <div style={styles.modeRow}>
            {['new', 'reply'].map(m => (
              <button
                key={m}
                style={{ ...styles.modeBtn, ...(mode === m ? styles.modeBtnActive : {}) }}
                onClick={() => setMode(m)}
              >
                {m === 'new' ? 'New' : 'Reply'}
              </button>
            ))}
          </div>
        </div>

        {isReply && (
          <div style={styles.formGroup}>
            <Label style={{ color: 'var(--maroon3)' }}>Select Email to Reply to</Label>
            <select
              value={currentReplyEmail?.id || ''}
              onChange={(e) => {
                const selectedId = e.target.value;
                const chosen = top20Emails.find(em => em.id === selectedId);
                if (chosen) {
                  setCurrentReplyEmail(chosen);
                  setTo(chosen.sender ?? chosen.from ?? '');
                  setSubject('Re: ' + (chosen.subject ?? ''));
                  setPreview(null);
                }
              }}
              style={{
                width: '100%',
                background: 'var(--surface2)',
                color: 'var(--t1)',
                cursor: 'pointer',
                padding: '12px 16px',
                fontWeight: 600,
                border: '1px solid var(--b2)',
                borderRadius: 'var(--rad-sm)',
                outline: 'none',
                fontFamily: 'var(--font)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                marginBottom: 20
              }}
            >
              <option value="" disabled style={{ background: 'var(--surface)' }}>-- Click & Select an email to reply --</option>
              {top20Emails.map(em => (
                <option key={em.id} value={em.id} style={{ background: 'var(--surface)', color: 'var(--t1)' }}>
                  {`${em.sender?.split('<')[0]?.trim() || 'Unknown'} — ${em.subject || '(no subject)'}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Fields */}
        <div style={styles.formGroup}>
          <Label>To</Label>
          <input style={styles.field} value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" />
        </div>

        <div style={styles.formGroup}>
          <Label>Subject</Label>
          <input style={styles.field} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
        </div>

        <div style={styles.formGroup}>
          <Label>Message Body</Label>
          <textarea style={{ ...styles.field, height: 200, resize: 'vertical' }} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message here…" />
        </div>

        {isReply && currentReplyEmail && (
          <div style={styles.aiSection}>
            <div style={styles.aiHeader}>
              <svg viewBox="0 0 16 16" fill="none" stroke="var(--maroon3)" strokeWidth="1.5" strokeLinecap="round" width={16} height={16}>
                <circle cx="8" cy="8" r="7"/>
                <path d="M8 5v4M8 11h.01"/>
              </svg>
              Smart Reply Generator
            </div>
            
            <Label style={{ fontSize: 11, letterSpacing: '.04em' }}>Tone</Label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {TONES.map(t => (
                <button
                  key={t}
                  type="button"
                  style={{ ...styles.tonePill, ...(tone === t ? styles.tonePillActive : {}) }}
                  onClick={() => setTone(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              type="button"
              style={styles.aiBtn}
              disabled={aiLoading}
              onClick={handleGenerateReply}
            >
              {aiLoading ? 'Generating Smart Reply…' : 'Generate Smart Reply'}
            </button>

            {preview && (
              <div style={styles.preview}>
                <div style={styles.previewTitle}>Generated Draft Suggestion</div>
                {preview.intent && <div style={{ fontSize: 12, color: 'var(--t4)', marginBottom: 12 }}>Intent: {preview.intent}</div>}
                <div style={{ fontSize: 13.5, color: 'var(--t2)', marginBottom: 12, fontWeight: 600 }}>Subject: {preview.subject}</div>
                <div style={styles.previewBody}>{preview.body}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button type="button" style={styles.useBtn} onClick={() => { setBody(preview.body); setSubject(preview.subject); setPreview(null); }}>Apply Draft</button>
                  <button type="button" style={styles.discardBtn} onClick={() => setPreview(null)}>Discard</button>
                </div>
              </div>
            )}
          </div>
        )}



        {/* Send */}
        <div style={styles.divider} />
        <button style={styles.sendBtn} onClick={handleSend} disabled={sendState === 'sending'}>
          {sendState === 'sending' ? 'Sending…' : 'Send Email'}
        </button>
        {sendMsg && (
          <div style={{ marginTop: 16, fontSize: 14, fontWeight: 500, textAlign: 'center', color: sendState === 'sent' ? 'var(--pos-t)' : 'var(--neg-t)' }}>
            {sendMsg}
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{children}</div>;
}

const styles = {
  wrap:    { flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '32px 0' },
  inner:   { maxWidth: 720, margin: '0 auto', padding: '32px 40px', borderRadius: 'var(--rad-lg)', border: '1px solid var(--b1)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' },
  header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-.02em', margin: 0 },
  modeRow: { display: 'flex', gap: 8, background: 'var(--surface2)', padding: '4px', borderRadius: 'var(--rad)' },
  modeBtn: { padding: '8px 16px', background: 'transparent', border: 'none', borderRadius: 'var(--rad-sm)', color: 'var(--t3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, transition: 'all .2s' },
  modeBtnActive: { background: 'var(--maroon-glow)', color: 'var(--maroon3)', fontWeight: 600 },
  warn:    { padding: '12px 16px', background: 'rgba(212, 168, 40, 0.1)', border: '1px solid rgba(212, 168, 40, 0.3)', borderRadius: 'var(--rad-sm)', color: '#D4A828', fontSize: 13.5, marginBottom: 20 },
  refBox:  { padding: '14px 18px', background: 'var(--surface2)', border: '1px solid var(--b2)', borderLeft: '4px solid var(--maroon3)', borderRadius: 'var(--rad-sm)', fontSize: 14, color: 'var(--t2)', marginBottom: 24 },
  formGroup: { marginBottom: 20 },
  field:   { width: '100%', background: 'var(--bg3)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)', padding: '12px 16px', fontSize: 14, color: 'var(--t1)', fontFamily: 'var(--font)', outline: 'none', transition: 'border-color .2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' },
  aiSection: { marginTop: 32, padding: '24px', background: 'var(--surface2)', borderRadius: 'var(--rad)', border: '1px solid var(--b2)' },
  aiHeader: { fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  tonePill:{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 20, color: 'var(--t3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, transition: 'all .2s', textTransform: 'capitalize' },
  tonePillActive: { background: 'var(--maroon-glow)', borderColor: 'var(--maroon)', color: 'var(--maroon3)', fontWeight: 600, boxShadow: '0 2px 8px var(--maroon-glow)' },
  aiBtn:   { width: '100%', padding: '12px 0', background: 'linear-gradient(135deg, var(--maroon), var(--maroon3))', color: '#fff', border: 'none', borderRadius: 'var(--rad-sm)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s', boxShadow: '0 4px 12px var(--maroon-glow)' },
  preview: { marginTop: 24, padding: 20, background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)' },
  previewTitle: { fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 12 },
  previewBody:  { background: 'var(--bg3)', borderRadius: 'var(--rad-sm)', padding: 16, fontSize: 14, color: 'var(--t2)', whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: 300, overflowY: 'auto', border: '1px solid var(--b2)' },
  useBtn:    { flex: 1, padding: '10px 0', background: 'var(--maroon-glow)', border: '1px solid var(--maroon)', borderRadius: 'var(--rad-sm)', color: 'var(--maroon3)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s' },
  discardBtn:{ flex: 1, padding: '10px 0', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', color: 'var(--t3)', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s' },
  divider: { height: 1, background: 'var(--b1)', margin: '32px 0 24px' },
  sendBtn: { width: '100%', padding: '14px 0', background: 'linear-gradient(135deg, var(--maroon), var(--maroon3))', color: '#fff', border: 'none', borderRadius: 'var(--rad)', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '.02em', boxShadow: '0 8px 24px var(--maroon-glow)', transition: 'transform .2s' },
};
