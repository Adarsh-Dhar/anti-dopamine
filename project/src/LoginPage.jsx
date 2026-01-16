
import React, { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import '@solana/wallet-adapter-react-ui/styles.css';

// ----------------------------------------------------------------------
// 1. GET THIS ID FROM chrome://extensions
// You MUST copy/paste your specific ID here for this to work.
// ----------------------------------------------------------------------
const EXTENSION_ID = "gcpoapcodfihojnjfcmhabdebfaaihhe"; 




function LoginPage() {
  const { connected, publicKey } = useWallet();
  const [status, setStatus] = useState('');

  // 1. If we are in the POPUP, we want a button to open the Web App
  const openWebApp = () => {
    window.open('http://localhost:5173', '_blank');
  };

  // 2. If we are in the WEB APP (Localhost), send data to Extension
  useEffect(() => {
    if (connected && publicKey) {
      // Check if we are running in the browser (not extension popup)
      const isExtension = window.chrome && window.chrome.runtime && window.chrome.runtime.id;
      const isWebApp = !isExtension || window.location.href.includes('localhost');

      if (isWebApp) {
        console.log("Web App detected. Sending key to extension:", EXTENSION_ID);
        // SEND MESSAGE TO THE BRIDGE
        if (window.chrome && window.chrome.runtime) {
          window.chrome.runtime.sendMessage(EXTENSION_ID, {
            type: 'WALLET_CONNECTED',
            publicKey: publicKey.toBase58()
          }, (response) => {
             // Optional: Close window after success
             if (!window.chrome.runtime.lastError) {
                setStatus('Linked to Extension! You can close this tab.');
             } else {
                setStatus('Extension not found. Make sure it is installed.');
             }
          });
        }
      }
    }
  }, [connected, publicKey]);

  return (
    <div className="login-page" style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', 
      justifyContent: 'center', height: '100%', padding: '20px', minHeight: '600px',minWidth:"360px"
    }}>
      <h2 style={{ marginBottom: 30 }}>Login</h2>

      {/* Logic: If in Popup, show "Open Web App". If in Web App, show Connect. */}
      {window.location.href.includes('localhost') ? (
         /* --- WEB APP VIEW --- */
         <>
            <WalletMultiButton />
            <p style={{marginTop: 20}}>{status || "Connect to sync with Extension"}</p>
         </>
      ) : (
         /* --- EXTENSION POPUP VIEW --- */
         <>
            <button 
              onClick={openWebApp}
              style={{
                background: '#646cff', color: 'white', padding: '12px 24px',
                borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '1.1em'
              }}
            >
              Connect via Web App
            </button>
            <p style={{marginTop: 15, fontSize: '0.9em', color: '#888'}}>
              Opens full screen to connect wallet
            </p>
         </>
      )}
    </div>
  );
}

export default LoginPage;
