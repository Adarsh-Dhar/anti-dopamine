

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
      // Check for the ABSENCE of an internal chrome.runtime.id
      const isExtensionInternal = window.chrome && window.chrome.runtime && window.chrome.runtime.id;
      if (!isExtensionInternal) {
        console.log("Web App detected. Attempting to contact extension:", EXTENSION_ID);
        // SAFE SEND MESSAGE
        if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
          window.chrome.runtime.sendMessage(EXTENSION_ID, {
            type: 'WALLET_CONNECTED',
            publicKey: publicKey.toBase58()
          }, (response) => {
             // Chrome will set lastError if the extension is not found/installed
             if (window.chrome.runtime.lastError) {
                console.error("Extension Connection Failed:", window.chrome.runtime.lastError);
                setStatus('Extension not found or ID incorrect.');
             } else if (response && response.success) {
                console.log("Extension Response:", response);
                setStatus('✅ Linked to Extension! You can close this tab.');
             } else {
                setStatus('Message sent, but no confirmation received.');
             }
          });
        } else {
          console.warn("chrome.runtime.sendMessage is not available.");
          setStatus("Error: Browser does not support extension messaging.");
        }
      }
    }
  }, [connected, publicKey]);

  return (
    <div className="login-page" style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', 
      justifyContent: 'center', height: '100%', padding: '20px', minHeight: '600px', minWidth:"360px"
    }}>
      <h2 style={{ marginBottom: 30 }}>Login</h2>

      {/* Logic: If in Popup, show "Open Web App". If in Web App, show Connect. */}
      {window.location.href.includes('localhost') ? (
         /* --- WEB APP VIEW --- */
         <>
            <WalletMultiButton />
            <div style={{marginTop: 20, textAlign: 'center'}}>
               <p style={{fontWeight: 'bold', color: '#646cff'}}>{status || "Connect to sync with Extension"}</p>
               <p style={{fontSize: '0.8em', color: '#888', marginTop: 10}}>Extension ID: {EXTENSION_ID}</p>
            </div>
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
