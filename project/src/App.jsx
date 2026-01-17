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

  useEffect(() => {
    // Only run extension logic if chrome.storage exists
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      // 1. INITIAL CHECK: Look in storage when popup opens
      chrome.storage.local.get(['walletPublicKey'], (result) => {
        if (result.walletPublicKey) {
          console.log("Found wallet in storage:", result.walletPublicKey);
          setWalletAddress(result.walletPublicKey);
          setCurrentPage('dashboard');
        }
      });

      // 2. LIVE LISTENER: Wait for Background Script to save the wallet
      // This bridges the gap between the Web App and the Popup
      const storageListener = (changes, namespace) => {
        if (namespace === 'local' && changes.walletPublicKey) {
          const newAddress = changes.walletPublicKey.newValue;
          if (newAddress) {
            console.log("Wallet connected from Web App!", newAddress);
            setWalletAddress(newAddress);
            setCurrentPage('dashboard');
          }
        }
      };

      chrome.storage.onChanged.addListener(storageListener);

      // Cleanup listener on unmount
      return () => {
        chrome.storage.onChanged.removeListener(storageListener);
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