
import React, { useState, useEffect } from "react";
import { useDopamineStaking } from "./Web3Manager";



function DashboardPage() {
  const [metrics, setMetrics] = useState({ saturation: 0, motion: 0, loudness: 0 });
  const [semanticScore, setSemanticScore] = useState(null);
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
    // Listen for semanticScore changes in chrome.storage
    let storageListener;
    if (window.chrome && window.chrome.storage && window.chrome.storage.onChanged) {
      storageListener = (changes, area) => {
        if (area === 'local' && changes.semanticScore) {
          setSemanticScore(changes.semanticScore.newValue);
        }
      };
      window.chrome.storage.onChanged.addListener(storageListener);
    }
    // Initial load for allowanceConfirmed and semanticScore
    if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
      window.chrome.storage.local.get(['allowanceConfirmed', 'semanticScore'], (result) => {
        if (result.allowanceConfirmed) {
          setAllowanceConfirmed(true);
          window.chrome.storage.local.remove(['allowanceConfirmed']);
        }
        if (result.semanticScore !== undefined) {
          setSemanticScore(result.semanticScore);
        }
      });
    }
    return () => {
      if (window.chrome && window.chrome.runtime && window.chrome.runtime.onMessage && window.chrome.runtime.onMessage.removeListener) {
        window.chrome.runtime.onMessage.removeListener(listener);
      }
      if (window.chrome && window.chrome.storage && window.chrome.storage.onChanged && storageListener) {
        window.chrome.storage.onChanged.removeListener(storageListener);
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
        onClick={startTracking}
        style={{ padding: '10px 20px', background: '#1a7f1a', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', marginBottom: 12, marginRight: 10 }}
      >
        ▶️ Start Tracking
      </button>
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
        <p>Brainrot Score: <strong>{semanticScore !== null ? semanticScore : '...'}</strong></p>
      </div>
    </div>
  );
}

export default DashboardPage;
