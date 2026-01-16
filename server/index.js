
require('dotenv').config();
const express = require('express');
const { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  sendAndConfirmTransaction 
} = require('@solana/web3.js');
const { 
  createTransferCheckedInstruction, 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID 
} = require('@solana/spl-token');
const bs58 = require('bs58');

const app = express();
app.use(express.json());

// Setup
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); 

// YOUR BACKEND KEYPAIR (Keep this secret in .env!)
const secretKeyString = process.env.BACKEND_PRIVATE_KEY; // Should be base58 string
if (!secretKeyString) throw new Error('BACKEND_PRIVATE_KEY not set in .env');
const backendKeypair = Keypair.fromSecretKey(bs58.decode(secretKeyString));

async function slashUser(userPublicKeyString, amount = 1) {
  try {
    const userPublicKey = new PublicKey(userPublicKeyString);
    const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, userPublicKey);
    const treasuryTokenAccount = await getAssociatedTokenAddress(USDC_MINT, backendKeypair.publicKey);
    const decimals = 6;
    const amountToSlash = amount * Math.pow(10, decimals);
    const instruction = createTransferCheckedInstruction(
      userTokenAccount,
      USDC_MINT,
      treasuryTokenAccount,
      userPublicKey,
      amountToSlash,
      decimals,
      [backendKeypair],
      TOKEN_PROGRAM_ID
    );
    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [backendKeypair]
    );
    console.log(`SLASHED ${amount} USDC. Tx: ${signature}`);
    return signature;
  } catch (error) {
    console.error("Slash failed:", error);
    throw error;
  }
}

// API endpoint for slashing
app.post('/api/slash', async (req, res) => {
  const { userPublicKey, amount } = req.body;
  if (!userPublicKey) return res.status(400).json({ success: false, error: 'userPublicKey required' });
  try {
    const tx = await slashUser(userPublicKey, amount || 1);
    res.json({ success: true, tx });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));