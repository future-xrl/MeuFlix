import { getDB } from 'db';
import { normalizeString, renderPaginationControls } from 'utils';
import { renderHeader, renderMediaGrid, attachClientListeners } from 'views/Client';
import { t } from 'i18n';

let currentPage = 1;
/* @tweakable [Number of items per page on the favorites page] */
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
                 <div class="catalog-header-top">
                    <div style="width:100%; display: flex; justify-content: space-between; align-items: center;">
                        <h1>Meus Favoritos</h1>
                        <span class="total-count">${filteredItems.length} itens</span>
                    </div>
                </div>
                <!-- @tweakable [Styling for the search bar on the favorites page] -->
                <div class="search-container-wrapper">
                    <div class="search-container">
                        <input type="text" id="search-input" class="form-control" placeholder="Digite para pesquisar..." value="${currentFilter}">
                        <button id="search-button" class="btn" onclick="clientSearch()">Pesquisar</button>
                    </div>
                </div>
            </div>
            ${filteredItems.length === 0 ? '' : renderMediaGrid(filteredItems, onPageChange, { currentPage, itemsPerPage: ITEMS_PER_PAGE })}
        </div>
    `;

    container.innerHTML = `
        ${renderHeader('favoritos')}
        <main class="page">
            ${pageContent}
        </main>
        <div id="menu-overlay"></div>
        <div id="slide-in-menu">
            <a href="#/cliente/favoritos" class="active">Favoritos</a>
            <a href="#/cliente/historico">Histórico</a>
            <a href="#/cliente/perfil">Perfil</a>
            <a href="#/cliente/configuracoes-usuario">${t('user_settings')}</a>
            <button id="slide-menu-logout-btn">Sair</button>
        </div>
    `;

    renderPaginationControls(document.getElementById('pagination-container'), currentPage, totalPages, onPageChange);

    const handleSearch = () => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            currentFilter = searchInput.value;
            currentPage = 1;
            console.log("Pesquisa por:", currentFilter);
            renderFavoritesPage(container);
        }
    };
    
    document.removeEventListener('clientSearch', handleSearch); // Avoid duplicate listeners
    document.addEventListener('clientSearch', handleSearch, { once: true });

    attachClientListeners(container, {
        onSearch: handleSearch,
        pageType: 'favoritos',
        id: null
    });
}