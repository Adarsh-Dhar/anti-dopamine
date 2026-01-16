import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import LoginPage from './LoginPage.jsx';
import AccountPage from './AccountPage.jsx';
import DashboardPage from './DashboardPage.jsx';

function RequireWallet({ children }) {
  const { connected } = useWallet();
  const location = useLocation();
  if (!connected) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function App() {
  const [metrics, setMetrics] = useState({ saturation: 0, motion: 0, loudness: 0 });
  const [error, setError] = useState(null);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  const endpoint = "https://api.mainnet-beta.solana.com"; // Replace with your desired endpoint

  const startTracking = async () => {
    setError(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.runtime.sendMessage({ type: 'START_TRACKING', tabId: tab.id });
    } catch (e) {
      setError("Failed to connect.");
    }
  };

  useEffect(() => {
    const listener = (msg) => {
      if (msg.type === "METRICS_UPDATE") {
        setMetrics(msg.data);
      } else if (msg.type === "TRACKING_ERROR") {
        setError(msg.message);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/account" element={<RequireWallet><AccountPage /></RequireWallet>} />
            <Route path="/dashboard" element={<RequireWallet><DashboardPage /></RequireWallet>} />
            {/* Fix for Chrome extension popup loading /index.html */}
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="/" element={<RequireWallet>
              <div style={{ padding: 20, width: 300, fontFamily: 'sans-serif' }}>
                <h1>Anti-Dopamine</h1>
                
                {error ? (
                  <div style={{ background: '#ffebee', color: '#c62828', padding: 10, borderRadius: 5, marginBottom: 10 }}>
                    <strong>Error:</strong> {error}
                  </div>
                ) : null}

                <button 
                  onClick={startTracking}
                  style={{ padding: '10px 20px', background: 'blue', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                >
                  Start Tracking
                </button>

                <div style={{ marginTop: 20, background: '#f5f5f5', padding: 15, borderRadius: 10, color: 'black' }}>
                  <h3>Live Metrics</h3>
                  <p>🎨 Saturation: <strong>{(metrics.saturation * 100).toFixed(0)}%</strong></p>
                  <p>🏃 Motion: <strong>{(metrics.motion * 100).toFixed(0)}%</strong></p>
                  <p>🔊 Loudness: <strong>{metrics.loudness.toFixed(0)}</strong></p>
                </div>
              </div>
            </RequireWallet>} />
          </Routes>
        </Router>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
