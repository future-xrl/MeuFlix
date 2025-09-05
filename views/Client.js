import { getDB, saveDB } from 'db';
import { normalizeString, getEmbedUrl, showToast, MEDIA_CATEGORIES, renderPaginationControls, debounce } from 'utils';
import { t } from 'i18n';

let currentFilter = '';
let currentCategory = 'todos';
/* @tweakable [Default sort order for animes] */
let currentAnimeSort = 'alfabetica';
let currentPage = 1;
/** @tweakable [Number of items per page in the client catalog] */
const ITEMS_PER_PAGE = 24;
let currentView = { type: 'filmes', id: null }; // or { type: 'series', id: null } or { type: 'animes', id: null }

function getSession() {
    try {
        const session = JSON.parse(localStorage.getItem('session'));
        if (session && session.username && session.role) {
            return session;
        }
        return null;
    } catch (e) {
        return null;
    }
}

function getCurrentUser() {
    const session = getSession();
    if (!session?.username) return null;
    const db = getDB();
    let user = db.users.clients.find(c => c.username === session.username);
    if (user) return { user, type: 'clients' };

    user = (db.users.tests || []).find(t => t.username === session.username);
    if (user) return { user, type: 'tests' };

    return null;
}

async function handleHeaderFavoriteClick(itemId) {
    const db = getDB();
    const userResult = getCurrentUser();
    if (!userResult) return;

    const { user, type } = userResult;
    const userIndex = db.users[type].findIndex(u => u.username === user.username);
    if (userIndex === -1) return;

    user.favorites = user.favorites || [];
    const itemIndex = user.favorites.indexOf(itemId);
    const isFavorited = itemIndex > -1;

    if (isFavorited) {
        user.favorites.splice(itemIndex, 1); // Unfavorite
    } else {
        user.favorites.push(itemId); // Favorite
    }
    
    db.users[type][userIndex].favorites = user.favorites;
    saveDB(db);

    const heartIcon = document.getElementById('header-fav-icon');
    if (heartIcon) {
        heartIcon.classList.toggle('favorited', !isFavorited);
    }
    
    const favDropdown = document.getElementById('header-fav-dropdown');
    if (favDropdown) {
        const dropdownContent = !isFavorited 
            ? 'Adicionado aos Favoritos! <a href="#/cliente/favoritos">Ver lista</a>' 
            : 'Removido dos Favoritos!';
        favDropdown.innerHTML = dropdownContent;
        favDropdown.classList.add('show');
        setTimeout(() => favDropdown.classList.remove('show'), 2000);
    }
}

