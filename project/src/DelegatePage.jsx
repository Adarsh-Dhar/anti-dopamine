import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction } from '@solana/web3.js';
import { createApproveInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useConnection } from '@solana/wallet-adapter-react';
import '@solana/wallet-adapter-react-ui/styles.css';

const BACKEND_PUBLIC_KEY = 'EYSHit3n1e6qQWKG6L4g34SNoG6P7R9U7y6MGREBLebB'; // Replace with actual backend public key
const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';


function DelegatePage() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelegate = async () => {
    setLoading(true);
    setStatus('');
    try {
      if (!publicKey) {
        setStatus('Wallet not connected.');
        setLoading(false);
        return;
      }
      const backendPublicKey = new PublicKey(BACKEND_PUBLIC_KEY);
      const userPublicKey = publicKey;
      const usdcMint = new PublicKey(USDC_MINT);
      const userTokenAccount = await getAssociatedTokenAddress(usdcMint, userPublicKey);
      const decimals = 6;
      const amountInSmallestUnit = Math.floor(Number(amount) * Math.pow(10, decimals));
      const approveIx = createApproveInstruction(
        userTokenAccount,
        backendPublicKey,
        userPublicKey,
        amountInSmallestUnit,
        [],
        TOKEN_PROGRAM_ID
      );
      const tx = new Transaction().add(approveIx);
      const signature = await sendTransaction(tx, connection, { skipPreflight: false });
      setStatus('Delegate approved! Tx: ' + signature);
    } catch (e) {
      setStatus('Delegate approval failed: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, border: '1px solid #eee', borderRadius: 12 }}>
      <h2>Delegate USDC to Backend</h2>
      <WalletMultiButton style={{ marginBottom: 20 }} />
      <div style={{ marginBottom: 12, fontSize: 13, color: '#888' }}>
        <b>Backend USDC Delegate Address:</b><br />
        <span style={{ wordBreak: 'break-all' }}>{BACKEND_PUBLIC_KEY}</span>
      </div>
      <label style={{ display: 'block', marginBottom: 12 }}>
        Amount to Delegate (USDC):
        <input
          type="number"
          min={0.000001}
          step={0.000001}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={{ marginLeft: 8, padding: 6, borderRadius: 4, border: '1px solid #ccc', width: 120 }}
        />
      </label>
      <button
        onClick={handleDelegate}
        disabled={loading || !amount || isNaN(amount) || Number(amount) <= 0 || !connected}
        style={{ padding: '10px 24px', background: '#646cff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 16 }}
      >
        {loading ? 'Delegating...' : 'Delegate'}
      </button>
      {status && <div style={{ marginTop: 20, fontWeight: 'bold', color: status.startsWith('Delegate approved') ? 'green' : 'red' }}>{status}</div>}
    </div>
  );
}

export default DelegatePage;
