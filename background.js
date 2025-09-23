chrome.runtime.onInstalled.addListener(() => {
    console.log('Meuflix Extension instalada');
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openApp') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('index.html')
        });
    }
});