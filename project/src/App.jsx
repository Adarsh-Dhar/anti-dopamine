import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import DashboardPage from './DashboardPage';
import AccountPage from './AccountPage';
import Setup from './Setup';
import './App.css';

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [currentPage, setCurrentPage] = useState('login');
  const [brainrotScore, setBrainrotScore] = useState(0.00);
  const [metrics, setMetrics] = useState({ saturation: 0, motion: 0 });

  useEffect(() => {
    // Only run extension logic if chrome.storage exists
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      // 1. INITIAL CHECK: Look in storage when popup opens
      chrome.storage.local.get(['walletPublicKey', 'brainrotScore'], (result) => {
        if (result.walletPublicKey) {
          setWalletAddress(result.walletPublicKey);
          setCurrentPage('dashboard');
        }
        if (result.brainrotScore) {
          setBrainrotScore(result.brainrotScore);
        }
      });

      // 2. LIVE LISTENER: Wait for Background Script to save the wallet
      const storageListener = (changes, namespace) => {
        if (namespace === 'local' && changes.walletPublicKey) {
          const newAddress = changes.walletPublicKey.newValue;
          if (newAddress) {
            setWalletAddress(newAddress);
            setCurrentPage('dashboard');
          }
        }
        if (namespace === 'local' && changes.brainrotScore) {
          setBrainrotScore(changes.brainrotScore.newValue);
        }
      };
      chrome.storage.onChanged.addListener(storageListener);

      // 3. Listen for live updates from Background (SCORE_UPDATE)
      const messageListener = (msg) => {
        if (msg.type === 'SCORE_UPDATE') {
          setBrainrotScore(msg.data.score);
          setMetrics(msg.data.instantParams);
        }
      };
      chrome.runtime.onMessage.addListener(messageListener);

      // Cleanup listeners on unmount
      return () => {
        chrome.storage.onChanged.removeListener(storageListener);
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
    // If not in extension context, do nothing
    return undefined;
  }, []);

  const navigateTo = (page) => {
    setCurrentPage(page);
  };

  const handleDisconnect = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(['walletPublicKey', 'isConnected'], () => {
        setWalletAddress(null);
        setCurrentPage('login');
      });
    } else {
      setWalletAddress(null);
      setCurrentPage('login');
    }
  };

  return (
    <BrowserRouter>
      <div className="app-container">
        {/* HEADER */}
        <header className="app-header">
          <div className="logo">Anti-Dopamine</div>
          {walletAddress && (
            <div className="user-icon" onClick={() => navigateTo('account')}>
              👤
            </div>
          )}
        </header>
        {/* BRAINROT SCORE DISPLAY */}
        <div className="score-display" style={{ textAlign: 'center', margin: '20px 0' }}>
          <h2>Brainrot Level</h2>
          <div style={{ fontSize: '3.5em', fontWeight: 'bold', color: brainrotScore > 50 ? '#ff4444' : '#4caf50' }}>
            {Number(brainrotScore).toFixed(2)}
          </div>
          <p>SATURATION: {(metrics.saturation * 100).toFixed(0)}%</p>
        </div>
        {/* ROUTING */}
        <main className="app-content">
          <Routes>
            <Route path="/" element={
              currentPage === 'login' ? (
                <LoginPage onConnect={(addr) => {
                  setWalletAddress(addr);
                  setCurrentPage('dashboard');
                }} />
              ) : currentPage === 'dashboard' ? (
                <DashboardPage 
                  walletAddress={walletAddress} 
                  navigateTo={navigateTo}
                />
              ) : (
                <AccountPage 
                  walletAddress={walletAddress} 
                  onDisconnect={handleDisconnect}
                  onBack={() => navigateTo('dashboard')}
                />
              )
            } />
            <Route path="/login" element={
              <LoginPage onConnect={(addr) => {
                setWalletAddress(addr);
                setCurrentPage('dashboard');
              }} />
            } />
            <Route path="/setup" element={<Setup />} />
            {/* Catch-all route to redirect unknown paths to root */}
            <Route path="*" element={<DashboardPage walletAddress={walletAddress} navigateTo={navigateTo} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;