export function renderHeader(activeLink, currentItem = null) {
    const userResult = getCurrentUser();
    const currentUser = userResult ? userResult.user : null;
    const isFavorited = currentItem && currentUser && (currentUser.favorites || []).includes(currentItem.id);

    /** @tweakable [The welcome message template for users] */
    let welcomeMessageTemplate = "Olá, {{displayName}}";

    const session = getSession();
    let displayName = session?.username || 'Usuário';

    if (currentUser && userResult.type === 'clients' && currentUser.name) {
        displayName = currentUser.name;
    }
    
    const welcomeMessage = welcomeMessageTemplate.replace("{{displayName}}", displayName);

    return `
        <header class="client-header">
            <a href="#/cliente/filmes" class="logo-link"><span>M</span>euFlix</a>
            <nav class="desktop-nav">
                <a href="#/cliente/filmes" class="btn-nav ${activeLink === 'filmes' ? 'active' : ''}"><i class="fa-solid fa-film"></i> ${t('movies')}</a>
                <a href="#/cliente/series" class="btn-nav ${activeLink === 'series' ? 'active' : ''}"><i class="fa-solid fa-tv"></i> ${t('series')}</a>
                <a href="#/cliente/animes" class="btn-nav ${activeLink === 'animes' ? 'active' : ''}"><i class="fa-solid fa-dragon"></i> ${t('animes')}</a>
                <a href="#/cliente/favoritos" class="btn-nav ${activeLink === 'favoritos' ? 'active' : ''}"><i class="fa-solid fa-heart"></i> ${t('favorites')}</a>
                <a href="#/cliente/configuracoes-usuario" class="btn-nav ${activeLink === 'configuracoes-usuario' ? 'active' : ''}"><i class="fa-solid fa-cog"></i> ${t('config')}</a>
                 ${currentItem ? `
                    <div class="header-favorite-container">
                        <i id="header-fav-icon" class="fa-solid fa-heart header-fav-icon ${isFavorited ? 'favorited' : ''}" data-id="${currentItem.id}"></i>
                        <div id="header-fav-dropdown" class="header-fav-dropdown">
                            <!-- Content is set dynamically -->
                        </div>
                    </div>
                ` : ''}
            </nav>
            <div class="header-actions">
                <span class="welcome-user">${welcomeMessage}</span>
                <button id="logout-btn" class="btn btn-secondary btn-sm">Sair <i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
            <button id="client-menu-toggle" aria-label="Abrir menu"><i class="fa-solid fa-bars"></i></button>
        </header>
         <nav class="mobile-nav">
            <a href="#/cliente/filmes" class="${activeLink === 'filmes' ? 'active' : ''}">
                <i class="fa-solid fa-film"></i>
                <span>${t('movies')}</span>
            </a>
            <a href="#/cliente/series" class="${activeLink === 'series' ? 'active' : ''}">
                <i class="fa-solid fa-tv"></i>
                <span>${t('series')}</span>
            </a>
            <a href="#/cliente/animes" class="${activeLink === 'animes' ? 'active' : ''}">
                <i class="fa-solid fa-dragon"></i>
                <span>${t('animes')}</span>
            </a>
            <a href="#/cliente/favoritos" class="${activeLink === 'favoritos' ? 'active' : ''}">
                <i class="fa-solid fa-heart"></i>
                <span>${t('favorites')}</span>
            </a>
            <button id="mobile-menu-toggle-bottom" class="mobile-nav-menu-btn">
                <i class="fa-solid fa-bars"></i>
                <span>Menu</span>
            </button>
        </nav>
    `;
}

export function renderMediaGrid(items, onPageChange, { currentPage, itemsPerPage }) {
    const userResult = getCurrentUser();
    const currentUser = userResult ? userResult.user : {};
    const favorites = currentUser?.favorites || [];

    const paginatedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    if (items.length === 0) {
        return `<div class="catalog-container-empty"><p>Nenhum item encontrado.</p></div>`;
    }

    const gridHTML = `
        <div class="catalog-grid">
            ${paginatedItems.map(item => {
                // Ensure item has a type, especially for favorites page
                const type = item.type || (item.id.startsWith('movie') ? 'filmes' : (item.id.startsWith('series') ? 'series' : 'animes'));
                return `
                <div class="media-card" data-id="${item.id}">
                    <div class="cover-container">
                        ${item.cover ? `<img src="${item.cover}" alt="${item.name}" loading="lazy">` : `<div class="placeholder-cover"><i class="fa-solid fa-film"></i></div>`}
                    </div>
                    <div class="media-card-title">${item.name}</div>
                </div>
            `}).join('')}
        </div>
        <div id="pagination-container"></div>
    `;

    // We need a container to render the pagination into after the grid is on the DOM.
    // The grid is returned as a string, so we'll call renderPaginationControls in the main page render functions.
    return gridHTML;
}

