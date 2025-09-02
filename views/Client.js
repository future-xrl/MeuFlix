import { getDB } from 'db';
import { normalizeString, getYoutubeEmbedUrl } from 'utils';

const session = JSON.parse(localStorage.getItem('session'));
let currentFilter = '';
let currentView = { type: 'movies', id: null }; // or { type: 'series', id: null }

function renderHeader(activeLink) {
    return `
        <header class="client-header">
            <div class="logo">🎬 CinemaStream</div>
            <nav>
                <a href="#/cliente/filmes" class="${activeLink === 'filmes' ? 'active' : ''}">Filmes</a>
                <a href="#/cliente/series" class="${activeLink === 'series' ? 'active' : ''}">Séries</a>
            </nav>
            <div class="header-actions">
                <button id="logout-btn" class="btn btn-secondary btn-sm">Sair <i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
        </header>
    `;
}

function renderMediaGrid(items, type) {
    if (items.length === 0) {
        return `<p>Nenhum item encontrado.</p>`;
    }
    return `
        <div class="catalog-grid">
            ${items.map(item => `
                <div class="media-card" data-id="${item.id}" data-type="${type}">
                    ${item.cover ? `<img src="${item.cover}" alt="${item.name}">` : `<div class="placeholder-cover"><i class="fa-solid fa-film"></i></div>`}
                    <div class="media-card-title">${item.name}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderMoviesPage() {
    const db = getDB();
    const filteredMovies = db.movies.filter(movie => normalizeString(movie.name).includes(normalizeString(currentFilter)));
    const content = `
        <div class="container">
            <h1>Filmes</h1>
            <div class="search-bar">
                 <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="search-input" class="form-control" placeholder="Pesquisar Filmes..." value="${currentFilter}">
            </div>
            ${renderMediaGrid(filteredMovies, 'movie')}
        </div>
    `;
    return content;
}

function renderSeriesPage() {
    const db = getDB();
    const filteredSeries = db.series.filter(series => normalizeString(series.name).includes(normalizeString(currentFilter)));
    const content = `
        <div class="container">
            <h1>Séries</h1>
            <div class="search-bar">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="search-input" class="form-control" placeholder="Pesquisar Séries..." value="${currentFilter}">
            </div>
            ${renderMediaGrid(filteredSeries, 'series')}
        </div>
    `;
    return content;
}

function renderMovieDetails(movieId) {
    const db = getDB();
    const movie = db.movies.find(m => m.id === movieId);
    if (!movie) return `<p>Filme não encontrado.</p>`;
    
    const embedUrl = getYoutubeEmbedUrl(movie.link);

    return `
      <div class="container">
        <button id="back-btn" class="btn btn-secondary btn-sm" style="margin-bottom:1rem;"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
        <div class="details-view">
            <div class="details-cover">
                <img src="${movie.cover}" alt="${movie.name}">
            </div>
            <div class="details-info">
                <h1>${movie.name}</h1>
                <p>${movie.description}</p>
                ${embedUrl 
                    ? `<div class="player-container"><iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>` 
                    : `<a href="${movie.link}" target="_blank" class="btn btn-primary">Assistir em Nova Aba</a>`
                }
            </div>
        </div>
      </div>
    `;
}

function renderSeriesDetails(seriesId) {
    const db = getDB();
    const series = db.series.find(s => s.id === seriesId);
    if (!series) return `<p>Série não encontrada.</p>`;

    return `
      <div class="container">
        <button id="back-btn" class="btn btn-secondary btn-sm" style="margin-bottom:1rem;"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
        <div class="details-view">
            <div class="details-cover">
                <img src="${series.cover}" alt="${series.name}">
            </div>
            <div class="details-info">
                <h1>${series.name}</h1>
                <p>${series.description}</p>
                <h3>Temporadas</h3>
                <div class="season-buttons">
                    ${series.seasons.map(season => `
                        <button class="btn btn-secondary btn-season" data-season="${season.seasonNumber}">Temporada ${season.seasonNumber}</button>
                    `).join('')}
                </div>
                <div id="episodes-container"></div>
                <div id="player-container-series"></div>
            </div>
        </div>
      </div>
    `;
}

function updateView(container, path) {
    const parts = path.split('/').filter(p => p); // cliente, filmes, ID
    let pageType = parts[1] || 'filmes';
    let itemId = parts[2] || null;

    currentView = { type: pageType, id: itemId };

    let pageContent = '';
    
    if (itemId) {
        if (pageType === 'filmes') {
            pageContent = renderMovieDetails(itemId);
        } else if (pageType === 'series') {
            pageContent = renderSeriesDetails(itemId);
        }
    } else {
        currentFilter = '';
        if (pageType === 'filmes') {
            pageContent = renderMoviesPage();
        } else if (pageType === 'series') {
            pageContent = renderSeriesPage();
        }
    }

    container.innerHTML = `
        ${renderHeader(pageType)}
        <main class="page">
            ${pageContent}
        </main>
    `;
    
    attachClientListeners();
}

function attachClientListeners() {
    document.getElementById('logout-btn').addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('logout'));
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            currentFilter = e.target.value;
            const pageType = currentView.type === 'series' ? 'series' : 'filmes';
            window.location.hash = `#/cliente/${pageType}`;
        });
    }

    document.querySelectorAll('.media-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const type = card.dataset.type === 'series' ? 'series' : 'filmes';
            window.location.hash = `#/cliente/${type}/${id}`;
        });
    });

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.hash = `#/cliente/${currentView.type}`;
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
                const series = db.series.find(s => s.id === currentView.id);
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
}

function handleEpisodeClick(e) {
    const link = e.target.dataset.link;
    const playerContainer = document.getElementById('player-container-series');
    const embedUrl = getYoutubeEmbedUrl(link);
    if(embedUrl) {
        playerContainer.innerHTML = `<div class="player-container"><iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>`;
    } else {
        playerContainer.innerHTML = `<a href="${link}" target="_blank" class="btn btn-primary" style="margin-top:1rem;">Assistir Episódio em Nova Aba</a>`;
    }
}

export function renderClientPanel(container, path) {
    updateView(container, path);
}