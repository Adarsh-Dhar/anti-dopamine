
import React, { useState } from "react";
import { useDopamineStaking } from "./Web3Manager";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';


function Setup() {
	const { giveAllowance } = useDopamineStaking();
	const { publicKey } = useWallet();
	const [amount, setAmount] = useState(1);
	const [status, setStatus] = useState("");
	const [loading, setLoading] = useState(false);

	const handleAllowance = async () => {
		if (!publicKey) {
			setStatus("❌ Please connect your wallet first.");
			return;
		}
		setLoading(true);
		setStatus("");
		try {
			await giveAllowance(Number(amount));
			setStatus("✅ Allowance set successfully!");
			// Notify extension if running in web app
			if (
				typeof window !== 'undefined' &&
				window.chrome &&
				window.chrome.runtime &&
				typeof window.chrome.runtime.sendMessage === 'function'
			) {
				// EXTENSION_ID should match your extension's ID
				const EXTENSION_ID = "gcpoapcodfihojnjfcmhabdebfaaihhe";
				window.chrome.runtime.sendMessage(EXTENSION_ID, {
					type: "ALLOWANCE_CONFIRMED",
					amount: Number(amount)
				}, (response) => {
					// Optionally handle response
				});
			}
		} catch (e) {
			setStatus("❌ Error: " + (e?.message || e));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{ padding: 32, minHeight: 400, minWidth: 320, fontFamily: 'sans-serif' }}>
			<h2>Setup Allowance</h2>
			<WalletMultiButton style={{ marginBottom: 20 }} />
			<label style={{ display: 'block', marginBottom: 12 }}>
				USDC Amount to Allow:
				<input
					type="number"
					min={0}
					step={0.01}
					value={amount}
					onChange={e => setAmount(e.target.value)}
					style={{ marginLeft: 8, padding: 6, borderRadius: 4, border: '1px solid #ccc', width: 100 }}
				/>
			</label>
			<button
				onClick={handleAllowance}
				disabled={loading || !amount || isNaN(amount) || Number(amount) <= 0}
				style={{ padding: '10px 24px', background: '#646cff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 16 }}
			>
				{loading ? 'Setting...' : 'Set Allowance'}
			</button>
			{status && <div style={{ marginTop: 20, fontWeight: 'bold', color: status.startsWith('✅') ? 'green' : 'red' }}>{status}</div>}
			{!publicKey && <div style={{ marginTop: 16, color: 'red', fontWeight: 'bold' }}>Wallet not connected.</div>}
		</div>
	);
}

export default Setup;