function renderCatalogPage(title, items, type, onPageChange) {
    const userResult = getCurrentUser();
    const currentUser = userResult ? userResult.user : {};
    const favorites = currentUser?.favorites || [];

    // Ensure items is an array before filtering
    const safeItems = Array.isArray(items) ? items : [];

    const filteredItems = safeItems.filter(item => {
        const matchesSearch = normalizeString(item.name).includes(normalizeString(currentFilter));
        
        if (currentCategory === 'todos') return matchesSearch;
        if (currentCategory === 'favoritos') return matchesSearch && favorites.includes(item.id);
        // "Mais assistidos" and "Adicionados Recentemente" would require more data (timestamps, view counts)
        // For now, we'll just filter by category.
        if (currentCategory === 'mais_assistidos' || currentCategory === 'recentes') return matchesSearch;
        
        return matchesSearch && item.category === currentCategory;
    });

    const categoriesForMenu = [
        { key: 'todos', name: 'Todos' },
        { key: 'favoritos', name: 'Favoritos' },
        ...MEDIA_CATEGORIES
    ];

    const content = `
        <div class="container">
            <div class="catalog-header">
                <div class="catalog-header-top">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <h1>${title}</h1>
                        <div class="catalog-info">
                            <span class="total-count">Todos ${items.length}</span>
                            <div class="category-menu-wrapper">
                                <button class="category-menu-toggle" id="category-menu-toggle" aria-label="Abrir menu de categorias">
                                    <i class="fa-solid fa-bars"></i>
                                </button>
                                <div class="category-menu" id="category-menu">
                                     <input type="text" id="category-search-input" class="form-control" placeholder="Pesquisar categoria...">
                                     <div id="category-links-container">
                                        ${categoriesForMenu.map(cat => `<a href="#" class="category-link ${currentCategory === cat.key ? 'active' : ''}" data-category="${cat.key}" tabindex="0">${cat.name}</a>`).join('')}
                                     </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                 <!-- @tweakable [Styling for the search bar on catalog pages] -->
                <div class="search-container-wrapper">
                    <div class="search-container">
                        <input type="text" id="search-input" class="form-control" placeholder="Digite para pesquisar..." value="${currentFilter}">
                        <button id="search-button" class="btn" onclick="clientSearch()">Pesquisar</button>
                    </div>
                </div>
            </div>
            ${filteredItems.length === 0 
                ? '<div class="catalog-container-empty"><p>Nenhum item encontrado para esta categoria.</p></div>' 
                : renderMediaGrid(filteredItems, onPageChange, { currentPage, itemsPerPage: ITEMS_PER_PAGE })
            }
        </div>
    `;
    return content;
}

function renderMoviesPage(container) {
    const db = getDB();
    const onPageChange = (newPage) => {
        currentPage = newPage;
        updateView(container, window.location.hash.slice(1));
    };
    const content = renderCatalogPage('Filmes', db.movies, 'filmes', onPageChange);
    return content;
}

function renderSeriesPage(container) {
    const db = getDB();
    const onPageChange = (newPage) => {
        currentPage = newPage;
        updateView(container, window.location.hash.slice(1));
    };
    const content = renderCatalogPage('Séries', db.series, 'series', onPageChange);
    return content;
}

