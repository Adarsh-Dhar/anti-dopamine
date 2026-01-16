import React, { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import '@solana/wallet-adapter-react-ui/styles.css';


const EXTENSION_ID = "gcpoapcodfihojnjfcmhabdebfaaihhe"; // REPLACE THIS WITH YOUR ACTUAL EXTENSION ID FROM CHROME://EXTENSIONS

function LoginPage() {
  const { connected, publicKey } = useWallet();
  const [status, setStatus] = useState('');

  // Open full screen login page in new tab
  const handleFullScreen = () => {
    window.open('http://localhost:5173/login', '_blank');
  };

  useEffect(() => {
    if (connected && publicKey) {
      // CHECK 1: Ensure Chrome runtime is available
      if (window.chrome && window.chrome.runtime) {
        setStatus('Syncing wallet with extension...');
        // CHECK 2: Send to specific ID
        window.chrome.runtime.sendMessage(
          EXTENSION_ID, 
          {
            type: 'WALLET_CONNECTED',
            payload: {
              walletAddress: publicKey.toBase58(),
              delegationSignature: 'mock_signature_for_now' // Replace with real signature if needed
            }
          },
          (response) => {
            // CHECK 3: Handle potential errors (Extension not installed/enabled)
            if (window.chrome.runtime.lastError) {
              console.error("Extension Error:", window.chrome.runtime.lastError);
              setStatus('Error: Extension not found. Is it installed?');
            } else if (response && response.success) {
              setStatus('Success! Wallet synced with extension.');
            }
          }
        );
      } else {
        setStatus('Error: Not running in Chrome or Extension not active.');
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
