import React, { useState, useEffect } from 'react';

function App() {
  const [metrics, setMetrics] = useState({ saturation: 0, loudness: 0 });

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
    <div>
      <h1>Video Analysis</h1>
      <button onClick={startTracking}>Start Watching</button>
      <div style={{ marginTop: 20 }}>
        <p>Saturation: {metrics.saturation.toFixed(2)}</p>
        <p>Loudness: {metrics.loudness.toFixed(0)}</p>
      </div>
    </div>
  );
}

export default App;