function renderAnimesPage(container) {
    const db = getDB();
    const onPageChange = (newPage) => {
        currentPage = newPage;
        updateView(container, window.location.hash.slice(1));
    };
    
    let animes = [...(db.animes || [])];
    let showedSortToast = false;

    // Apply sorting
    switch(currentAnimeSort) {
        case 'alfabetica':
            animes.sort((a, b) => normalizeString(a.name).localeCompare(normalizeString(b.name)));
            break;
        case 'numerica': // Assuming numeric means by ID or some numeric property
            animes.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
            break;
        case 'recentes':
            if (!showedSortToast && animes.some(a => !a.createdAt)) {
                showToast('Alguns itens sem data de adição podem não ser ordenados corretamente.', 'error');
                showedSortToast = true;
            }
            animes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            break;
        case 'lancamento':
            if (!showedSortToast && animes.some(a => !a.releaseYear)) {
                showToast('Alguns itens sem ano de lançamento podem não ser ordenados corretamente.', 'error');
                showedSortToast = true;
            }
            animes.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
            break;
        case 'populares':
            animes.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            break;
    }

    // Ensure animes is an array before filtering.
    const safeAnimes = Array.isArray(animes) ? animes : [];
    const filteredItems = safeAnimes.filter(item => normalizeString(item.name).includes(normalizeString(currentFilter)));
    
    const sortOptions = {
        'alfabetica': { name: 'Ordem Alfabética', icon: 'fa-solid fa-sort-alpha-down' },
        'numerica': { name: 'Numérica', icon: 'fa-solid fa-sort-numeric-down' },
        'recentes': { name: 'Recém Adicionados', icon: 'fa-solid fa-clock' },
        'lancamento': { name: 'Lançamento', icon: 'fa-solid fa-calendar-days' },
        'populares': { name: 'Mais Populares', icon: 'fa-solid fa-fire' }
    };

    const content = `
        <div class="container">
            <div class="catalog-header">
                <div class="catalog-header-top">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <h1>Animes</h1>
                        <div class="catalog-info">
                            <span class="total-count">Todos ${animes.length}</span>
                            <div class="category-menu-wrapper">
                                <button class="anime-sort-button" id="category-menu-toggle" aria-label="Abrir menu de ordenação">
                                    ${sortOptions[currentAnimeSort]?.name || 'Ordenar'}
                                </button>
                                <div class="category-menu" id="category-menu">
                                     ${Object.entries(sortOptions).map(([key, value]) => `<a href="#" class="category-link ${currentAnimeSort === key ? 'active' : ''}" data-category="${key}" tabindex="0"><i class="${value.icon}"></i> ${value.name}</a>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- @tweakable [Styling for the search bar on the animes page] -->
                 <div class="search-container-wrapper">
                    <div class="search-container">
                        <input type="text" id="search-input" class="form-control" placeholder="Digite para pesquisar..." value="${currentFilter}">
                        <button id="search-button" class="btn" onclick="clientSearch()">Pesquisar</button>
                    </div>
                </div>
            </div>
            ${filteredItems.length === 0 
                ? '<div class="catalog-container-empty"><p>Nenhum anime encontrado.</p></div>' 
                : renderMediaGrid(filteredItems, onPageChange, { currentPage, itemsPerPage: ITEMS_PER_PAGE })
            }
        </div>
    `;
    return content;
}

function renderMovieDetails(movieId) {
    const db = getDB();
    const movie = db.movies.find(m => m.id === movieId);
    if (!movie) {
        const errorMessage = "Erro ao carregar detalhes, item não encontrado.";
        showToast(errorMessage, 'error');
        window.location.hash = '#/cliente/filmes'; // Go back to safety
        return `<div class="catalog-container-empty"><p>${errorMessage}</p></div>`;
    }
    
    const userResult = getCurrentUser();
    const currentUser = userResult ? userResult.user : {};
    const favorites = currentUser?.favorites || [];
    const isFavorited = favorites.includes(movie.id);
    const embedUrl = getEmbedUrl(movie.link);

    return `
      <div class="container">
        <button id="back-btn" class="btn btn-secondary btn-sm" style="margin-bottom:1rem;"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
        <div class="details-view">
            <div class="details-cover">
                <img src="${movie.cover}" alt="${movie.name}">
            </div>
            <div class="details-info">
                <h1>${movie.name}</h1>
                <p><strong>Ano de Lançamento:</strong> ${movie.releaseYear || 'N/A'}</p>
                <div class="favorite-button-wrapper">
                    <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${movie.id}" onclick="toggleFavorite('${movie.id}', this)" aria-label="Marcar como favorito">
                        <span class="fav-icon">${isFavorited ? '❤️' : '🤍'}</span>
                        <span>${isFavorited ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}</span>
                    </button>
                </div>
                <p>${movie.description}</p>
                <div id="player-container" class="player-container">
                    ${embedUrl 
                        ? `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>` 
                        : `<a href="${movie.link}" target="_blank" class="btn btn-primary">Assistir em Nova Aba</a>`
                    }
                </div>
                 <div id="fallback-player"></div>
            </div>
        </div>
      </div>
    `;
}

function renderSeriesDetails(seriesId) {
    const db = getDB();
    const series = db.series.find(s => s.id === seriesId);
    if (!series) {
        const errorMessage = "Erro ao carregar detalhes, item não encontrado.";
        showToast(errorMessage, 'error');
        window.location.hash = '#/cliente/series'; // Go back to safety
        return `<div class="catalog-container-empty"><p>${errorMessage}</p></div>`;
    }

    const userResult = getCurrentUser();
    const currentUser = userResult ? userResult.user : {};
    const favorites = currentUser?.favorites || [];
    const isFavorited = favorites.includes(series.id);

    return `
      <div class="container">
        <button id="back-btn" class="btn btn-secondary btn-sm" style="margin-bottom:1rem;"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
        <div class="details-view">
            <div class="details-cover">
                <img src="${series.cover}" alt="${series.name}">
            </div>
            <div class="details-info">
                <h1>${series.name}</h1>
                 <p><strong>Ano de Lançamento:</strong> ${series.releaseYear || 'N/A'}</p>
                <div class="favorite-button-wrapper">
                     <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${series.id}" onclick="toggleFavorite('${series.id}', this)" aria-label="Marcar como favorito">
                        <span class="fav-icon">${isFavorited ? '❤️' : '🤍'}</span>
                        <span>${isFavorited ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}</span>
                    </button>
                </div>
                <p>${series.description}</p>
                <h3>Temporadas</h3>
                <div class="season-buttons">
                    ${series.seasons.map(season => `
                        <button class="btn btn-secondary btn-season" data-season="${season.seasonNumber}">Temporada ${season.seasonNumber}</button>
                    `).join('')}
                </div>
                <div id="episodes-container"></div>
                <div id="player-container-series" class="player-container" style="display: none;"></div>
                <div id="fallback-player-series"></div>
            </div>
        </div>
      </div>
    `;
}

function renderAnimeDetails(animeId) {
    const db = getDB();
    const anime = (db.animes || []).find(s => s.id === animeId);
    if (!anime) {
        const errorMessage = "Erro ao carregar detalhes, item não encontrado.";
        showToast(errorMessage, 'error');
        window.location.hash = '#/cliente/animes'; // Go back to safety
        return `<div class="catalog-container-empty"><p>${errorMessage}</p></div>`;
    }

    const userResult = getCurrentUser();
    const currentUser = userResult ? userResult.user : {};
    const favorites = currentUser?.favorites || [];
    const isFavorited = favorites.includes(anime.id);

    return `
      <div class="container">
        <button id="back-btn" class="btn btn-secondary btn-sm" style="margin-bottom:1rem;"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
        <div class="details-view">
            <div class="details-cover">
                <img src="${anime.cover}" alt="${anime.name}">
            </div>
            <div class="details-info">
                <h1>${anime.name}</h1>
                 <p><strong>Ano de Lançamento:</strong> ${anime.releaseYear || 'N/A'}</p>
                <div class="favorite-button-wrapper">
                     <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${anime.id}" onclick="toggleFavorite('${anime.id}', this)" aria-label="Marcar como favorito">
                        <span class="fav-icon">${isFavorited ? '❤️' : '🤍'}</span>
                        <span>${isFavorited ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}</span>
                    </button>
                </div>
                <p>${anime.description}</p>
                <h3>Temporadas</h3>
                <div class="season-buttons">
                    ${anime.seasons.map(season => `
                        <button class="btn btn-secondary btn-season" data-season="${season.seasonNumber}">Temporada ${season.seasonNumber}</button>
                    `).join('')}
                </div>
                <div id="episodes-container"></div>
                <div id="player-container-series" class="player-container" style="display: none;"></div>
                <div id="fallback-player-series"></div>
            </div>
        </div>
      </div>
    `;
}

function updateView(container, path) {
    const parts = path.split('/').filter(p => p); // e.g., ['cliente', 'filmes', 'ID']
    let pageType = parts[1] || 'filmes';
    let itemId = parts[2] || null;

    currentView = { type: pageType, id: itemId };

    let pageContent = '';
    
    if (itemId) {
        if (pageType === 'filmes') {
            pageContent = renderMovieDetails(itemId);
        } else if (pageType === 'series') {
            pageContent = renderSeriesDetails(itemId);
        } else if (pageType === 'animes') {
            pageContent = renderAnimesPage(itemId);
        } else {
            const errorMessage = "Erro: Categoria de conteúdo inválida.";
            showToast(errorMessage, 'error');
            pageContent = `<div class="catalog-container-empty"><p>${errorMessage}</p></div>`;
            window.location.hash = '#/cliente/filmes';
        }
    } else {
        currentFilter = '';
        currentPage = 1; // Reset page on navigation
        const urlParams = new URLSearchParams(path.split('?')[1] || '');
        currentCategory = urlParams.get('category') || 'todos';

        if (pageType === 'filmes') {
            pageContent = renderMoviesPage(container);
        } else if (pageType === 'series') {
            pageContent = renderSeriesPage(container);
        } else if (pageType === 'animes') {
            pageContent = renderAnimesPage(container);
        }
    }

    container.innerHTML = `
        ${renderHeader(pageType)}
        <main class="page">
            ${pageContent}
        </main>
        <div id="menu-overlay"></div>
        <div id="slide-in-menu">
            <a href="#/cliente/favoritos">${t('favorites')}</a>
            <a href="#/cliente/perfil">${t('profile')}</a>
            <a href="#/cliente/configuracoes-usuario">${t('user_settings')}</a>
            <button id="slide-menu-logout-btn">${t('logout')}</button>
        </div>
    `;
    
    // Now that the content is in the DOM, render pagination if needed.
     if (!itemId) {
        const userResult = getCurrentUser();
        const currentUser = userResult ? userResult.user : {};
        const favorites = currentUser?.favorites || [];
        const db = getDB();
        
        let items = [];
        if (pageType === 'filmes') items = db.movies;
        else if (pageType === 'series') items = db.series;
        else if (pageType === 'animes') items = (db.animes || []);

        // Ensure items is an array before filtering
        const safeItems = Array.isArray(items) ? items : [];

        const filteredItems = safeItems.filter(item => {
            const matchesSearch = normalizeString(item.name).includes(normalizeString(currentFilter));
            if (currentCategory === 'todos') return matchesSearch;
            if (currentCategory === 'favoritos') return matchesSearch && favorites.includes(item.id);
            // if (currentCategory === 'mais_assistidos' || currentCategory === 'recentes') return matchesSearch;
            return matchesSearch && item.category === currentCategory;
        });

        const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
        renderPaginationControls(document.getElementById('pagination-container'), currentPage, totalPages, (newPage) => {
            currentPage = newPage;
            updateView(container, window.location.hash.slice(1).split('?')[0]);
        });
    }

    // This was missing, preventing interactions like clicking on media cards and favoriting.
    attachClientListeners(container);
}

function handleEpisodeClick(e) {
    const link = e.target.dataset.link;
    const playerContainer = document.getElementById('player-container-series');
    const fallbackContainer = document.getElementById('fallback-player-series');
    const embedUrl = getEmbedUrl(link);
    
    playerContainer.innerHTML = '';
    fallbackContainer.innerHTML = '';
    
    if (embedUrl) {
        playerContainer.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        playerContainer.style.display = 'block';
    } else {
        fallbackContainer.innerHTML = `<a href="${link}" target="_blank" class="btn btn-primary" style="margin-top:1rem;">Assistir Episódio em Nova Aba</a>`;
        playerContainer.style.display = 'none';
    }
}

function renderEmptyPage(container, path) {
    console.log("Página vazia renderizada devido a um erro.");
    const pageType = (path.split('/')[2] || 'filmes').split('?')[0];
    container.innerHTML = `
        ${renderHeader(pageType)}
        <main class="page">
            <div class="container catalog-container-empty">
                <p>Ocorreu um erro ao carregar esta categoria. Tente novamente mais tarde.</p>
            </div>
        </main>
        <div id="menu-overlay"></div>
        <div id="slide-in-menu">
            <a href="#/cliente/favoritos">${t('favorites')}</a>
            <a href="#/cliente/perfil">${t('profile')}</a>
            <a href="#/cliente/configuracoes-usuario">${t('user_settings')}</a>
            <button id="slide-menu-logout-btn">${t('logout')}</button>
        </div>
    `;
    attachCommonClientListeners(container);
}

export function renderClientPanel(container, path) {
    const session = getSession();
    if (!session) {
        showToast('Sessão inválida. Por favor, faça login novamente.', 'error');
        window.location.hash = '/login';
        return;
    }
    console.log('Renderizando página:', window.location.hash, 'User:', session.username);
    try {
        console.log(`Carregando categoria: ${path.split('?')[0]}`);
        updateView(container, path);
    } catch(e) {
        console.log('Erro na categoria: ', e);
        renderEmptyPage(container, path);
    }
}

export function attachClientListeners(container, viewOptions = {}) {
    const { pageType, id } = viewOptions;
    const currentViewType = pageType || currentView.type;

    const handleSearch = () => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            console.log("Pesquisa por:", searchInput.value);
            currentFilter = searchInput.value;
            currentPage = 1; // Reset to first page on search
            if (currentViewType === 'favoritos') {
                // Favorites page has its own render logic
                const event = new CustomEvent('clientSearch');
                document.dispatchEvent(event);
            } else {
                updateView(container, `#/cliente/${currentViewType}`);
            }
        }
    };
    
    attachCommonClientListeners(container, {
        onSearch: handleSearch,
        pageType: currentViewType
    });

    const headerFavIcon = document.getElementById('header-fav-icon');
    if(headerFavIcon) {
        headerFavIcon.addEventListener('click', () => {
            const itemId = headerFavIcon.dataset.id;
            handleHeaderFavoriteClick(itemId);
        });
    }

    // Category Menu
    const categoryToggle = document.getElementById('category-menu-toggle');
    const categoryMenu = document.getElementById('category-menu');
    if (categoryToggle && categoryMenu) {
        categoryToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            categoryMenu.classList.toggle('show');
        });
        document.addEventListener('click', (e) => {
            if (categoryMenu && !categoryMenu.contains(e.target) && !categoryToggle.contains(e.target)) {
                categoryMenu.classList.remove('show');
            }
        });

        const categorySearchInput = document.getElementById('category-search-input');
        if (categorySearchInput) {
            const debouncedCategorySearch = debounce((searchTerm) => {
                const normalizedSearch = normalizeString(searchTerm);
                document.querySelectorAll('#category-links-container .category-link').forEach(link => {
                    const linkText = normalizeString(link.textContent);
                    if (linkText.includes(normalizedSearch)) {
                        link.style.display = 'flex';
                    } else {
                        link.style.display = 'none';
                    }
                });
            }, 300);
            categorySearchInput.addEventListener('input', (e) => {
                debouncedCategorySearch(e.target.value);
            });
        }

        document.querySelectorAll('.category-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const newCategory = e.target.dataset.category;
                
                if (currentViewType === 'animes') {
                    currentAnimeSort = newCategory;
                } else {
                    currentCategory = newCategory;
                }
                
                currentPage = 1; // Reset page
                categoryMenu.classList.remove('show');
                updateView(container, `#/cliente/${currentViewType}`);
            });
        });
    }

    document.querySelectorAll('.media-card').forEach(element => {
        element.addEventListener('click', (e) => {
            const card = e.currentTarget; // Use currentTarget to avoid issues with nested elements
            const id = card.dataset.id;
            if (id) {
                window.location.hash = `#/player?id=${id}`;
            }
        });
    });

    document.querySelectorAll('.favorite-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const itemId = button.dataset.id;
            // The logic is now handled by the global `toggleFavorite` function
            // This listener is kept to prevent potential regressions if other code relies on it,
            // but the primary action is now in the onclick attribute.
            // await handleToggleFavorite(itemId, container);
        });
    });

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // A more robust back navigation
            if(window.history.length > 2) {
                window.history.back();
            } else {
                window.location.hash = `#/cliente/${currentView.type || 'filmes'}`;
            }
        });
    }

    const seasonButtons = document.querySelectorAll('.btn-season');
    if (seasonButtons.length > 0) {
        seasonButtons.forEach(btn => {
            btn.addEventListener('click', e => {
                seasonButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const seasonNumber = parseInt(e.target.dataset.season);
                const db = getDB();
                const series = currentView.type === 'animes' 
                    ? (db.animes || []).find(s => s.id === currentView.id) 
                    : db.series.find(s => s.id === currentView.id);
                const season = series.seasons.find(s => s.seasonNumber === seasonNumber);
                
                const episodesContainer = document.getElementById('episodes-container');
                episodesContainer.innerHTML = `
                    <h4>Episódios</h4>
                    <div class="episode-buttons">
                        ${season.episodes.map(ep => `
                            <button class="btn btn-secondary btn-episode" data-link="${ep.link}">Episódio ${ep.episodeNumber}</button>
                        `).join('')}
                    </div>
                `;
                document.querySelectorAll('.btn-episode').forEach(epBtn => {
                    epBtn.addEventListener('click', handleEpisodeClick);
                });
            });
        });
        // Auto-click first season
        if(seasonButtons[0]) seasonButtons[0].click();
    }
    
    // Check if iframe can load, otherwise show fallback
    const playerIframe = document.querySelector('#player-container iframe');
    if (playerIframe) {
        playerIframe.addEventListener('error', () => {
            const fallbackContainer = document.getElementById('fallback-player');
            fallbackContainer.innerHTML = `<a href="${playerIframe.src}" target="_blank" class="btn btn-primary">Não foi possível carregar o player. Assistir em Nova Aba.</a>`;
            playerIframe.parentElement.style.display = 'none';
        });
        // A more reliable method is needed for cross-origin iframes, but this is a simple attempt.
    }
}

