document.addEventListener('DOMContentLoaded', function() {
    const openAppBtn = document.getElementById('openApp');
    const goHomeBtn = document.getElementById('goHome');
    const refreshBtn = document.getElementById('refresh');

    // Open main app
    openAppBtn.addEventListener('click', function() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('index.html')
        });
        window.close();
    });

    // Go to home
    goHomeBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'goHome'});
        });
    });

    // Refresh current tab
    refreshBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.reload(tabs[0].id);
        });
    });
});

