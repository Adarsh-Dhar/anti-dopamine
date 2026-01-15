
import { useState } from 'react';
import './App.css';

function App() {
  const [status, setStatus] = useState('');

  const handleStartTracking = async () => {
    setStatus('Initializing...');
    try {
      // 1. Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        setStatus('Error: No active tab found.');
        return;
      }

      // 2. Check if we are on a valid URL (optional but good practice)
      if (!tab.url.includes('youtube.com')) {
        setStatus('Please navigate to YouTube first.');
        return;
      }

      console.log(`Sending START_TRACKING for tab ${tab.id}`);

      // 3. Send the message to background.js
      await chrome.runtime.sendMessage({
        type: 'START_TRACKING',
        tabId: tab.id
      });

      setStatus('Tracking command sent! Check Service Worker console.');
    } catch (error) {
      console.error('Popup Error:', error);
      setStatus('Error: ' + error.message);
    }
  };

  return (
    <div className="extension-container">
      <h1>Video Tracker</h1>
      <button onClick={handleStartTracking}>
        Start Tracking Video
      </button>
      {status && <p className="message">{status}</p>}
    </div>
  );
}

export default App;
