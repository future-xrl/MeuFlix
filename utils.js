/* @tweakable [Duration of the toast notification in milliseconds] */
const TOAST_DURATION = 3000;

/** @tweakable [List of categories for all media types] */
export const MEDIA_CATEGORIES = [
    { key: 'acao', name: 'Ação' },
    { key: 'aventura', name: 'Aventura' },
    { key: 'comedia', name: 'Comédia' },
    { key: 'drama', name: 'Drama' },
    { key: 'ficcao', name: 'Ficção' },
    { key: 'crime', name: 'Crime' },
    { key: 'misterio', name: 'Mistério' },
    { key: 'familia', name: 'Família' },
    { key: 'romance', name: 'Romance' },
    { key: 'fantasia', name: 'Fantasia' },
    { key: 'historia', name: 'História' },
    { key: 'guerra', name: 'Guerra' },
    { key: 'faroeste', name: 'Faroeste' },
    { key: 'terror', name: 'Terror' },
    { key: 'documentario', name: 'Documentário' },
    { key: 'outros', name: 'Outros' },
];

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
    /** @tweakable [List of allowed domains for video links] */
    const allowedDomains = [
        'drive.google.com',
        'dropbox.com',
        'archive.org',
        'pixeldrain.com',
        'youtube.com',
        'youtu.be',
        'terabox.com',
        'vidlii.com',
        'bitchute.com'
    ];
    try {
        const url = new URL(link);
        return allowedDomains.some(domain => url.hostname.includes(domain));
    } catch (_) {
        return false;
    }
}

/* @tweakable [Configuration for the GitHub repository where the database is stored] */
const GITHUB_CONFIG = {
    owner: 'future-xrl',
    repo: 'MeuFlix',
    path: 'cinemaDB.json',
    branch: 'main'
};

export async function publishToGitHub(token) {
    if (!token) {
        throw new Error('Token do GitHub não fornecido.');
    }

    const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok && response.status !== 404) {
            const errorData = await response.json();
            throw new Error(`Erro ao buscar o arquivo: ${errorData.message}`);
        }
        
        const fileData = response.status === 404 ? { sha: null } : await response.json();
        
        const { getDB } = await import('db');
        const db = getDB();
        const newContent = JSON.stringify(db, null, 2);
        // Correct Base64 encoding for UTF-8 characters
        const newContentBase64 = btoa(unescape(encodeURIComponent(newContent)));

        const updateResponse = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Atualização do banco de dados via App',
                content: newContentBase64,
                sha: fileData.sha,
                branch: GITHUB_CONFIG.branch
            }),
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(`Erro ao publicar: ${errorData.message}`);
        }
        
        return true;

    } catch (error) {
        console.error('Erro na publicação para o GitHub:', error);
        throw new Error(error.message || 'Erro ao publicar. Verifique o token e a conexão.');
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

/**
 * Debounce function to limit the rate at which a function gets called.
 * @param {Function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
/* @tweakable [Delay in milliseconds for search and filter inputs] */
export function debounce(func, delay = 300) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * @tweakable [Set to true to show a toast message when an element is not found for an event listener]
 */
const SHOW_UI_ERROR_TOASTS = false;

/**
 * Safely adds an event listener to an element, checking for its existence first.
 * @param {string} selector - The CSS selector for the element.
 * @param {string} event - The event type to listen for (e.g., 'click').
 * @param {Function} handler - The event handler function.
 * @param {object} [options] - Optional event listener options.
 */
export function safeAddEventListener(selector, event, handler, options) {
    const element = document.querySelector(selector);
    if (element) {
        element.addEventListener(event, handler, options);
    } else {
        console.warn(`Element not found for selector "${selector}" on page ${window.location.hash}. Event listener "${event}" not attached.`);
        if (SHOW_UI_ERROR_TOASTS) {
            showToast(`Erro interno: Elemento de UI não encontrado (${selector}).`, 'error');
        }
    }
}

export function renderPaginationControls(container, currentPage, totalPages, onPageChange) {
    if (!container || totalPages <= 1) {
        if(container) container.innerHTML = '';
        return;
    }

    let paginationHTML = '<div class="pagination">';

    // Previous button
    paginationHTML += `<button class="btn btn-secondary btn-sm" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">&laquo;</button>`;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'} btn-sm" data-page="${i}">${i}</button>`;
    }

    // Next button
    paginationHTML += `<button class="btn btn-secondary btn-sm" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">&raquo;</button>`;
    
    paginationHTML += '</div>';
    container.innerHTML = paginationHTML;

    container.querySelectorAll('.pagination button').forEach(button => {
        button.addEventListener('click', (e) => {
            const page = parseInt(e.currentTarget.dataset.page);
            if (page && page !== currentPage) {
                onPageChange(page);
            }
        });
    });
}

export function getEmbedUrl(url) {
    if (!url) return null;

    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            let videoId = null;
            if (hostname.includes('youtube.com')) {
                videoId = urlObj.searchParams.get('v');
            } else if (hostname.includes('youtu.be')) {
                videoId = urlObj.pathname.split('/').pop();
            }
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }

        if (hostname.includes('drive.google.com')) {
            // e.g., https://drive.google.com/file/d/FILE_ID/view
            const parts = urlObj.pathname.split('/');
            const fileIdIndex = parts.indexOf('d');
            if (fileIdIndex > -1 && parts[fileIdIndex + 1]) {
                const fileId = parts[fileIdIndex + 1];
                return `https://drive.google.com/file/d/${fileId}/preview`;
            }
        }

        if (hostname.includes('bitchute.com')) {
            // e.g., https://www.bitchute.com/video/VIDEO_ID/
            const parts = urlObj.pathname.split('/');
            if (parts[1] === 'video' && parts[2]) {
                const videoId = parts[2];
                /** @tweakable [URL format for BitChute embeds] */
                return `https://www.bitchute.com/embed/${videoId}/`;
            }
        }

        if (hostname.includes('vidlii.com')) {
            // e.g., https://www.vidlii.com/watch?v=VIDEO_ID
            if (urlObj.pathname === '/watch' && urlObj.searchParams.has('v')) {
                const videoId = urlObj.searchParams.get('v');
                /** @tweakable [URL format for VidLii embeds] */
                return `https://www.vidlii.com/embed?v=${videoId}`;
            }
            // It might already be an embed link
            if (urlObj.pathname.startsWith('/embed')) {
                return url;
            }
        }
        
        // For other sites, we can try to embed directly. Fallback will handle if it fails.
        // Dropbox, Pixeldrain, etc. might not support embedding due to security headers.
        return url;

    } catch (e) {
        console.warn("Could not parse URL for embedding:", url);
        return url; // Return original URL to try embedding it
    }
}