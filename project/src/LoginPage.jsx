import React, { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import '@solana/wallet-adapter-react-ui/styles.css';




function LoginPage() {
  const { connected, publicKey } = useWallet();
  const [status, setStatus] = useState('');



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
    <div className="login-page" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%',
      padding: '20px',
      minHeight: '400px',
      minWidth: '300px'
    }}>
      <h2 style={{ marginBottom: 30 }}>Login</h2>
      {connected && publicKey ? (
        <div style={{
          margin: '100px 100px',
          padding: '100px',
          background: '#f5f5f5',
          borderRadius: '100px',
          wordBreak: 'break-all',
          fontFamily: 'monospace',
          fontSize: 15,
          color: '#333',
          textAlign: 'center',
          width: '80%'
        }}>
          <span style={{ fontWeight: 'bold' }}>Wallet Active:</span>
          <div style={{marginTop: 6, fontSize: '0.8em'}}>{publicKey.toBase58()}</div>
        </div>
      ) : (
        <>
          <div style={{ transform: 'scale(1.1)' }}>
            <WalletMultiButton />
          </div>
          <p style={{marginTop: 20, color: '#888', fontSize: '0.9em'}}>
            Connect your Solana wallet to start tracking.
          </p>
        </>
      )}
      {status && <p style={{marginTop: 16, color: '#4caf50'}}>{status}</p>}
    </div>
  );
}

export default LoginPage;
