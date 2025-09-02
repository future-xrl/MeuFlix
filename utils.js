/* @tweakable [Duration of the toast notification in milliseconds] */
const TOAST_DURATION = 3000;

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            container.removeChild(toast);
        }, 500);
    }, TOAST_DURATION);
}

export function generateUniqueId(prefix = '') {
    return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
}

export function generateNumericId(length) {
    return Math.random().toString().slice(2, 2 + length);
}

export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (file.size > 1024 * 1024) { // 1MB limit
            reject(new Error("A imagem não deve exceder 1MB."));
            return;
        }
        if (!file.type.startsWith('image/')) {
            reject(new Error("Por favor, selecione um arquivo de imagem."));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

export function isValidLink(link) {
    const allowedDomains = [
        'drive.google.com',
        'dropbox.com',
        'archive.org',
        'pixeldrain.com',
        'youtube.com',
        'youtu.be',
        'terabox.com'
    ];
    try {
        const url = new URL(link);
        return allowedDomains.some(domain => url.hostname.includes(domain));
    } catch (_) {
        return false;
    }
}

export function normalizeString(str) {
    if (!str) return '';
    return str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function formatDate(isoString) {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export function getYoutubeEmbedUrl(url) {
    let videoId = null;
    if (url.includes('youtube.com/watch')) {
        videoId = new URL(url).searchParams.get('v');
    } else if (url.includes('youtu.be')) {
        videoId = new URL(url).pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}