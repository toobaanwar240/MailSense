/**
 * pages/AuthPage.jsx
 * Redesigned startup page featuring a centered, modern hero panel.
 * Centered branding, large tagline, and Google login option on the left,
 * and a linear vertical showcase of capabilities on the right.
 */
import React, { useState, useEffect } from 'react';
import { authLoginUrl } from '../api/client.js';

const FEATURES = [
  { text: 'RAG Chatbot' },
  { text: 'Sentiment Analysis' },
  { text: 'Smart Labels' },
  { text: 'Reply Generator' },
  { text: 'Calendar Events' },
  { text: 'Summarization' },
  { text: 'Caption Generation' }
];

export default function AuthPage() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Cycle the highlighted feature card every 1.0 second
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % FEATURES.length);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={styles.viewport}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .feature-row-item {
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .feature-row-item.active {
          border-color: var(--maroon3) !important;
          transform: translateX(12px) scale(1.03);
          background: rgba(150, 0, 40, 0.35) !important;
          box-shadow: 0 4px 20px var(--maroon-glow);
          color: #FFFFFF !important;
          opacity: 1 !important;
        }
        .fade-in-logo {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .fade-in-tagline {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
          opacity: 0;
        }
        .fade-in-btn {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          opacity: 0;
        }
        .glass-hero {
          background: var(--surface);
          border: 1px solid var(--b1);
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(20px);
        }
        @media (max-width: 768px) {
          .glass-hero {
            flex-direction: column !important;
            height: auto !important;
            max-width: 460px !important;
          }
          .hero-left, .hero-right {
            width: 100% !important;
            padding: 32px 24px !important;
          }
          .hero-right {
            height: auto !important;
          }
        }
      `}</style>

      {/* Decorative subtle background glows */}
      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      {/* Single Centered Hero Card */}
      <div style={styles.heroCard} className="glass-hero">
        
        {/* Left Side: Large Branding, Tagline, and Google Button (Centered & Minimalist) */}
        <div style={styles.leftCol} className="hero-left">
          
          <div style={styles.brandWrapper} className="fade-in-logo">
            <div style={styles.logoMark}>
              <svg viewBox="0 0 16 16" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" width={36} height={36}>
                <path d="M1.5 5l6.5 4.5L14.5 5"/>
                <rect x="1.5" y="3.5" width="13" height="9" rx="2"/>
              </svg>
            </div>
            <h1 style={styles.title}>
              Mail<span style={{ color: 'var(--maroon3)' }}>Sense</span>
            </h1>
          </div>
          
          <p style={styles.subtitle} className="fade-in-tagline">
            Your inbox, powered by intelligence.
          </p>
          
          <div className="fade-in-btn" style={{ width: '100%', maxWidth: '320px', marginTop: '40px' }}>
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

        {/* Right Side: Beautiful Vertical Showcase Box */}
        <div style={styles.rightCol} className="hero-right">
          <div style={styles.showcaseHeader}>Inside the Intelligence</div>

          <div style={styles.featuresColumn}>
            {FEATURES.map((feat, idx) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={idx}
                  className={`feature-row-item ${isActive ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 18px',
                    borderRadius: '12px',
                    background: isActive ? 'rgba(150, 0, 40, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--maroon3)' : 'rgba(255, 255, 255, 0.12)',
                    color: isActive ? '#FFFFFF' : '#D1D1D6',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    userSelect: 'none',
                    letterSpacing: '0.02em',
                    opacity: isActive ? 1 : 0.85,
                    width: '100%',
                    boxSizing: 'border-box',
                    boxShadow: isActive ? '0 4px 20px var(--maroon-glow)' : 'none'
                  }}
                >
                  {/* Glowing active indicator dot */}
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isActive ? 'var(--maroon3)' : 'rgba(255, 255, 255, 0.4)',
                    boxShadow: isActive ? '0 0 10px var(--maroon3)' : 'none',
                    transition: 'all 0.3s'
                  }} />
                  {feat.text}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  viewport: {
    height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--void)', position: 'relative', overflow: 'hidden', padding: 24
  },
  glowTop: {
    position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw',
    background: 'radial-gradient(circle, var(--maroon-glow) 0%, transparent 60%)',
    pointerEvents: 'none'
  },
  glowBottom: {
    position: 'absolute', bottom: '-20%', right: '-10%', width: '40vw', height: '40vw',
    background: 'radial-gradient(circle, rgba(130, 100, 100, 0.05) 0%, transparent 60%)',
    pointerEvents: 'none'
  },
  heroCard: {
    display: 'flex', flexDirection: 'row', borderRadius: '24px',
    maxWidth: '900px', width: '100%', height: '540px', overflow: 'hidden',
    zIndex: 10
  },
  leftCol: {
    width: '50%', padding: '48px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: 'var(--surface)',
    textAlign: 'center'
  },
  brandWrapper: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
  },
  logoMark: {
    width: 80, height: 80, background: 'linear-gradient(135deg, var(--maroon3), var(--maroon))',
    borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 24px var(--maroon-glow)', marginBottom: 20
  },
  title: { fontSize: 42, fontWeight: 900, color: 'var(--t1)', letterSpacing: '-.04em', margin: 0 },
  subtitle: { fontSize: 18, color: 'var(--t2)', lineHeight: 1.5, margin: '12px 0 0', fontWeight: 600, letterSpacing: '-0.01em' },
  googleBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 24px',
    background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad)',
    cursor: 'pointer', fontSize: 14.5, fontWeight: 700, color: 'var(--t1)', textDecoration: 'none',
    transition: 'all .25s ease', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  },
  rightCol: {
    width: '50%', background: 'linear-gradient(135deg, var(--maroon-soft) 0%, var(--bg) 100%)',
    position: 'relative', borderLeft: '1px solid var(--b1)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 40px'
  },
  showcaseHeader: {
    position: 'absolute', top: 28, left: 40, fontSize: 11, fontWeight: 800,
    color: '#FFFFFF', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '.12em', zIndex: 5
  },
  featuresColumn: {
    display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: 24
  }
};
