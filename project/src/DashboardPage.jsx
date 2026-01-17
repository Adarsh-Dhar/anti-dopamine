
import React, { useState, useEffect } from "react";
import { useDopamineStaking } from "./Web3Manager";



function DashboardPage() {
  const [metrics, setMetrics] = useState({ saturation: 0, motion: 0, loudness: 0 });
  const { giveAllowance, revokeAllowance } = useDopamineStaking();
  const [allowanceConfirmed, setAllowanceConfirmed] = useState(false);

  const startTracking = async () => {
    if (window.chrome && window.chrome.tabs && window.chrome.tabs.query) {
      const tabs = await window.chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab && tab.id) {
        window.chrome.runtime.sendMessage({ type: 'START_TRACKING', tabId: tab.id });
      }
    }
  };

  useEffect(() => {
    // Listen for metrics updates
    const listener = (msg) => {
      if (msg && msg.type === "METRICS_UPDATE") {
        setMetrics(msg.data);
      }
    };
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.onMessage && window.chrome.runtime.onMessage.addListener) {
      window.chrome.runtime.onMessage.addListener(listener);
    }
    // Check for allowance confirmation in storage
    if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
      window.chrome.storage.local.get(['allowanceConfirmed'], (result) => {
        if (result.allowanceConfirmed) {
          setAllowanceConfirmed(true);
          // Optionally clear the flag after showing
          window.chrome.storage.local.remove(['allowanceConfirmed']);
        }
      });
    }
    return () => {
      if (window.chrome && window.chrome.runtime && window.chrome.runtime.onMessage && window.chrome.runtime.onMessage.removeListener) {
        window.chrome.runtime.onMessage.removeListener(listener);
      }
    };
  }, []);
  return (
    <div style={{ padding: 20, minHeight: '600px', minWidth: '360px', fontFamily: 'sans-serif' }}>
      <h2>Dashboard</h2>
      {allowanceConfirmed && (
        <div style={{ background: '#e6ffe6', color: '#1a7f1a', padding: 12, borderRadius: 6, marginBottom: 16, fontWeight: 'bold', textAlign: 'center' }}>
          ✅ Allowance set successfully!
        </div>
      )}
      <button
        onClick={() => window.open('http://localhost:5173/setup', '_blank')}
        style={{ padding: '10px 20px', background: '#646cff', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', marginBottom: 16 }}
      >
        Setup Allowance
      </button>
      <div style={{ marginTop: 20, background: '#f5f5f5', padding: 15, borderRadius: 10 }}>
        <h3>Live Metrics</h3>
        <p>Saturation: <strong>{(metrics.saturation * 100).toFixed(0)}%</strong></p>
        <p>Motion: <strong>{(metrics.motion * 100).toFixed(0)}%</strong></p>
        <p>Loudness: <strong>{metrics.loudness.toFixed(0)}</strong></p>
      </div>
    </div>
  );
}

export default DashboardPage;
