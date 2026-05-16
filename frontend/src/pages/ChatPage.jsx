/**
 * pages/ChatPage.jsx
 * Replaces Tab 2 (💬 Chat Assistant) from Streamlit.
 * Uses askRag() from the API client.
 */
import React, { useState, useRef, useEffect } from 'react';
import { askRag } from '../api/client.js';

const SUGGESTIONS = [
  'Show unread from this week',
  'Financial emails',
  'Priority summary',
  'Urgent replies needed',
];

export default function ChatPage({ ragStatus, onTriggerIndex, onViewSources }) {
  const [history, setHistory]   = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput('');
    setLoading(true);
    const userMsg = { role: 'user', text: q };
    setHistory(h => [...h, userMsg]);
    try {
      const res = await askRag(q);
      if (res.status === 'indexing' || res.status === 'idle') {
        setHistory(h => [...h, { role: 'bot', text: res.answer ?? 'Still indexing, please wait.', sources: [] }]);
      } else {
        setHistory(h => [...h, { role: 'bot', text: res.answer ?? 'No answer', sources: res.sources ?? [] }]);
      }
    } catch (e) {
      setHistory(h => [...h, { role: 'bot', text: '❌ Error: ' + e.message, sources: [] }]);
    } finally {
      setLoading(false);
    }
  }

  if (ragStatus === 'idle') {
    return (
      <div style={styles.center}>
        <div style={{ fontSize: 15, color: 'var(--t2)', marginBottom: 16 }}>📭 Emails not indexed yet.</div>
        <button style={styles.primaryBtn} onClick={onTriggerIndex}>🔄 Start Indexing</button>
      </div>
    );
  }

  if (ragStatus === 'indexing') {
    return (
      <div style={styles.center}>
        <div style={{ fontSize: 14, color: 'var(--t3)' }}>⏳ Indexing in progress… Page will update when done.</div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {/* Messages */}
      <div style={styles.msgs}>
        {history.length === 0 && (
          <div style={styles.welcome}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 }}>💬 Ask me anything about your emails</div>
            <div style={{ color: 'var(--t3)', fontSize: 13, lineHeight: 1.8 }}>
              I can find emails from a specific person, summarize conversations,
              identify urgent items, and search by topic.
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} style={{ ...styles.msg, ...(msg.role === 'user' ? styles.msgUser : styles.msgBot) }}>
            <div style={{ ...styles.cav, ...(msg.role === 'user' ? styles.cavUser : styles.cavBot) }}>
              {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <div style={{ ...styles.bub, ...(msg.role === 'user' ? styles.bubUser : styles.bubBot) }}>
              <span dangerouslySetInnerHTML={{ __html: msg.text }} />
              {msg.sources?.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--t4)' }}>
                  📚 Based on {msg.sources.length} email{msg.sources.length > 1 ? 's' : ''}
                  <button
                    style={styles.srcBtn}
                    onClick={() => onViewSources({ answer: msg.text, sources: msg.sources, question: history[i - 1]?.text ?? '' })}
                  >
                    View sources →
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ ...styles.msg, ...styles.msgBot }}>
            <div style={{ ...styles.cav, ...styles.cavBot }}>AI</div>
            <div style={{ ...styles.bub, ...styles.bubBot, color: 'var(--t4)', fontStyle: 'italic' }}>Thinking…</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {history.length === 0 && (
        <div style={styles.sugs}>
          {SUGGESTIONS.map(s => (
            <button key={s} style={styles.sug} onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={styles.inputBar}>
        <textarea
          style={styles.textarea}
          placeholder="Ask anything about your emails…"
          value={input}
          rows={1}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button style={styles.sendBtn} onClick={() => send()} disabled={loading || !input.trim()}>
          Send →
        </button>
        {history.length > 0 && (
          <button style={styles.clearBtn} onClick={() => setHistory([])}>🗑️</button>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap:   { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg2)' },
  center: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  msgs:   { flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  welcome:{ background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)', padding: 24, maxWidth: 480 },
  msg:    { display: 'flex', gap: 10, alignItems: 'flex-start' },
  msgUser:{ flexDirection: 'row-reverse' },
  msgBot: {},
  cav:    { width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 },
  cavUser:{ background: 'linear-gradient(135deg, var(--slate), var(--slate2))', color: '#fff' },
  cavBot: { background: 'linear-gradient(135deg, var(--teal-dim), var(--teal-soft))', color: 'var(--teal3)', border: '1px solid var(--teal)44' },
  bub:    { maxWidth: '70%', padding: '12px 16px', borderRadius: 'var(--rad)', fontSize: 13.5, lineHeight: 1.65 },
  bubUser:{ background: 'var(--slate-dim)', color: 'var(--t1)', borderRadius: '12px 2px 12px 12px' },
  bubBot: { background: 'var(--surface)', border: '1px solid var(--b2)', color: 'var(--t2)', borderRadius: '2px 12px 12px 12px' },
  srcBtn: { marginLeft: 8, background: 'transparent', border: 'none', color: 'var(--teal3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11.5 },
  sugs:   { display: 'flex', gap: 8, padding: '0 24px 12px', flexWrap: 'wrap' },
  sug:    { padding: '7px 14px', background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 20, color: 'var(--t3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s' },
  inputBar: { display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--b1)', background: 'var(--surface)', flexShrink: 0 },
  textarea: { flex: 1, background: 'var(--bg3)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--t1)', fontFamily: 'var(--font)', outline: 'none', resize: 'none' },
  sendBtn: { padding: '0 18px', background: 'linear-gradient(135deg, var(--teal-dim), var(--teal-soft))', color: 'var(--teal3)', border: '1px solid var(--teal)55', borderRadius: 'var(--rad-sm)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' },
  clearBtn: { padding: '0 12px', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', cursor: 'pointer', fontSize: 14 },
  primaryBtn: { padding: '10px 24px', background: 'linear-gradient(135deg, var(--teal-dim), var(--teal-soft))', color: 'var(--teal3)', border: '1px solid var(--teal)55', borderRadius: 'var(--rad-sm)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--font)' },
};
