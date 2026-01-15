import React, { useState, useEffect } from 'react';

function App() {
  const [metrics, setMetrics] = useState({ saturation: 0, motion: 0, loudness: 0 });

  const startTracking = async () => {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Tell background to start
    chrome.runtime.sendMessage({ type: 'START_TRACKING', tabId: tab.id });
  };

  useEffect(() => {
    // Listen for live data from Offscreen
    const listener = (msg) => {
      if (msg.type === "METRICS_UPDATE") {
        setMetrics(msg.data);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <div style={{ padding: 20, width: 300, fontFamily: 'sans-serif' }}>
      <h1>Anti-Dopamine</h1>
      <button 
        onClick={startTracking}
        style={{ padding: '10px 20px', background: 'blue', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}
      >
        Start Tracking
      </button>

      <div style={{ marginTop: 20, background: '#f5f5f5', padding: 15, borderRadius: 10 }}>
        <h3>Live Metrics</h3>
        <p>🎨 Saturation: <strong>{(metrics.saturation * 100).toFixed(0)}%</strong></p>
        <p>🏃 Motion: <strong>{(metrics.motion * 100).toFixed(0)}%</strong></p>
        <p>🔊 Loudness: <strong>{metrics.loudness.toFixed(0)}</strong></p>
      </div>
    </div>
  );
}

export default App;
