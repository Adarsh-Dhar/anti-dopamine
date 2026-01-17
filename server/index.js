
require('dotenv').config();
const express = require('express');
const cors = require('cors'); // npm install cors
const { GoogleGenerativeAI } = require("@google/generative-ai");
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
app.use(cors()); // Allow Extension to call Server
app.use(express.json({ limit: '10mb' })); // Allow large image payloads
// ----------------------------------------------------
// GEMINI SETUP
// ----------------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

app.post('/api/analyze-frame', async (req, res) => {
  const { imageBase64 } = req.body; // Expects "data:image/jpeg;base64,..."
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });
  try {
    // Clean base64 string
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const prompt = "Analyze this video frame. Rate it from 0-100 for 'Dopamine Intensity' or 'Brainrot'. 100 means highly stimulating (split screens, rapid text, gaming overlays, memes). 0 means calm (static text, nature). Return ONLY a JSON object: { \"score\": number, \"reason\": \"short string\" }.";
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      },
    ]);
    const response = await result.response;
    const text = response.text();
    // Parse the JSON from Gemini
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanText);
    console.log("Gemini Analysis:", data);
    res.json({ success: true, data });
  } catch (e) {
    console.error("Gemini Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

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