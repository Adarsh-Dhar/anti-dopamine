import React from 'react';
import './App.css';

// Now receives all data via props!
function DashboardPage({ walletAddress, score, metrics, finance, navigateTo }) {
  
  // Start Tracking Logic (Sends message to Extension)
  const handleStartTracking = () => {
    // If running in extension popup, send message to background to start tracking
    if (window.chrome && window.chrome.runtime && window.chrome.tabs) {
      // Query the active tab in the current window
      window.chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs && tabs[0];
        if (activeTab && activeTab.id) {
          // Send message to background to start tracking this tab
          window.chrome.runtime.sendMessage({ type: 'START_TRACKING', tabId: activeTab.id }, (response) => {
            if (response && response.success) {
              // Optionally show a success message
            } else {
              // Optionally show an error message
            }
          });
        } else {
          alert('No active tab found.');
        }
      });
    } else {
      // Not in extension context (e.g., web app)
      alert("Please use the Extension Popup to start tracking a specific tab!");
    }
  };

  // Withdraw handler
  const handleWithdraw = async () => {
    if (!walletAddress) {
      alert('Wallet not connected.');
      return;
    }
    try {
      const res = await fetch('http://localhost:3001/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletAddress, amount: 0.001 })
      });
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          alert('Withdrawal successful! Tx: ' + data.tx);
        } else {
          alert('Withdrawal failed: ' + (data.error || 'Unknown error'));
        }
      } else {
        const text = await res.text();
        alert('Withdrawal error: Unexpected response from server.\n' + text);
      }
    } catch (e) {
      alert('Withdrawal error: ' + (e.message || e));
    }
  };

  return (
    <div className="dashboard">
      <div className="score-section">
        <h2>Brainrot Level</h2>
        <div 
          className="score-value"
          style={{ color: score > 500 ? '#ff4444' : '#4caf50' }}
        >
          {score.toFixed(2)}
        </div>
        
        <div className="finance-stats" style={{marginTop: '10px', fontSize: '0.9em'}}>
           <p>💸 Slashed: {finance.slashed.toFixed(4)} USDC</p>
           <p>🛡️ Remaining: {finance.remaining.toFixed(4)} USDC</p>
        </div>
      </div>

      <div className="actions">
        <button onClick={handleStartTracking}>
          ▶️ Start Tracking (Use Popup)
        </button>
        <button onClick={() => window.open('http://localhost:5173/setup', '_blank')}>
          ⚙️ Setup Allowance
        </button>
        <button onClick={handleWithdraw}>
          💸 Withdraw 0.001 USDC
        </button>
      </div>

      <div className="live-metrics">
        <h3>Live Metrics (Synced)</h3>
        <div className="metric-row">
          <span>🎨 Saturation:</span>
          <span>{(metrics.saturation * 100).toFixed(0)}%</span>
        </div>
        <div className="metric-row">
          <span>🏃 Motion:</span>
          <span>{(metrics.motion * 100).toFixed(0)}%</span>
        </div>
        <div className="metric-row">
          <span>🔊 Loudness:</span>
          <span>{metrics.loudness.toFixed(0)}</span>
        </div>
        <div className="metric-row">
          <span>✂️ Cuts/Min:</span>
          <span>{metrics.cutsPerMinute || 0}</span>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;