import { getDB, saveDB } from 'db';
import { normalizeString, getEmbedUrl, showToast, MEDIA_CATEGORIES, renderPaginationControls, debounce } from 'utils';

/** @tweakable [Set to true to enable the client-side search functionality] */
const ENABLE_SEARCH = true;

let currentFilter = '';
let currentCategory = 'todos';
/* @tweakable [Default sort order for animes] */
let currentAnimeSort = 'alfabetica';
let currentPage = 1;
/** @tweakable [Number of items per page in the client catalog] */
const ITEMS_PER_PAGE = 20;
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

/**
 * @tweakable [Delay in milliseconds for the search input debouncing]
 */
const SEARCH_DEBOUNCE_DELAY = 300;

async function handleSearch(searchTerm) {
    const searchResultsContainer = document.getElementById('search-results-container');
    const catalogContainer = document.getElementById('catalog-container');

    if (!searchResultsContainer || !catalogContainer) return;

    if (!searchTerm.trim()) {
        searchResultsContainer.innerHTML = '';
        searchResultsContainer.style.display = 'none';
        catalogContainer.style.display = 'block';
        return;
    }

    catalogContainer.style.display = 'none';
    searchResultsContainer.style.display = 'block';
    searchResultsContainer.innerHTML = '<div class="loading-spinner" style="height: 200px;">Buscando...</div>';


    const db = getDB();
    const normalizedSearch = normalizeString(searchTerm);

    const allMedia = [
        ...db.movies.map(m => ({ ...m, mediaType: 'Filme', type: 'filmes' })),
        ...db.series.map(s => ({ ...s, mediaType: 'Série', type: 'series' })),
        ...(db.animes || []).map(a => ({ ...a, mediaType: 'Anime', type: 'animes' }))
    ];

    const results = allMedia.filter(item => normalizeString(item.name).includes(normalizedSearch));

    // Prioritize results based on current page
    results.sort((a, b) => {
        const aIsPriority = a.type === currentView.type;
        const bIsPriority = b.type === currentView.type;
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;
        return 0;
    });

    if (results.length === 0) {
        searchResultsContainer.innerHTML = `<p class="no-results-message">Nenhum resultado encontrado. Tente outro termo de busca.</p>`;
        return;
    }

    const groupedResults = results.reduce((acc, item) => {
        const key = item.mediaType;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(item);
        return acc;
    }, {});

    // Ensure consistent order of groups
    const groupOrder = ['Filme', 'Série', 'Anime'];
    let resultsHTML = '';
    for (const groupName of groupOrder) {
        if (groupedResults[groupName]) {
            resultsHTML += `
                <div class="search-result-group">
                    <h2 class="search-result-group-title">${groupName}s</h2>
                    <div class="catalog-grid">
                        ${groupedResults[groupName].map(item => `
                            <div class="media-card" data-id="${item.id}" onclick="window.location.hash='#/player?id=${item.id}'">
                                <div class="cover-container">
                                    ${item.cover ? `<img src="${item.cover}" alt="${item.name}" loading="lazy">` : `<div class="placeholder-cover"><i class="fa-solid fa-film"></i></div>`}
                                </div>
                                <div class="media-card-title">${item.name}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    searchResultsContainer.innerHTML = resultsHTML;
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
            <div class="header-top-row">
                <div class="logo">Meuflix</div>
                <div class="header-actions">
                    <span class="welcome-user">${welcomeMessage}</span>
                    <button id="logout-btn" class="btn btn-secondary btn-sm">Sair <i class="fa-solid fa-right-from-bracket"></i></button>
                </div>
                <button id="client-menu-toggle" aria-label="Abrir menu"><i class="fa-solid fa-bars"></i></button>
            </div>
            <nav class="desktop-nav">
                <a href="#/cliente/filmes" class="btn-nav ${activeLink === 'filmes' ? 'active' : ''}"><i class="fa-solid fa-film"></i> Filmes</a>
                <a href="#/cliente/series" class="btn-nav ${activeLink === 'series' ? 'active' : ''}"><i class="fa-solid fa-tv"></i> Séries</a>
                <a href="#/cliente/animes" class="btn-nav ${activeLink === 'animes' ? 'active' : ''}"><i class="fa-solid fa-dragon"></i> Animes</a>
                <a href="#/cliente/favoritos" class="btn-nav ${activeLink === 'favoritos' ? 'active' : ''}"><i class="fa-solid fa-heart"></i> Favoritos</a>
                 ${ENABLE_SEARCH ? `
                    <div class="nav-search-container">
                        <i class="fa-solid fa-magnifying-glass search-icon"></i>
                        <input type="search" id="client-search-bar" placeholder="Buscar Filmes, Séries ou Animes" aria-label="Buscar conteúdo">
                    </div>
                ` : ''}
                 ${currentItem ? `
                    <div class="header-favorite-container">
                        <i id="header-fav-icon" class="fa-solid fa-heart header-fav-icon ${isFavorited ? 'favorited' : ''}" data-id="${currentItem.id}"></i>
                        <div id="header-fav-dropdown" class="header-fav-dropdown">
                            <!-- Content is set dynamically -->
                        </div>
                    </div>
                ` : ''}
            </nav>
        </header>
         <nav class="mobile-nav">
            <a href="#/cliente/filmes" class="${activeLink === 'filmes' ? 'active' : ''}">
                <i class="fa-solid fa-film"></i>
                <span>Filmes</span>
            </a>
            <a href="#/cliente/series" class="${activeLink === 'series' ? 'active' : ''}">
                <i class="fa-solid fa-tv"></i>
                <span>Séries</span>
            </a>
            <a href="#/cliente/animes" class="${activeLink === 'animes' ? 'active' : ''}">
                <i class="fa-solid fa-dragon"></i>
                <span>Animes</span>
            </a>
            <a href="#/cliente/favoritos" class="${activeLink === 'favoritos' ? 'active' : ''}">
                <i class="fa-solid fa-heart"></i>
                <span>Favoritos</span>
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
        return `<p>Nenhum item encontrado.</p>`;
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
    
    /** @tweakable [Set to true to enable category filtering on catalog pages] */
    const ENABLE_CATEGORY_FILTER = false;

    const filteredItems = items.filter(item => {
        const searchTerm = normalizeString(currentFilter);
        const matchesSearch = searchTerm === '' || 
            normalizeString(item.name).includes(searchTerm) ||
            normalizeString(item.description).includes(searchTerm) ||
            normalizeString(MEDIA_CATEGORIES.find(c => c.key === item.category)?.name || '').includes(searchTerm);
        
        if (!ENABLE_CATEGORY_FILTER || currentCategory === 'todos') return matchesSearch;
        if (currentCategory === 'favoritos') return matchesSearch && favorites.includes(item.id);
        
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
                <h1>${title}</h1>
                 ${ENABLE_SEARCH ? `
                 <div class="search-bar desktop-search" style="display: none;">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="search-input" class="form-control" placeholder="Pesquisar ${title}..." value="${currentFilter}">
                </div>
                ` : ''}
                <div class="catalog-info">
                    <span class="total-count">Todos ${items.length}</span>
                    ${ENABLE_CATEGORY_FILTER ? `
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
                    ` : ''}
                </div>
            </div>
            ${renderMediaGrid(filteredItems, onPageChange, { currentPage, itemsPerPage: ITEMS_PER_PAGE })}
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

    const filteredItems = animes.filter(item => {
        const searchTerm = normalizeString(currentFilter);
        return searchTerm === '' ||
            normalizeString(item.name).includes(searchTerm) ||
            normalizeString(item.description).includes(searchTerm) ||
            normalizeString(MEDIA_CATEGORIES.find(c => c.key === item.category)?.name || '').includes(searchTerm);
    });
    
    const sortOptions = {
        'alfabetica': { name: 'Ordem Alfabética', icon: 'fa-solid fa-sort-alpha-down' },
        'numerica': { name: 'Numérica', icon: 'fa-solid fa-sort-numeric-down' },
        'recentes': { name: 'Recém Adicionados', icon: 'fa-solid fa-clock' },
        'lancamento': { name: 'Lançamento', icon: 'fa-solid fa-calendar-days' },
        'populares': { name: 'Mais Populares', icon: 'fa-solid fa-fire' }
    };
    
    /** @tweakable [Set to true to enable the sort menu on the animes page] */
    const ENABLE_ANIME_SORT = false;

    const content = `
        <div class="container">
            <div class="catalog-header">
                <h1>Animes</h1>
                 ${ENABLE_SEARCH ? `
                 <div class="search-bar desktop-search" style="display: none;">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="search-input" class="form-control" placeholder="Pesquisar Animes..." value="${currentFilter}">
                </div>
                ` : ''}
                <div class="catalog-info">
                    <span class="total-count">Todos ${animes.length}</span>
                    ${ENABLE_ANIME_SORT ? `
                    <div class="category-menu-wrapper">
                        <button class="anime-sort-button" id="category-menu-toggle" aria-label="Abrir menu de ordenação">
                            ${sortOptions[currentAnimeSort]?.name || 'Ordenar'}
                        </button>
                        <div class="category-menu" id="category-menu">
                             ${Object.entries(sortOptions).map(([key, value]) => `<a href="#" class="category-link ${currentAnimeSort === key ? 'active' : ''}" data-category="${key}" tabindex="0"><i class="${value.icon}"></i> ${value.name}</a>`).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            ${renderMediaGrid(filteredItems, onPageChange, { currentPage, itemsPerPage: ITEMS_PER_PAGE })}
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
        return `<p>${errorMessage}</p>`;
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
                    <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${movie.id}" aria-label="Marcar como favorito">
                        <i class="fa-${isFavorited ? 'solid' : 'regular'} fa-heart"></i>
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
        return `<p>${errorMessage}</p>`;
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
                     <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${series.id}" aria-label="Marcar como favorito">
                        <i class="fa-${isFavorited ? 'solid' : 'regular'} fa-heart"></i>
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
        return `<p>${errorMessage}</p>`;
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
                     <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${anime.id}" aria-label="Marcar como favorito">
                        <i class="fa-${isFavorited ? 'solid' : 'regular'} fa-heart"></i>
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
            pageContent = renderAnimeDetails(itemId);
        } else {
            const errorMessage = "Erro: Categoria de conteúdo inválida.";
            showToast(errorMessage, 'error');
            pageContent = `<p>${errorMessage}</p>`;
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
            <div id="search-results-container" style="display: none;"></div>
            <div id="catalog-container">
                ${pageContent}
            </div>
        </main>
        <div id="menu-overlay"></div>
        <div id="slide-in-menu">
            <a href="#/cliente/favoritos">Favoritos</a>
            <a href="#/cliente/perfil">Perfil</a>
            <a href="#/cliente/configuracoes">Configurações</a>
            <button id="slide-menu-logout-btn">Sair</button>
        </div>
    `;
    
    // Now that the content is in the DOM, render pagination if needed.
     if (!itemId) {
        const userResult = getCurrentUser();
        const currentUser = userResult ? userResult.user : {};
        const favorites = currentUser?.favorites || [];
        const db = getDB();
        const items = pageType === 'filmes' ? db.movies : (pageType === 'series' ? db.series : (db.animes || []));

        const filteredItems = items.filter(item => {
            const searchTerm = normalizeString(currentFilter);
            const matchesSearch = searchTerm === '' ||
                normalizeString(item.name).includes(searchTerm) ||
                normalizeString(item.description).includes(searchTerm) ||
                normalizeString(MEDIA_CATEGORIES.find(c => c.key === item.category)?.name || '').includes(searchTerm);
            
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

async function handleToggleFavorite(itemId, container) {
    const userResult = getCurrentUser();
    if (!userResult) return;

    const { user, type } = userResult;
    const db = getDB();
    const userIndex = db.users[type].findIndex(u => u.username === user.username);
    if (userIndex === -1) return;

    const userFromDB = db.users[type][userIndex];
    userFromDB.favorites = userFromDB.favorites || [];
    const itemIndex = userFromDB.favorites.indexOf(itemId);

    if (itemIndex > -1) {
        userFromDB.favorites.splice(itemIndex, 1); // Unfavorite
    } else {
        userFromDB.favorites.push(itemId); // Favorite
    }
    
    saveDB(db);

    // Re-render the view to update all favorite icons and potentially the list if on "Favorites"
    const currentHash = window.location.hash.slice(1);
    if (currentHash.startsWith('/cliente/favoritos')) {
        const { renderFavoritesPage } = await import('views/client/Favorites');
        renderFavoritesPage(container);
    } else {
        updateView(container, currentHash);
    }
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

export function renderClientPanel(container, path) {
    const session = getSession();
    if (!session) {
        showToast('Sessão inválida. Por favor, faça login novamente.', 'error');
        window.location.hash = '/login';
        return;
    }
    console.log('Renderizando página:', window.location.hash, 'User:', session.username);
    updateView(container, path);
}

export function attachClientListeners(container, viewOptions = {}) {
    const { pageType, id } = viewOptions;
    const currentViewType = pageType || currentView.type;

    const debouncedSearch = debounce(async (value) => {
        currentFilter = value; // Keep this for other potential filters
        await handleSearch(value);
    }, SEARCH_DEBOUNCE_DELAY);

    attachCommonClientListeners(container, {
        onSearch: ENABLE_SEARCH ? (value) => {
            debouncedSearch(value);
        } : () => {},
        pageType: currentViewType
    });

    if (ENABLE_SEARCH) {
        const searchInput = document.getElementById('client-search-bar');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });
             // Clear search on navigation
             const currentSearchTerm = sessionStorage.getItem('clientSearchTerm') || '';
             searchInput.value = currentSearchTerm;
             if (currentSearchTerm) {
                 handleSearch(currentSearchTerm);
             }
             window.addEventListener('hashchange', () => {
                 searchInput.value = '';
                 sessionStorage.removeItem('clientSearchTerm');
                 handleSearch('');
             }, { once: true }); // Clean up listener after navigation
             searchInput.addEventListener('search', (e) => { // Handle clear button (X)
                if(!e.target.value) {
                    debouncedSearch('');
                }
            });
            searchInput.addEventListener('keyup', (e) => {
                sessionStorage.setItem('clientSearchTerm', e.target.value);
            });
        }
    }

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
            await handleToggleFavorite(itemId, container);
        });
    });

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // A more robust back navigation
            const searchInput = document.getElementById('client-search-bar');
            if (searchInput && searchInput.value) {
                searchInput.value = '';
                handleSearch('');
            } else if(window.history.length > 2) {
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
                    <div class="episode-buttons scrollable-row">
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

    if (ENABLE_SEARCH) {
        // Mobile search
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
            
            mobileSearchInput.addEventListener('input', e => options.onSearch(e.target.value));
        }

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', e => options.onSearch(e.target.value));
        }
    }
}