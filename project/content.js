// project/content.js

// Listen for messages from the Background Script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Check for the Sync Message
  if (msg.type === 'EXTENSION_SYNC') {
    // Forward the data to the Web App via the window object
    // "window.postMessage" is how Content Scripts talk to the Page
    window.postMessage({ 
      type: 'ANTI_DOPAMINE_SYNC', 
      data: msg.payload 
    }, '*');
  }
});

console.log("Anti-Dopamine Bridge Loaded on Localhost");