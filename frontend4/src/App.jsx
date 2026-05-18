/**
 * App.jsx — Root component
 *
 * AUTHENTICATION FLOW (replaces Streamlit's query_params token check):
 * 1. FastAPI redirects to: http://localhost:3000/auth/callback?token=...&email=...
 * 2. App reads token from URL, saves to localStorage, navigates to /inbox.
 * 3. On every load, App checks localStorage for token.
 * 4. If no token → show AuthPage.
 */
import React, { useState, useEffect, useRef } from 'react';
import './styles/tokens.css';

import AuthPage          from './pages/AuthPage.jsx';
import InboxPage         from './pages/InboxPage.jsx';
import ChatPage          from './pages/ChatPage.jsx';
import SearchResultsPage from './pages/SearchResultsPage.jsx';
import ComposePage       from './pages/ComposePage.jsx';
import Sidebar           from './components/Sidebar.jsx';

import { useRagStatus } from './hooks/useRagStatus.js';
import { useEmails }    from './hooks/useEmails.js';
import { useClassify }  from './hooks/useClassify.js';

export default function App() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [token, setToken]   = useState(() => localStorage.getItem('ms_token'));
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('ms_email'));

  // ── Theme ───────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('ms_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ms_theme', theme);
  }, [theme]);

  // Handle OAuth callback: /auth/callback?token=...&email=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    const e = params.get('email');
    if (t) {
      localStorage.setItem('ms_token', t);
      if (e) localStorage.setItem('ms_email', e);
      setToken(t);
      setUserEmail(e);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('inbox');
  const [activeSubTab, setActiveSubTab] = useState('all');

  // ── Global state ────────────────────────────────────────────────────────────
  const ragHook     = useRagStatus();
  const emailHook   = useEmails();
  const classifyHook = useClassify();

  const [searchResults, setSearchResults] = useState(null);
  const [searchQuestion, setSearchQuestion] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Load emails on login
  useEffect(() => {
    if (token) emailHook.refresh();
  }, [token]);

  // Persist selectedEmail id to localStorage 'ms_selected_email_id'
  useEffect(() => {
    if (selectedEmail?.id) {
      localStorage.setItem('ms_selected_email_id', selectedEmail.id);
    }
  }, [selectedEmail]);

  // On mount or when emails change, restore selected email by matching saved id exactly once
  const hasRestoredEmail = useRef(false);
  useEffect(() => {
    if (emailHook.emails.length > 0 && !hasRestoredEmail.current) {
      const savedId = localStorage.getItem('ms_selected_email_id');
      if (savedId) {
        const matched = emailHook.emails.find(e => e.id === savedId);
        if (matched) {
          setSelectedEmail(matched);
          hasRestoredEmail.current = true;
          return;
        }
      }
      // Fallback if no email is selected yet
      if (!selectedEmail) {
        setSelectedEmail(emailHook.emails[0]);
        hasRestoredEmail.current = true;
      }
    }
  }, [emailHook.emails]);

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!token) return <AuthPage />;

  // ── Main app ─────────────────────────────────────────────────────────────────
  const handleViewSources = ({ answer, sources, question }) => {
    setSearchResults({ answer, sources });
    setSearchQuestion(question);
    setActiveTab('search');
  };

  function renderPage() {
    switch (activeTab) {
      case 'inbox':
        return (
          <InboxPage
            emails={emailHook.emails}
            setEmails={emailHook.setEmails} 
            loading={emailHook.loading}
            error={emailHook.error}
            onRefresh={emailHook.refresh}
            classify={classifyHook.classify}
            getSentiment={classifyHook.getSentiment}
            clearClassifyCache={classifyHook.clearAll}
            categoryFilter={categoryFilter}
            selectedEmail={selectedEmail}
            setSelectedEmail={setSelectedEmail}
            activeSubTab={activeSubTab}
            setActiveSubTab={setActiveSubTab}
          />
        );
      case 'chat':
        return (
          <ChatPage
            ragStatus={ragHook.status}
            onTriggerIndex={ragHook.triggerIndex}
            onViewSources={handleViewSources}
          />
        );
      case 'search':
        return (
          <SearchResultsPage
            results={searchResults}
            question={searchQuestion}
            onClear={() => setSearchResults(null)}
          />
        );
      case 'compose':
        return <ComposePage selectedEmail={selectedEmail} emails={emailHook.emails} />;
      default:
        return null;
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--void)' }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        emails={emailHook.emails}
        ragStatus={ragHook.status}
        indexedCount={ragHook.indexedCount}
        dbTotal={ragHook.dbTotal}
        lastChecked={ragHook.lastChecked}
        onIndex={ragHook.triggerIndex}
        indexLoading={ragHook.loading}
        userEmail={userEmail}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
      />
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)', minWidth: 0, minHeight: 0 }}>
        {/* Minimal Title Bar */}
        <div style={styles.topbar} className="glass">
          <div style={{ flex: 1 }} />
          <button style={styles.themeToggle} onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} title="Toggle Theme">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative', minWidth: 0, minHeight: 0 }}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

const styles = {
  topbar:   { borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', height: 48, flexShrink: 0, padding: '0 16px', gap: 16, zIndex: 10, background: 'var(--surface)' },
  themeToggle: { background: 'var(--surface2)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', fontSize: 12, fontWeight: 500, color: 'var(--t2)', fontFamily: 'var(--font)' }
};
