document.addEventListener('DOMContentLoaded', function() {
    const mainFrame = document.getElementById('mainFrame');
    const loading = document.getElementById('loading');
    const refreshBtn = document.getElementById('refreshBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    // Handle iframe load
    mainFrame.addEventListener('load', function() {
        setTimeout(() => {
            loading.classList.add('hidden');
        }, 1000);
    });

    // Refresh functionality
    refreshBtn.addEventListener('click', function() {
        loading.classList.remove('hidden');
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

