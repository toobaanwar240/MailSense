/**
 * pages/ChatPage.jsx
 * Premium RAG Chat Assistant with localStorage persistence and automatic vertical bullet-point list formatting.
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
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('ms_rag_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef(null);

  // Auto scroll to bottom when history changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Sync state to localStorage on any change
  useEffect(() => {
    localStorage.setItem('ms_rag_history', JSON.stringify(history));
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
      setHistory(h => [...h, { role: 'bot', text: 'Error: ' + e.message, sources: [] }]);
    } finally {
      setLoading(false);
    }
  }

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('ms_rag_history');
  };

  // Dynamically parses and formats bot answers vertically as bullet points if list-patterns are detected
  function formatBotAnswer(text) {
    if (!text) return '';
    
    // Check for inline numbered list patterns like "1. " or "2. "
    const hasNumberedList = /\b\d+\.\s+/.test(text);
    if (hasNumberedList) {
      const firstIndex = text.search(/\b\d+\.\s+/);
      if (firstIndex !== -1) {
        const intro = text.substring(0, firstIndex).trim();
        const listPart = text.substring(firstIndex);
        
        // Split list items safely
        const items = listPart.split(/\s*\b\d+\.\s+/).filter(item => item.trim().length > 0);
        
        return (
          <div>
            {intro && <p style={{ marginBottom: 12, fontWeight: 600, color: 'var(--t1)' }}>{intro}</p>}
            <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc' }}>
              {items.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '8px', color: 'var(--t2)', fontSize: '13.5px', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
          </div>
        );
      }
    }

    // Default: split paragraphs vertically
    const paragraphs = text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    return (
      <div>
        {paragraphs.map((p, idx) => (
          <p key={idx} style={{ marginBottom: idx === paragraphs.length - 1 ? 0 : 12 }} dangerouslySetInnerHTML={{ __html: p }} />
        ))}
      </div>
    );
  }

  if (ragStatus === 'idle') {
    return (
      <div style={styles.center}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>Index Your Emails</div>
        <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 24, textAlign: 'center', maxWidth: 400 }}>
          To chat with your emails, we first need to build a secure, private index.
        </div>
        <button style={styles.primaryBtn} onClick={onTriggerIndex}>Start Indexing</button>
      </div>
    );
  }

  if (ragStatus === 'indexing') {
    return (
      <div style={styles.center}>
        <div style={{ fontSize: 40, marginBottom: 16 }}><div style={styles.spinner}></div></div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>Indexing in progress…</div>
        <div style={{ fontSize: 13.5, color: 'var(--t3)' }}>Page will update automatically when ready.</div>
      </div>
    );
  }

  const STATUS_UI = {
    idle:     { icon: '●', label: 'Index Pending', color: '#6C757D' },
    indexing: { icon: '●', label: 'Indexing...', color: '#FFC107' },
    ready:    { icon: '●', label: 'AI Assistant Online', color: '#28A745' },
  };
  const statusInfo = STATUS_UI[ragStatus] || STATUS_UI.ready;

  return (
    <div style={styles.wrap}>
      {/* Premium Header Bar */}
      <div style={styles.headerBar} className="glass">
        <div>
          <div style={styles.headerTitle}>RAG Chat Assistant</div>
          <div style={styles.headerSubtitle}>Interact securely and privately with your email history</div>
        </div>
        <div style={styles.statusBadge} className="glass-panel">
          <span style={{ color: statusInfo.color, marginRight: 8, fontSize: 10, filter: 'drop-shadow(0 0 4px currentColor)' }}>{statusInfo.icon}</span>
          <span style={{ fontWeight: 600 }}>{statusInfo.label}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.msgs}>
        {history.length === 0 && (
          <div style={styles.welcome} className="glass-panel">
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 12 }}>Ask me anything about your emails</div>
            <div style={{ color: 'var(--t3)', fontSize: 14, lineHeight: 1.8 }}>
              I can find emails from a specific person, summarize conversations,
              identify urgent items, and search by topic. Just type below.
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} style={{ ...styles.msg, ...(msg.role === 'user' ? styles.msgUser : styles.msgBot) }}>
            <div style={{ ...styles.cav, ...(msg.role === 'user' ? styles.cavUser : styles.cavBot) }}>
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            <div style={{ ...styles.bub, ...(msg.role === 'user' ? styles.bubUser : styles.bubBot) }}>
              {msg.role === 'user' ? (
                <span dangerouslySetInnerHTML={{ __html: msg.text }} />
              ) : (
                formatBotAnswer(msg.text)
              )}
              
              {msg.sources?.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--b1)', fontSize: 12, color: 'var(--t4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Based on {msg.sources.length} email{msg.sources.length > 1 ? 's' : ''}</span>
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
            <div style={{ ...styles.bub, ...styles.bubBot, color: 'var(--t4)', fontStyle: 'italic', padding: '12px 20px' }}>Thinking...</div>
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
      <div style={styles.inputBar} className="glass">
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
          <button style={styles.clearBtn} onClick={handleClearHistory} title="Clear Chat History">
            Clear All Chats
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap:   { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg)' },
  headerBar: {
    padding: '16px 32px',
    borderBottom: '1px solid var(--b1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--surface)',
    backdropFilter: 'blur(10px)',
    zIndex: 10
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--t1)',
    letterSpacing: '-.01em'
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: 'var(--t4)',
    marginTop: 2
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 12,
    background: 'var(--surface2)',
    border: '1px solid var(--b2)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  center: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 },
  msgs:   { flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 },
  welcome:{ background: 'var(--surface)', border: '1px solid var(--b1)', borderRadius: 'var(--rad-lg)', padding: '32px 40px', maxWidth: 540, margin: '0 auto', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' },
  msg:    { display: 'flex', gap: 16, alignItems: 'flex-start', maxWidth: '85%' },
  msgUser:{ flexDirection: 'row-reverse', alignSelf: 'flex-end' },
  msgBot: { alignSelf: 'flex-start' },
  cav:    { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  cavUser:{ background: 'linear-gradient(135deg, var(--slate), var(--slate2))', color: '#fff' },
  cavBot: { background: 'linear-gradient(135deg, var(--maroon3), var(--maroon))', color: '#fff', boxShadow: '0 4px 12px var(--maroon-glow)' },
  bub:    { padding: '16px 20px', borderRadius: 'var(--rad-lg)', fontSize: 14, lineHeight: 1.7 },
  bubUser:{ background: 'var(--surface2)', border: '1px solid var(--b2)', color: 'var(--t1)', borderRadius: '16px 4px 16px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
  bubBot: { background: 'var(--ai-bubble-gradient)', border: '1px solid var(--b2)', color: 'var(--t1)', borderRadius: '4px 16px 16px 16px', boxShadow: '0 4px 12px var(--maroon-glow)' },
  srcBtn: { background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', padding: '6px 12px', color: 'var(--t2)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11.5, fontWeight: 600, transition: 'all .2s ease' },
  sugs:   { display: 'flex', gap: 10, padding: '0 32px 16px', flexWrap: 'wrap', justifyContent: 'center' },
  sug:    { padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 24, color: 'var(--t3)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  inputBar: { display: 'flex', gap: 12, padding: '20px 32px', borderTop: '1px solid var(--b1)', background: 'var(--surface)', flexShrink: 0, zIndex: 10 },
  textarea: { flex: 1, background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)', padding: '14px 18px', fontSize: 14, color: 'var(--t1)', fontFamily: 'var(--font)', outline: 'none', resize: 'none', transition: 'border-color .2s ease', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' },
  sendBtn: { padding: '0 24px', background: 'linear-gradient(135deg, var(--maroon), var(--maroon3))', color: '#fff', border: 'none', borderRadius: 'var(--rad)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s ease', boxShadow: '0 4px 12px var(--maroon-glow)' },
  clearBtn: { padding: '0 20px', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--maroon3)', transition: 'all .2s ease', fontFamily: 'var(--font)' },
  primaryBtn: { padding: '14px 32px', background: 'linear-gradient(135deg, var(--maroon), var(--maroon3))', color: '#fff', border: 'none', borderRadius: 'var(--rad)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer', fontFamily: 'var(--font)', boxShadow: '0 8px 24px var(--maroon-glow)', transition: 'transform .2s' },
  spinner: { width: 30, height: 30, border: '4px solid var(--b1)', borderTop: '4px solid var(--maroon3)', borderRadius: '50%', animation: 'spin 1s linear infinite' }
};
