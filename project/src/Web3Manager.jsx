import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  createApproveInstruction, 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
import { PublicKey, Transaction } from '@solana/web3.js';

// USDC Devnet Address (faucet/testnet): https://explorer.solana.com/address/4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU?cluster=devnet
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const BACKEND_WALLET = new PublicKey("EYSHit3n1e6qQWKG6L4g34SNoG6P7R9U7y6MGREBLebB");

export const useDopamineStaking = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const giveAllowance = async (amount = 1) => {
    if (!publicKey) return;
    try {
      const userTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        publicKey
      );
      const decimals = 6; 
      const amountInSmallestUnit = Math.floor(Number(amount) * Math.pow(10, decimals));
      const instruction = createApproveInstruction(
        userTokenAccount,
        BACKEND_WALLET,
        publicKey,
        amountInSmallestUnit, 
        [],
        TOKEN_PROGRAM_ID
      );
      const transaction = new Transaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      console.log("Allowance Given! Signature:", signature);
      if (window.chrome && window.chrome.runtime) {
        const EXTENSION_ID = "gcpoapcodfihojnjfcmhabdebfaaihhe";
        window.chrome.runtime.sendMessage(EXTENSION_ID, {
          type: 'ALLOWANCE_CONFIRMED',
          amount: amount
        });
      }
      return signature;
    } catch (error) {
      console.error("Error giving allowance:", error);
      throw error;
    }
  };

  const revokeAllowance = async () => {
    if (!publicKey) return;
    await giveAllowance(0);
    console.log("Allowance Revoked.");
  };

  // Deposit 0.001 USDC to backend wallet
  const depositUSDC = async (amount = 0.001) => {
    if (!publicKey) return;
    try {
      const userTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        publicKey
      );
      const backendTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        BACKEND_WALLET
      );
      const decimals = 6;
      const amountInSmallestUnit = amount * Math.pow(10, decimals);
      // SPL Token transfer
      const { createTransferInstruction } = await import('@solana/spl-token');
      const instruction = createTransferInstruction(
        userTokenAccount,
        backendTokenAccount,
        publicKey,
        amountInSmallestUnit,
        [],
        TOKEN_PROGRAM_ID
      );
      const transaction = new Transaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      console.log("Deposit Sent! Signature:", signature);
      return signature;
    } catch (error) {
      console.error("Error depositing USDC:", error);
      throw error;
    }
  };

  // Withdraw 0.001 USDC: set allowance, then call backend to perform delegated transfer
  const withdrawUSDC = async (amount = 0.001) => {
    if (!publicKey) throw new Error("Wallet not connected");
    // 1. Set allowance
    const allowanceSig = await giveAllowance(amount);
    // 2. Call backend to perform delegated withdrawal
    try {
      const response = await fetch("http://localhost:3001/api/slash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPublicKey: publicKey.toBase58(), amount })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Backend withdrawal failed");
      return result.tx;
    } catch (err) {
      throw new Error("Backend withdrawal error: " + (err?.message || err));
    }
  };

  return { giveAllowance, revokeAllowance, depositUSDC, withdrawUSDC };
};