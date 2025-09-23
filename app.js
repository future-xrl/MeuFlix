document.addEventListener('DOMContentLoaded', function() {
    const mainFrame = document.getElementById('mainFrame');
    const loading = document.getElementById('loading');
    const refreshBtn = document.getElementById('refreshBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const loadingMessage = document.getElementById('loadingMessage');
    
    let loadingProgress = 0;
    let loadingTimer;
    let slowConnectionTimer;
    let failureTimer;
    let isLoaded = false;

    function updateProgress() {
        if (isLoaded) return;
        
        loadingProgress += Math.random() * 15 + 5; // Random increment between 5-20%
        
        if (loadingProgress > 95) {
            loadingProgress = 95; // Stop at 95% until actual load
        }
        
        progressFill.style.width = loadingProgress + '%';
        progressText.textContent = Math.floor(loadingProgress) + '%';
        
        if (loadingProgress < 95) {
            loadingTimer = setTimeout(updateProgress, Math.random() * 500 + 200);
        }
    }

    function startLoading() {
        isLoaded = false;
        loadingProgress = 0;
        loadingMessage.textContent = '';
        loading.classList.remove('hidden');
        
        // Start progress simulation
        updateProgress();
        
        // Set 10-second timer for slow connection message
        slowConnectionTimer = setTimeout(() => {
            if (!isLoaded) {
                loadingMessage.textContent = 'Internet lenta aguarde mais um pouco';
            }
        }, 10000);
        
        // Set 30-second timer for failure message
        failureTimer = setTimeout(() => {
            if (!isLoaded) {
                loadingMessage.textContent = 'Verifique a sua internet';
                progressFill.style.background = '#ff4444';
            }
        }, 30000);
    }

    function completeLoading() {
        isLoaded = true;
        clearTimeout(loadingTimer);
        clearTimeout(slowConnectionTimer);
        clearTimeout(failureTimer);
        
        // Complete the progress bar
        progressFill.style.width = '100%';
        progressText.textContent = '100%';
        
        setTimeout(() => {
            loading.classList.add('hidden');
        }, 500);
    }

    // Handle iframe load
    mainFrame.addEventListener('load', function() {
        completeLoading();
    });

    // Start loading on page load
    startLoading();

    // Refresh functionality
    refreshBtn.addEventListener('click', function() {
        startLoading();
        mainFrame.src = mainFrame.src;
    });

    // Fullscreen functionality
    fullscreenBtn.addEventListener('click', function() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    });

    // Handle iframe errors
    mainFrame.addEventListener('error', function() {
        loading.innerHTML = `
            <div class="error-icon">⚠️</div>
            <p>Erro ao carregar o conteúdo</p>
            <button onclick="location.reload()" class="retry-btn">Tentar novamente</button>
        `;
    });
});