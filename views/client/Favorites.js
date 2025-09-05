import { getDB } from 'db';
import { normalizeString, renderPaginationControls } from 'utils';
import { renderHeader, renderMediaGrid, attachClientListeners } from 'views/Client';

let currentPage = 1;
const ITEMS_PER_PAGE = 20;
let currentFilter = '';

export function renderFavoritesPage(container) {
    const session = JSON.parse(localStorage.getItem('session'));
    if (!session?.username) {
        window.location.hash = '#login';
        return;
    }

    const db = getDB();
    
    let userFavorites = [];
    const clientUser = db.users.clients.find(c => c.username === session.username);
    if (clientUser) {
        userFavorites = clientUser.favorites || [];
    } else {
        const testUser = (db.users.tests || []).find(t => t.username === session.username);
        if (testUser) {
            userFavorites = testUser.favorites || [];
        }
    }

    const allMedia = [
        ...db.movies.map(m => ({ ...m, type: 'filmes' })),
        ...db.series.map(s => ({ ...s, type: 'series' })),
        ...(db.animes || []).map(a => ({ ...a, type: 'animes' }))
    ];

    const favoriteItems = allMedia.filter(item => userFavorites.includes(item.id));
    
    const filteredItems = favoriteItems.filter(item => 
        normalizeString(item.name).includes(normalizeString(currentFilter))
    );

    const onPageChange = (newPage) => {
        currentPage = newPage;
        renderFavoritesPage(container);
    };

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

    const pageContent = `
        <div class="container">
            <div class="catalog-header">
                <h1>Meus Favoritos</h1>
                <div class="search-bar desktop-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="search-input" class="form-control" placeholder="Pesquisar nos favoritos..." value="${currentFilter}">
                </div>
                <span class="total-count">${filteredItems.length} itens</span>
            </div>
            ${renderMediaGrid(filteredItems, onPageChange, { currentPage, itemsPerPage: ITEMS_PER_PAGE })}
        </div>
    `;

    container.innerHTML = `
        ${renderHeader('favoritos')}
        <main class="page">
            ${pageContent}
        </main>
        <button id="search-toggle-btn"><i class="fa-solid fa-magnifying-glass"></i></button>
        <div class="mobile-search-overlay" id="mobile-search-overlay">
            <input type="text" id="mobile-search-input" class="form-control" placeholder="Pesquisar...">
        </div>
        <div id="menu-overlay"></div>
        <div id="slide-in-menu">
            <a href="#/cliente/favoritos" class="active">Favoritos</a>
            <a href="#/cliente/historico">Histórico</a>
            <a href="#/cliente/perfil">Perfil</a>
            <a href="#/cliente/configuracoes">Configurações</a>
            <button id="slide-menu-logout-btn">Sair</button>
        </div>
    `;

    renderPaginationControls(document.getElementById('pagination-container'), currentPage, totalPages, onPageChange);

    attachClientListeners(container, {
        onSearch: (value) => {
            currentFilter = value;
            currentPage = 1;
            renderFavoritesPage(container);
        },
        pageType: 'favoritos',
        id: null
    });
}