import { getDB, saveDB } from 'db';
import { normalizeString, renderPaginationControls, formatDate } from 'utils';
import { renderHeader, attachCommonClientListeners } from 'views/Client';

/* @tweakable [Number of history items to display per page] */
const ITEMS_PER_PAGE = 12;
let currentPage = 1;

/** @tweakable [The maximum number of pages to show in the history] */
const MAX_HISTORY_PAGES = 2;

function formatHistoryTimestamp(isoString) {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function handleClearHistory(container) {
    if (confirm("Tem certeza que quer limpar o histórico?")) {
        const session = JSON.parse(localStorage.getItem('session'));
        if (session?.username) {
            localStorage.removeItem(`watchHistory_${session.username}`);
            // Re-render the page to show it's empty
            renderHistoryPage(container);
        }
    }
}

export function renderHistoryPage(container) {
    const session = JSON.parse(localStorage.getItem('session'));
    if (!session?.username) {
        window.location.hash = '#login';
        return;
    }

    const history = JSON.parse(localStorage.getItem(`watchHistory_${session.username}`) || '[]');
    const db = getDB();

    const allMedia = [
        ...(db.movies || []),
        ...(db.series || []),
        ...(db.animes || [])
    ];

    const historyItems = history.map(historyEntry => {
        const mediaItem = allMedia.find(item => item.id === historyEntry.id);
        return mediaItem ? { ...mediaItem, watchedAt: historyEntry.timestamp } : null;
    }).filter(Boolean); // Filter out items that might no longer exist

    const totalPagesCalculated = Math.ceil(historyItems.length / ITEMS_PER_PAGE);
    const totalPages = Math.min(totalPagesCalculated, MAX_HISTORY_PAGES);
    const paginatedItems = historyItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const onPageChange = (newPage) => {
        currentPage = newPage;
        renderHistoryPage(container);
    };

    const pageContent = `
        <div class="container">
            <div class="catalog-header">
                <h1>Histórico de Visualização</h1>
                <button id="clear-history-btn" class="btn btn-danger btn-sm">Limpar Histórico</button>
            </div>
            ${paginatedItems.length === 0 
                ? '<p>Seu histórico está vazio. Comece a assistir algo!</p>' 
                : `
                    <div class="history-grid">
                        ${paginatedItems.map(item => `
                            <div class="history-card">
                                <img src="${item.cover}" alt="${item.name}" class="history-card-cover" loading="lazy">
                                <div class="history-card-info">
                                    <h3 class="history-card-title">${item.name}</h3>
                                    <p class="history-card-timestamp">Assistido em ${formatHistoryTimestamp(item.watchedAt)}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `
            }
            <div id="pagination-container"></div>
        </div>
    `;

    container.innerHTML = `
        ${renderHeader('historico')}
        <main class="page">
            ${pageContent}
        </main>
        <div id="menu-overlay"></div>
        <div id="slide-in-menu">
            <a href="#/cliente/favoritos">Favoritos</a>
            <a href="#/cliente/historico" class="active">Histórico</a>
            <a href="#/cliente/perfil">Perfil</a>
            <a href="#/cliente/configuracoes">Configurações</a>
            <button id="slide-menu-logout-btn">Sair</button>
        </div>
    `;

    renderPaginationControls(document.getElementById('pagination-container'), currentPage, totalPages, onPageChange);

    document.getElementById('clear-history-btn').addEventListener('click', () => handleClearHistory(container));

    attachCommonClientListeners(container);
}