export function attachCommonClientListeners(container, options = {}) {
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('logout'));
    });

    // Slide-in Menu
    const menuToggle = document.getElementById('mobile-menu-toggle-bottom');
    const slideMenu = document.getElementById('slide-in-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const closeMenu = () => {
        slideMenu.classList.remove('open');
        menuOverlay.classList.remove('show');
    };
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            slideMenu.classList.toggle('open');
            menuOverlay.classList.toggle('show');
        });
    }
    menuOverlay.addEventListener('click', closeMenu);
    document.getElementById('slide-menu-logout-btn').addEventListener('click', () => {
        closeMenu();
        document.dispatchEvent(new CustomEvent('logout'));
    });

    // Mobile search (no longer used, but kept for now)
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    const mobileSearchOverlay = document.getElementById('mobile-search-overlay');
    const mobileSearchInput = document.getElementById('mobile-search-input');
    
    if (searchToggleBtn && mobileSearchOverlay && mobileSearchInput) {
        searchToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileSearchOverlay.classList.toggle('show');
            if (mobileSearchOverlay.classList.contains('show')) {
                mobileSearchInput.focus();
            }
        });

        mobileSearchOverlay.addEventListener('click', (e) => {
            if (e.target === mobileSearchOverlay) {
                mobileSearchOverlay.classList.remove('show');
            }
        });
        
        mobileSearchInput.addEventListener('input', e => {
             // This logic might need to be adapted if mobile search is re-enabled
        });
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                options.onSearch();
            }
        });
    }
}