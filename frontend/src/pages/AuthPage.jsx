/**
 * pages/AuthPage.jsx
 * Replaces Streamlit's auth block (if not st.session_state.token → show login).
 * Matches the auth-wrap / auth-left / auth-right design from mailsense_premium.html.
 */
import React, { useState } from 'react';
import { authLoginUrl } from '../api/client.js';

const FEATURES = [
  { icon: '🧠', title: 'RAG Chatbot',       desc: 'Query emails in natural language' },
  { icon: '💬', title: 'Sentiment AI',       desc: 'Tone analysis on every email'    },
  { icon: '⚡', title: 'Reply Generator',    desc: 'Instant smart responses'         },
  { icon: '🗂️', title: 'Smart Labels',       desc: 'Auto-categorized inbox'          },
];

const PILLS = [
  { label: 'Sentiment analysis', color: 'var(--teal3)' },
  { label: 'Smart summaries',    color: 'var(--slate3)' },
  { label: 'Event extraction',   color: '#B07DD0'       },
  { label: 'Auto-labeling',      color: '#9AAB44'       },
  { label: 'Urgency detection',  color: 'var(--crim3)'  },
  { label: 'Emoji reactions',    color: 'var(--r1)'     },
];

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [pass,  setPass ] = useState('');

  return (
    <div style={styles.wrap}>
      {/* Left — form */}
      <div style={styles.left}>
        {/* Glow effects */}
        <div style={styles.glowTl} />
        <div style={styles.glowBr} />

        <div style={styles.logoRow}>
          <div style={styles.logoMark}>
            <svg viewBox="0 0 16 16" fill="none" stroke="#F0C8C8" strokeWidth="1.6" strokeLinecap="round" width={17} height={17}>
              <path d="M1.5 5l6.5 4.5L14.5 5"/>
              <rect x="1.5" y="3.5" width="13" height="9" rx="2"/>
            </svg>
          </div>
          <span style={styles.wordmark}>Mail<span style={{ color: 'var(--teal3)' }}>Sense</span></span>
          <span style={styles.version}>v2.0</span>
        </div>

        <div style={styles.h}>Welcome <span style={{ color: 'var(--teal3)' }}>back</span></div>
        <div style={styles.sub}>Sign in to your intelligent inbox. AI-powered email management at your fingertips.</div>

        <a href={authLoginUrl()} style={styles.googleBtn}>
          <svg viewBox="0 0 24 24" width={20} height={20}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </a>

        {/* <div style={styles.divRow}><span>or sign in with email</span></div>

        <input style={styles.field} type="email"    placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={styles.field} type="password" placeholder="Password"      value={pass}  onChange={e => setPass(e.target.value)}  />
        <button style={styles.submit}>Sign in to MailSense →</button>  */}

        <div style={styles.featsGrid}>
          {FEATURES.map(f => (
            <div key={f.title} style={styles.feat}>
              <div style={styles.featIcon}>{f.icon}</div>
              <div style={styles.featTitle}>{f.title}</div>
              <div style={styles.featDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — marketing */}
      <div style={styles.right}>
        <div style={styles.rightGlow} />
        <div style={styles.bigTitle}>Your inbox,<br /><span style={{ color: 'var(--teal3)' }}>intelligently</span> managed</div>
        <div style={styles.bigSub}>MailSense uses cutting-edge RAG AI to understand, classify, and respond to your emails — so you focus on what matters.</div>
        <div style={styles.pillRow}>
          {PILLS.map(p => (
            <div key={p.label} style={styles.pill}>
              <div style={{ ...styles.pillDot, background: p.color }} />
              {p.label}
            </div>
          ))}
        </div>
        <div style={styles.palette}>
          {['#4A6FA5','#7E8F96','#1D9E75','#4A5220','#8C2020','#3A1010'].map(c => (
            <div key={c} style={{ ...styles.swatch, background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap:      { flex: 1, display: 'flex', background: 'var(--void)' },
  left:      { width: 420, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 50px', borderRight: '1px solid var(--b1)', position: 'relative', overflow: 'hidden' },
  glowTl:    { position: 'absolute', top: -80, left: -80, width: 300, height: 300, background: 'radial-gradient(circle,#1D9E750A 0%,transparent 70%)', pointerEvents: 'none' },
  glowBr:    { position: 'absolute', bottom: -60, right: -60, width: 200, height: 200, background: 'radial-gradient(circle,#8C202008 0%,transparent 70%)', pointerEvents: 'none' },
  logoRow:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 },
  logoMark:  { width: 36, height: 36, background: 'linear-gradient(135deg,var(--crim2),var(--crim))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px #8C202033' },
  wordmark:  { fontSize: 18, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-.03em' },
  version:   { fontSize: 10, fontWeight: 600, color: 'var(--teal3)', background: 'var(--teal-dim)', border: '1px solid #1D9E7544', borderRadius: 3, padding: '1px 6px', marginLeft: 6, letterSpacing: '.04em' },
  h:         { fontSize: 28, fontWeight: 700, color: 'var(--t1)', marginBottom: 8, lineHeight: 1.2, letterSpacing: '-.03em' },
  sub:       { fontSize: 13.5, color: 'var(--t3)', marginBottom: 36, lineHeight: 1.7 },
  googleBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 13, background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--t1)', marginBottom: 20, textDecoration: 'none', transition: 'all .2s' },
  divRow:    { display: 'flex', alignItems: 'center', gap: 12, color: 'var(--t4)', fontSize: 12, marginBottom: 20 },
  field:     { width: '100%', padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--b1)', borderRadius: 'var(--rad-sm)', fontSize: 13, color: 'var(--t1)', fontFamily: 'var(--font)', outline: 'none', marginBottom: 11, transition: 'border-color .15s', display: 'block' },
  submit:    { width: '100%', padding: 13, background: 'linear-gradient(135deg,var(--teal-dim),var(--teal-soft))', color: 'var(--teal3)', border: '1px solid #1D9E7555', borderRadius: 'var(--rad-sm)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', marginBottom: 12 },
  featsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 24 },
  feat:      { background: 'var(--surface)', border: '1px solid var(--b1)', borderRadius: 'var(--rad-sm)', padding: '12px 14px' },
  featIcon:  { fontSize: 18, marginBottom: 6 },
  featTitle: { fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 3 },
  featDesc:  { fontSize: 11, color: 'var(--t4)', lineHeight: 1.5 },
  right:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, position: 'relative', overflow: 'hidden' },
  rightGlow: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 60% 40%,#1D9E7506 0%,transparent 60%)', pointerEvents: 'none' },
  bigTitle:  { fontSize: 40, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-.04em', textAlign: 'center', lineHeight: 1.2, marginBottom: 14 },
  bigSub:    { fontSize: 15, color: 'var(--t3)', textAlign: 'center', maxWidth: 340, lineHeight: 1.7, marginBottom: 48 },
  pillRow:   { display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center', maxWidth: 420 },
  pill:      { padding: '8px 16px', background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 20, fontSize: 12.5, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 8 },
  pillDot:   { width: 7, height: 7, borderRadius: '50%' },
  palette:   { display: 'flex', borderRadius: 'var(--rad)', overflow: 'hidden', height: 54, width: 360, marginTop: 40, boxShadow: '0 8px 40px #00000055' },
  swatch:    { flex: 1 },
};
