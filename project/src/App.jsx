import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
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
  // Optionally, you can add wallet state here if you want to use it
  // const [wallet, setWallet] = useState(null);
  // const navigate = useNavigate(); // If you want to navigate programmatically

  // Listen for walletPublicKey in chrome.storage.local (Web App Bridge)
  useEffect(() => {
    if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
      // Check if wallet was connected via the Web App Bridge
      window.chrome.storage.local.get(['walletPublicKey'], (result) => {
        if (result.walletPublicKey) {
          console.log("Found wallet in storage:", result.walletPublicKey);
          // setWallet(result.walletPublicKey); // Update your state here
          // navigate('/dashboard');            // Go to dashboard
        }
      });

      // Listen for real-time updates (if popup is open while they connect)
      window.chrome.storage.onChanged.addListener((changes) => {
        if (changes.walletPublicKey) {
          console.log("Wallet connected externally!");
          // navigate('/dashboard');
        }
      });
    }
  }, []);

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
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.onMessage && window.chrome.runtime.onMessage.addListener) {
      window.chrome.runtime.onMessage.addListener(listener);
      return () => window.chrome.runtime.onMessage.removeListener(listener);
    }
    // If not in extension context, do nothing
    return undefined;
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/account" element={<RequireWallet><AccountPage /></RequireWallet>} />
        <Route path="/dashboard" element={<RequireWallet><DashboardPage /></RequireWallet>} />
        {/* Fix for Chrome extension popup loading /index.html */}
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="/" element={<RequireWallet>
          <div className="extension-container">
            <h1>Anti-Dopamine</h1>
            {error ? (
              <div style={{ background: '#ffebee', color: '#c62828', padding: 10, borderRadius: 5, marginBottom: 10 }}>
                <strong>Error:</strong> {error}
              </div>
            ) : null}
            <button onClick={startTracking}>
              Start Tracking
            </button>
            <div style={{ marginTop: 20, background: '#f5f5f5', padding: 15, borderRadius: 10, color: 'black', width: '100%' }}>
              <h3>Live Metrics</h3>
              <p>🎨 Saturation: <strong>{(metrics.saturation * 100).toFixed(0)}%</strong></p>
              <p>🏃 Motion: <strong>{(metrics.motion * 100).toFixed(0)}%</strong></p>
              <p>🔊 Loudness: <strong>{metrics.loudness.toFixed(0)}</strong></p>
            </div>
          </div>
        </RequireWallet>} />
      </Routes>
    </Router>
  );
}

export default App;
