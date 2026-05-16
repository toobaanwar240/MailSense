/**
 * components/CategoryBadge.jsx
 * Replaces render_badge() + render_conf_bar() from Streamlit.
 */
import React from 'react';

const CATEGORY_EMOJI = {
  account_alerts:     '🔔',
  career_personal:    '🎯',
  finance_legal:      '⚖️',
  marketing_outreach: '📢',
  work_operations:    '🖥️',
  unknown:            '❓',
};

export const CATEGORY_OPTIONS = [
  'All',
  'account_alerts',
  'career_personal',
  'finance_legal',
  'marketing_outreach',
  'work_operations',
];

export function CategoryBadge({ category = 'unknown', confidence = null }) {
  const emoji = CATEGORY_EMOJI[category] ?? '⚪';
  return (
    <span className={`cat-badge cat-${category}`}>
      {emoji} {category.toUpperCase()}{confidence != null ? ` · ${confidence}%` : ''}
    </span>
  );
}

export function ConfBar({ confidence = 0 }) {
  return (
    <div className="conf-bar-wrap" style={{ marginTop: 4 }}>
      <div className="conf-bar" style={{ width: `${confidence}%` }} />
    </div>
  );
}

export function CategoryFilterBar({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
      {CATEGORY_OPTIONS.map(cat => {
        const emoji = cat === 'All' ? '' : CATEGORY_EMOJI[cat] ?? '';
        const isActive = active === cat;
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: `1px solid ${isActive ? 'var(--teal3)' : 'var(--b2)'}`,
              background: isActive ? 'var(--teal-soft)' : 'var(--surface)',
              color: isActive ? 'var(--teal3)' : 'var(--t3)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              transition: 'all .15s',
            }}
          >
            {emoji} {cat === 'All' ? 'All' : cat.replace(/_/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}
