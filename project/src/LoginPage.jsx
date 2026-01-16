
import React, { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import '@solana/wallet-adapter-react-ui/styles.css';


function LoginPage() {
  const { connected, publicKey } = useWallet();
  const [status, setStatus] = useState('');

  // Open full screen login page in new tab
  const handleFullScreen = () => {
    window.open('http://localhost:5173/login', '_blank');
  };

  useEffect(() => {
    if (connected && publicKey) {
      // Only try to send message if running in extension context
      if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) {
        setStatus('Syncing wallet with extension...');
        chrome.runtime.sendMessage(
          {
            type: 'WALLET_CONNECTED',
            payload: {
              walletAddress: publicKey.toBase58(),
              delegationSignature: 'mock_signature_for_now' // Replace with real signature if needed
            }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              setStatus('Error: Could not sync with extension.');
            } else if (response && response.success) {
              setStatus('Wallet synced! You can continue.');
            }
          }
        );
      } else {
        setStatus('Wallet connected (not running as extension, cannot sync).');
      }
    }
  }, [connected, publicKey]);

  return (
    <div className="login-page">
      <button onClick={handleFullScreen} style={{ width: '100%', padding: 12, marginBottom: 20, fontSize: 16, background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
        Open Full Screen Login
      </button>
      <h2>Login</h2>
      {connected && publicKey ? (
        <div style={{
          margin: '16px 0',
          padding: '12px',
          background: '#f5f5f5',
          borderRadius: '8px',
          wordBreak: 'break-all',
          fontFamily: 'monospace',
          fontSize: 15,
          color: '#333',
          textAlign: 'center'
        }}>
          <span>Wallet Address:</span>
          <div style={{marginTop: 6}}>{publicKey.toBase58()}</div>
        </div>
      ) : (
        <>
          <WalletMultiButton />
          <p style={{marginTop: 16}}>Connect your Phantom wallet to continue.</p>
        </>
      )}
      {status && <p style={{marginTop: 16, color: '#888'}}>{status}</p>}
    </div>
  );
}

export default LoginPage;
