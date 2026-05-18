/**
 * components/CategoryBadge.jsx
 * Replaces render_badge() + render_conf_bar() from Streamlit.
 */
import React from 'react';

// Emojis removed as requested

export const CATEGORY_OPTIONS = [
  'All',
  'account_alerts',
  'career_personal',
  'finance_legal',
  'marketing_outreach',
  'work_operations',
];

export function CategoryBadge({ category = 'unknown', confidence = null }) {
  return (
    <span className={`cat-badge cat-${category}`}>
      {category.replace(/_/g, ' ')}
    </span>
  );
}

export function ConfBar({ confidence = 0 }) {
  return (
    <div className="conf-bar-wrap">
      <div className="conf-bar" style={{ width: `${confidence}%` }} />
    </div>
  );
}

export function CategoryFilterBar({ active, onChange, vertical = false }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0', flexDirection: vertical ? 'column' : 'row' }}>
      {CATEGORY_OPTIONS.map(cat => {
        const isActive = active === cat;
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            style={{
              padding: vertical ? '6px 10px' : '6px 14px',
              borderRadius: 'var(--rad)',
              border: `1px solid ${isActive ? '#800020' : 'var(--b2)'}`,
              background: isActive ? 'linear-gradient(135deg, #F1F3F5 0%, #CFD4DA 100%)' : 'var(--surface2)',
              color: isActive ? '#800020' : 'var(--t2)',
              fontSize: vertical ? 11 : 12,
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              transition: 'all .2s ease',
              textTransform: 'capitalize',
              boxShadow: isActive ? '0 2px 8px var(--maroon-glow)' : 'none',
              textAlign: vertical ? 'left' : 'center',
              width: vertical ? '100%' : 'auto'
            }}
          >
            {cat === 'All' ? 'All Emails' : cat.replace(/_/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}
