require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- CONFIG ---
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); 

const secretKeyString = process.env.BACKEND_PRIVATE_KEY; 
if (!secretKeyString) throw new Error('BACKEND_PRIVATE_KEY not set');
const backendKeypair = Keypair.fromSecretKey(bs58.decode(secretKeyString));

// --- GEMINI SETUP ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- SOLANA FUNCTIONS ---

// 1. SLASH: User -> Treasury (Admin signs as Delegate)
async function slashUser(userPublicKeyString, amount) {
  try {
    const userPublicKey = new PublicKey(userPublicKeyString);
    const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, userPublicKey);
    const treasuryTokenAccount = await getAssociatedTokenAddress(USDC_MINT, backendKeypair.publicKey);
    
    const decimals = 6;
    const amountBigInt = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    const instruction = createTransferCheckedInstruction(
      userTokenAccount,      // From: User
      USDC_MINT,
      treasuryTokenAccount,  // To: Treasury
      userPublicKey,         // Owner: User
      amountBigInt,
      decimals,
      [backendKeypair],      // Signer: Admin (Delegate)
      TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(connection, transaction, [backendKeypair]);
    console.log(`🔪 SLASHED ${amount} USDC. Tx: ${signature}`);
    return signature;
  } catch (error) {
    console.error("Slash failed:", error.message);
    throw error;
  }
}

// 2. REFUND: Treasury -> User (Admin signs as Owner)
async function refundUser(userPublicKeyString, amount) {
  try {
    const userPublicKey = new PublicKey(userPublicKeyString);
    const treasuryTokenAccount = await getAssociatedTokenAddress(USDC_MINT, backendKeypair.publicKey);
    const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, userPublicKey);
    
    const decimals = 6;
    const amountBigInt = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    const instruction = createTransferCheckedInstruction(
      treasuryTokenAccount, // From: Treasury
      USDC_MINT,
      userTokenAccount,     // To: User
      backendKeypair.publicKey, // Owner: Treasury
      amountBigInt,
      decimals,
      [backendKeypair],     // Signer: Admin (Owner)
      TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(connection, transaction, [backendKeypair]);
    console.log(`💸 REFUNDED ${amount} USDC. Tx: ${signature}`);
    return signature;
  } catch (error) {
    console.error("Refund failed:", error.message);
    throw error;
  }
}

// --- API ROUTES ---

app.post('/api/slash', async (req, res) => {
  const { userPublicKey, amount } = req.body;
  try {
    const tx = await slashUser(userPublicKey, amount);
    res.json({ success: true, tx, type: 'slash' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/refund', async (req, res) => {
  const { userPublicKey, amount } = req.body;
  try {
    const tx = await refundUser(userPublicKey, amount);
    res.json({ success: true, tx, type: 'refund' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/analyze-frame', async (req, res) => {
  // ... (Keep your existing Gemini logic here) ...
  // Paste previous Gemini code here if needed, or leave as is if you merged files.
  // For brevity, I am assuming the Gemini logic is unchanged.
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
  const { GoogleGenerativeAI } = require("@google/generative-ai");

   if (!imageBase64) return res.status(400).json({ error: "No image" });
   
   try {
     const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
     const prompt = "Analyze this video frame. Rate it from 0-100 for 'Dopamine Intensity' or 'Brainrot'. Return JSON: { \"score\": number }.";
     const result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType: "image/jpeg" } }]);
     const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
     res.json({ success: true, data: JSON.parse(text) });
   } catch (e) {
     res.status(500).json({ success: false, error: e.message });
   }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));