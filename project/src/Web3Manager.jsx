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
      // 1. Get the User's USDC Account
      const userTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        publicKey
      );

      // 2. Create the "Approve" Instruction
      // We allow the BACKEND_WALLET to spend 'amount' USDC * (10^6 decimals)
      const decimals = 6; 
      const amountInSmallestUnit = amount * Math.pow(10, decimals);

      const instruction = createApproveInstruction(
        userTokenAccount, // Account to spend from
        BACKEND_WALLET,   // Who can spend it (Your Backend)
        publicKey,        // Owner (The User)
        amountInSmallestUnit, 
        [],
        TOKEN_PROGRAM_ID
      );

      // 3. Send Transaction
      const transaction = new Transaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);
      
      await connection.confirmTransaction(signature, 'confirmed');
      console.log("Allowance Given! Signature:", signature);
      return signature;

    } catch (error) {
      console.error("Error giving allowance:", error);
      throw error;
    }
  };

  const revokeAllowance = async () => {
    if (!publicKey) return;
    // Revoking is just approving 0 amount
    await giveAllowance(0);
    console.log("Allowance Revoked.");
  };

  return { giveAllowance, revokeAllowance };
};