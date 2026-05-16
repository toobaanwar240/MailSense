/**
 * App.jsx — Root component
 *
 * AUTHENTICATION FLOW (replaces Streamlit's query_params token check):
 * 1. FastAPI redirects to: http://localhost:3000/auth/callback?token=...&email=...
 * 2. App reads token from URL, saves to localStorage, navigates to /inbox.
 * 3. On every load, App checks localStorage for token.
 * 4. If no token → show AuthPage.
 */
import React, { useState, useEffect } from 'react';
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

  // ── Global state ────────────────────────────────────────────────────────────
  const ragHook     = useRagStatus();
  const emailHook   = useEmails();
  const classifyHook = useClassify();

  const [searchResults, setSearchResults] = useState(null);
  const [searchQuestion, setSearchQuestion] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);

  // Load emails on login
  useEffect(() => {
    if (token) emailHook.refresh();
  }, [token]);

  // Track selected email across tabs (for compose reply)
  useEffect(() => {
    if (emailHook.emails.length > 0 && !selectedEmail) {
      setSelectedEmail(emailHook.emails[0]);
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
            loading={emailHook.loading}
            error={emailHook.error}
            onRefresh={emailHook.refresh}
            classify={classifyHook.classify}
            getSentiment={classifyHook.getSentiment}
            clearClassifyCache={classifyHook.clearAll}
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
        return <ComposePage selectedEmail={selectedEmail} />;
      default:
        return null;
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--void)' }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        ragStatus={ragHook.status}
        indexedCount={ragHook.indexedCount}
        dbTotal={ragHook.dbTotal}
        lastChecked={ragHook.lastChecked}
        onIndex={ragHook.triggerIndex}
        indexLoading={ragHook.loading}
        userEmail={userEmail}
      />
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top nav tabs */}
        <div style={styles.topbar}>
          {[
            { id: 'inbox',   label: 'Inbox'          },
            { id: 'chat',    label: 'RAG Chatbot'     },
            { id: 'search',  label: 'Search Results'  },
            { id: 'compose', label: 'Compose'         },
          ].map(tab => (
            <button
              key={tab.id}
              style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            style={styles.tbAction}
            onClick={() => { setActiveTab('search'); }}
          >
            🔍 Search Results
          </button>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

const styles = {
  topbar:   { background: 'var(--bg)', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', height: 46, flexShrink: 0, padding: '0 4px', gap: 2 },
  tab:      { padding: '0 20px', height: '100%', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 500, color: 'var(--t4)', cursor: 'pointer', borderBottom: '2px solid transparent', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', fontFamily: 'var(--font)', whiteSpace: 'nowrap', letterSpacing: '.01em', transition: 'all .15s' },
  tabActive:{ color: 'var(--t1)', borderBottomColor: 'var(--teal3)' },
  tbAction: { padding: '0 14px', height: 30, background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 'var(--rad-sm)', fontSize: 12, fontWeight: 500, color: 'var(--t3)', cursor: 'pointer', fontFamily: 'var(--font)', marginRight: 12, display: 'flex', alignItems: 'center', gap: 7 },
};
