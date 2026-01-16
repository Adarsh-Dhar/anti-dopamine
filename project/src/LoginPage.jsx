import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import '@solana/wallet-adapter-react-ui/styles.css';

function LoginPage() {
  const { connected } = useWallet();
  return (
    <div className="login-page">
      <h2>Login</h2>
      <WalletMultiButton />
      {!connected && <p style={{marginTop: 16}}>Connect your Phantom wallet to continue.</p>}
    </div>
  );
}

export default LoginPage;
