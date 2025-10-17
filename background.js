// Background script to handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-viewmax') {
        // Send message to content script to toggle ViewMax
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-viewmax' });
            }
        });
    }
});