/**
 * pages/AuthPage.jsx
 * Minimal, premium landing page
 */
import React from 'react';
import { authLoginUrl } from '../api/client.js';

export default function AuthPage() {
  return (
    <div style={styles.wrap}>
      {/* Background glow effects */}
      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      <div style={styles.glassCard} className="glass">
        <div style={styles.logoMark}>
          <svg viewBox="0 0 16 16" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" width={28} height={28}>
            <path d="M1.5 5l6.5 4.5L14.5 5"/>
            <rect x="1.5" y="3.5" width="13" height="9" rx="2"/>
          </svg>
        </div>
        <h1 style={styles.title}>Mail<span style={{ color: 'var(--maroon3)' }}>Sense</span></h1>
        <p style={styles.subtitle}>Your intelligent, automated inbox experience.</p>
        
        <a href={authLoginUrl()} style={styles.googleBtn}>
          <svg viewBox="0 0 24 24" width={20} height={20}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </a>
      </div>
    </div>
  );
}

const styles = {
  wrap: { 
    height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', 
    background: 'var(--void)', position: 'relative', overflow: 'hidden' 
  },
  glowTop: {
    position: 'absolute', top: '-10%', left: '-10%', width: '60vw', height: '60vw',
    background: 'radial-gradient(circle, var(--maroon-glow) 0%, transparent 60%)',
    pointerEvents: 'none'
  },
  glowBottom: {
    position: 'absolute', bottom: '-20%', right: '-10%', width: '50vw', height: '50vw',
    background: 'radial-gradient(circle, rgba(130, 100, 100, 0.05) 0%, transparent 60%)',
    pointerEvents: 'none'
  },
  glassCard: {
    padding: '56px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    borderRadius: '24px', border: '1px solid var(--b1)', boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
    maxWidth: '420px', width: '90%', zIndex: 10, textAlign: 'center',
    background: 'var(--surface)' // Fallback if glass doesn't apply nicely
  },
  logoMark: {
    width: 64, height: 64, background: 'linear-gradient(135deg, var(--maroon3), var(--maroon))',
    borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, boxShadow: '0 8px 24px var(--maroon-glow)'
  },
  title: { fontSize: 34, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-.04em', marginBottom: 12 },
  subtitle: { fontSize: 15, color: 'var(--t3)', lineHeight: 1.6, marginBottom: 40 },
  googleBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 24px',
    background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)',
    cursor: 'pointer', fontSize: 14.5, fontWeight: 600, color: 'var(--t1)', textDecoration: 'none',
    transition: 'all .2s ease', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
  }
};
