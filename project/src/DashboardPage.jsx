import React, { useState } from 'react';
import './App.css';

// Backend public key (should match the backend's .env)
const BACKEND_PUBLIC_KEY = '6Qw2Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw'; // <-- Replace with actual backend public key

// Now receives all data via props!
function DashboardPage({ walletAddress, score, metrics, finance, navigateTo }) {
  const [delegating, setDelegating] = useState(false);
  const [delegateStatus, setDelegateStatus] = useState('');
    // Approve backend as delegate for USDC
    const handleApproveDelegate = async () => {
      setDelegating(true);
      setDelegateStatus('');
      try {
        // Dynamically import SPL Token and web3.js
        const { createApproveInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
        const { PublicKey, Transaction } = await import('@solana/web3.js');
        // Get wallet info from window (assumes wallet adapter injects window.solana)
        if (!window.solana || !window.solana.publicKey) {
          setDelegateStatus('Wallet not connected.');
          setDelegating(false);
          return;
        }
        const userPublicKey = new PublicKey(window.solana.publicKey.toString());
        const backendPublicKey = new PublicKey(BACKEND_PUBLIC_KEY);
        const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
        const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, userPublicKey);
        const decimals = 6;
        const amount = 0.001 * Math.pow(10, decimals); // 0.001 USDC
        const approveIx = createApproveInstruction(
          userTokenAccount,
          backendPublicKey,
          userPublicKey,
          amount,
          [],
          TOKEN_PROGRAM_ID
        );
        const tx = new Transaction().add(approveIx);
        const { signature } = await window.solana.signAndSendTransaction(tx);
        setDelegateStatus('Delegate approved! Tx: ' + signature);
      } catch (e) {
        setDelegateStatus('Delegate approval failed: ' + (e.message || e));
      } finally {
        setDelegating(false);
      }
    };
  
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

  // Deposit handler (Treasury -> User)
  const handleDeposit = async () => {
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
          alert('Deposit successful! Tx: ' + data.tx);
        } else {
          alert('Deposit failed: ' + (data.error || 'Unknown error'));
        }
      } else {
        const text = await res.text();
        alert('Deposit error: Unexpected response from server.\n' + text);
      }
    } catch (e) {
      alert('Deposit error: ' + (e.message || e));
    }
  };

  // Withdraw handler (User -> Treasury)
  const handleWithdraw = async () => {
    if (!walletAddress) {
      alert('Wallet not connected.');
      return;
    }
    try {
      const res = await fetch('http://localhost:3001/api/slash', {
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
        <div style={{ marginBottom: 12, fontSize: 13, color: '#888' }}>
          <b>Backend USDC Delegate Address:</b><br />
          <span style={{ wordBreak: 'break-all' }}>{BACKEND_PUBLIC_KEY}</span>
        </div>
        <button onClick={handleApproveDelegate} disabled={delegating} style={{ marginBottom: 8 }}>
          {delegating ? 'Approving...' : 'Approve Backend as USDC Delegate'}
        </button>
        {delegateStatus && <div style={{ fontSize: 13, color: delegateStatus.startsWith('Delegate approved') ? 'green' : 'red', marginBottom: 8 }}>{delegateStatus}</div>}
        <button onClick={handleStartTracking}>
          ▶️ Start Tracking (Use Popup)
        </button>
        <button onClick={() => window.open('http://localhost:5173/setup', '_blank')}>
          ⚙️ Setup Allowance
        </button>
        <button onClick={handleDeposit}>
          💸 Deposit 0.001 USDC
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