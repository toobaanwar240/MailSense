/**
 * pages/ComposePage.jsx
 * Replaces Tab 4 (✉️ Compose) from Streamlit.
 * Handles new email + reply mode, AI generation preview, send.
 */
import React, { useState, useEffect } from 'react';
import { cleanForDisplay } from '../utils/cleanEmail.js';
import { sendEmail, generateReply, generateEmail as apiGenerateEmail } from '../api/client.js';

const TONES = ['professional', 'formal', 'casual', 'friendly', 'assertive'];

export default function ComposePage({ selectedEmail }) {
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

  const isReply = mode === 'reply';

  // Pre-fill fields when switching to reply mode
  useEffect(() => {
    if (isReply && selectedEmail) {
      setTo(selectedEmail.sender ?? selectedEmail.from ?? '');
      setSubject('Re: ' + (selectedEmail.subject ?? ''));
      setBody('');
    } else if (!isReply) {
      setTo(''); setSubject(''); setBody('');
    }
    setPreview(null);
  }, [mode, selectedEmail?.id]);

  async function handleGenerateReply() {
    if (!selectedEmail) return;
    setAiLoading(true);
    try {
      const res = await generateReply({
        sender:     selectedEmail.sender ?? '',
        subject:    selectedEmail.subject ?? '',
        email_text: cleanForDisplay(selectedEmail.body ?? ''),
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
      setSendMsg(`✅ Sent to ${to}!`);
      setTo(''); setSubject(''); setBody('');
    } catch (e) {
      setSendState('error');
      setSendMsg('❌ Failed: ' + e.message);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        <div style={styles.pageTitle}>✉️ {isReply ? 'Reply to Email' : 'New Email'}</div>

        {/* Mode toggle */}
        <div style={styles.modeRow}>
          {['new', 'reply'].map(m => (
            <button
              key={m}
              style={{ ...styles.modeBtn, ...(mode === m ? styles.modeBtnActive : {}) }}
              onClick={() => setMode(m)}
            >
              {m === 'new' ? '✏️ New Email' : '↩️ Reply to Selected'}
            </button>
          ))}
        </div>

        {isReply && !selectedEmail && (
          <div style={styles.warn}>⚠️ Select an email in the Inbox tab first.</div>
        )}

        {isReply && selectedEmail && (
          <div style={styles.refBox}>
            <strong style={{ color: 'var(--t1)' }}>Replying to:</strong> {selectedEmail.subject}
            <span style={{ color: 'var(--t4)', marginLeft: 10, fontSize: 11.5 }}>{selectedEmail.sender}</span>
          </div>
        )}

        {/* Fields */}
        <Label>To</Label>
        <input style={styles.field} value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" />

        <Label>Subject</Label>
        <input style={styles.field} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />

        <Label>Body</Label>
        <textarea style={{ ...styles.field, height: 180, resize: 'vertical' }} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message…" />

        {/* Tone */}
        <Label>Tone</Label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {TONES.map(t => (
            <button
              key={t}
              style={{ ...styles.tonePill, ...(tone === t ? styles.tonePillActive : {}) }}
              onClick={() => setTone(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* AI section */}
        {isReply ? (
          <button style={styles.aiBtn} disabled={aiLoading || !selectedEmail} onClick={handleGenerateReply}>
            {aiLoading ? '⏳ Generating…' : '🤖 Generate AI Reply'}
          </button>
        ) : (
          <>
            <Label>What should the email be about?</Label>
            <textarea style={{ ...styles.field, height: 70, resize: 'none' }} value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Ask client for 2-week extension due to resource constraints" />
            <Label>Extra details (optional)</Label>
            <input style={styles.field} value={extraCtx} onChange={e => setExtraCtx(e.target.value)} placeholder="e.g. Keep under 150 words, mention Friday deadline" />
            <button style={styles.aiBtn} disabled={aiLoading || !topic.trim()} onClick={handleGenerateNew}>
              {aiLoading ? '⏳ Generating…' : '✨ Generate Email'}
            </button>
          </>
        )}

        {/* Preview panel */}
        {preview && (
          <div style={styles.preview}>
            <div style={styles.previewTitle}>📋 Preview</div>
            {preview.intent && <div style={{ fontSize: 11.5, color: 'var(--t4)', marginBottom: 8 }}>🏷️ Intent: {preview.intent}</div>}
            <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 8 }}>Subject: {preview.subject}</div>
            <div style={styles.previewBody}>{preview.body}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={styles.useBtn} onClick={applyPreview}>✅ Use this</button>
              <button style={styles.discardBtn} onClick={() => setPreview(null)}>❌ Discard</button>
            </div>
          </div>
        )}

        {/* Send */}
        <div style={styles.divider} />
        <button style={styles.sendBtn} onClick={handleSend} disabled={sendState === 'sending'}>
          {sendState === 'sending' ? '⏳ Sending…' : '📧 Send'}
        </button>
        {sendMsg && (
          <div style={{ marginTop: 10, fontSize: 13, color: sendState === 'sent' ? 'var(--teal3)' : 'var(--crim3)' }}>
            {sendMsg}
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, marginTop: 14 }}>{children}</div>;
}

const styles = {
  wrap:    { flex: 1, overflowY: 'auto', background: 'var(--bg2)', padding: '20px 0' },
  inner:   { maxWidth: 640, margin: '0 auto', padding: '0 24px' },
  pageTitle: { fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 18, letterSpacing: '-.02em' },
  modeRow: { display: 'flex', gap: 8, marginBottom: 18 },
  modeBtn: { padding: '8px 18px', background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', color: 'var(--t3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12.5, transition: 'all .15s' },
  modeBtnActive: { background: 'var(--teal-soft)', borderColor: 'var(--teal)', color: 'var(--teal3)' },
  warn:    { padding: 12, background: '#1A1200', border: '1px solid #4A3800', borderRadius: 'var(--rad-sm)', color: '#D4A400', fontSize: 13, marginBottom: 14 },
  refBox:  { padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', fontSize: 13, color: 'var(--t2)', marginBottom: 14 },
  field:   { width: '100%', background: 'var(--surface2)', border: '1px solid var(--b1)', borderRadius: 'var(--rad-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--t1)', fontFamily: 'var(--font)', outline: 'none', marginBottom: 0, transition: 'border-color .15s' },
  tonePill:{ padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 20, color: 'var(--t3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, transition: 'all .15s' },
  tonePillActive: { background: 'var(--teal-soft)', borderColor: 'var(--teal)', color: 'var(--teal3)' },
  aiBtn:   { width: '100%', padding: '11px 0', marginTop: 12, background: 'linear-gradient(135deg, var(--teal-dim), var(--teal-soft))', color: 'var(--teal3)', border: '1px solid var(--teal)55', borderRadius: 'var(--rad-sm)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '.01em' },
  preview: { marginTop: 18, padding: 16, background: 'var(--surface2)', border: '1px solid var(--teal)33', borderRadius: 'var(--rad)' },
  previewTitle: { fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 },
  previewBody:  { background: 'var(--bg3)', borderRadius: 'var(--rad-sm)', padding: 14, fontSize: 13, color: 'var(--t2)', whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: 220, overflowY: 'auto' },
  useBtn:    { flex: 1, padding: '8px 0', background: 'var(--teal-soft)', border: '1px solid var(--teal)55', borderRadius: 'var(--rad-sm)', color: 'var(--teal3)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' },
  discardBtn:{ flex: 1, padding: '8px 0', background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', color: 'var(--t3)', cursor: 'pointer', fontFamily: 'var(--font)' },
  divider: { height: 1, background: 'var(--b1)', margin: '20px 0' },
  sendBtn: { width: '100%', padding: '12px 0', background: 'linear-gradient(135deg, var(--crim-dim), var(--crim-soft))', color: 'var(--crim3)', border: '1px solid var(--crim)55', borderRadius: 'var(--rad-sm)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '.02em' },
};
