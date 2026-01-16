
import React, { useState, useEffect } from "react";
import { useDopamineStaking } from "./Web3Manager";



function DashboardPage() {
  const [metrics, setMetrics] = useState({ saturation: 0, motion: 0, loudness: 0 });
  const { giveAllowance, revokeAllowance } = useDopamineStaking();

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
    const listener = (msg) => {
      if (msg && msg.type === "METRICS_UPDATE") {
        setMetrics(msg.data);
      }
    };
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.onMessage && window.chrome.runtime.onMessage.addListener) {
      window.chrome.runtime.onMessage.addListener(listener);
      return () => window.chrome.runtime.onMessage.removeListener(listener);
    }
    return undefined;
  }, []);

  return (
    <div style={{ padding: 20, minHeight: '600px', minWidth: '360px', fontFamily: 'sans-serif' }}>
      <h2>Dashboard</h2>
      <button 
        onClick={startTracking}
        style={{ padding: '10px 20px', background: 'blue', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}
      >
        Start Tracking
      </button>
      <div style={{ marginTop: 20 }}>
        <button onClick={() => giveAllowance(1)} style={{ padding: '8px 16px', marginRight: 8, background: 'green', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
          Start Session (Give Allowance)
        </button>
        <button onClick={revokeAllowance} style={{ padding: '8px 16px', background: 'red', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
          End Session (Revoke Allowance)
        </button>
      </div>
      <div style={{ marginTop: 20, background: '#f5f5f5', padding: 15, borderRadius: 10 }}>
        <h3>Live Metrics</h3>
        <p>🎨 Saturation: <strong>{(metrics.saturation * 100).toFixed(0)}%</strong></p>
        <p>🏃 Motion: <strong>{(metrics.motion * 100).toFixed(0)}%</strong></p>
        <p>🔊 Loudness: <strong>{metrics.loudness.toFixed(0)}</strong></p>
      </div>
    </div>
  );
}

export default DashboardPage;
