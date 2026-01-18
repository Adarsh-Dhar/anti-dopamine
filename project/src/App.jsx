import React, { useState, useEffect } from 'react';
import LoginPage from './LoginPage';
import DashboardPage from './DashboardPage';
import AccountPage from './AccountPage';
import Setup from './Setup';
import DelegatePage from './DelegatePage';
import './App.css';

function App() {
  // Sync currentPage with URL path on initial load
  const getInitialPage = () => {
    const path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    if (typeof path === 'string') {
      if (path.includes('delegate')) return 'delegate';
      if (path.includes('dashboard')) return 'dashboard';
      if (path.includes('account')) return 'account';
      if (path.includes('setup')) return 'setup';
    }
    return 'login';
  };
  const [currentPage, setCurrentPage] = useState(getInitialPage());
  
  // GLOBAL STATE (Synced with Extension)
  const [globalState, setGlobalState] = useState({
    score: 0,
    metrics: { saturation: 0, motion: 0, loudness: 0 },
    finance: { allowance: 0, slashed: 0, remaining: 0 },
    wallet: null
  });

  // Add navigateTo function for page navigation
  const navigateTo = (page) => setCurrentPage(page);
  useEffect(() => {
    // 1. Initial Load: Check if we have wallet in extension storage
    if (window.chrome && window.chrome.storage) {
      window.chrome.storage.local.get(['walletPublicKey'], (res) => {
        if (res.walletPublicKey) {
          setGlobalState(prev => ({ ...prev, wallet: res.walletPublicKey }));
          setCurrentPage('dashboard');
        }
      });
    }

    // 2. Listen for EXTENSION_SYNC (web app) and SCORE_UPDATE (popup)
    const handleSyncMessage = (event) => {
      if (event.data?.type === 'ANTI_DOPAMINE_SYNC') {
        const syncedData = event.data.data;
        setGlobalState({
          score: syncedData.score,
          metrics: syncedData.metrics,
          finance: syncedData.finance,
          wallet: syncedData.wallet
        });
        if (syncedData.wallet && currentPage === 'login') {
          setCurrentPage('dashboard');
        }
      }
    };
    window.addEventListener('message', handleSyncMessage);

    // Listen for SCORE_UPDATE from background (popup only)
    let removeRuntimeListener = null;
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.onMessage) {
      const runtimeListener = (msg) => {
        if (msg.type === 'SCORE_UPDATE') {
          setGlobalState(prev => ({
            ...prev,
            score: msg.data.score,
            metrics: msg.data.instantParams,
            // finance and wallet remain unchanged unless you want to sync them too
          }));
        }
      };
      window.chrome.runtime.onMessage.addListener(runtimeListener);
      removeRuntimeListener = () => window.chrome.runtime.onMessage.removeListener(runtimeListener);
    }

  });

  return (
    <div className="app-container">
      {currentPage === 'login' && (
        <LoginPage 
          onConnect={() => setCurrentPage('dashboard')} 
        />
      )}
      {currentPage === 'dashboard' && (
        <DashboardPage 
          walletAddress={globalState.wallet}
          score={globalState.score}
          metrics={globalState.metrics}
          finance={globalState.finance}
          navigateTo={navigateTo}
        />
      )}
      {currentPage === 'account' && (
        <AccountPage 
          walletAddress={globalState.wallet} 
          onBack={() => navigateTo('dashboard')}
        />
      )}
       {currentPage === 'setup' && (
         <Setup onBack={() => navigateTo('dashboard')} />
       )}
       {currentPage === 'delegate' && (
         <DelegatePage />
       )}
    </div>
  );
}

export default App;