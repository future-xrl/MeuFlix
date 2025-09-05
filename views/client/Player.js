import { getDB, saveDB } from 'db';
import { renderHeader, attachCommonClientListeners } from 'views/Client';
import { getEmbedUrl, showToast } from 'utils';

const session = JSON.parse(localStorage.getItem('session'));

/** @tweakable [The maximum number of items to keep in the watch history] */
const MAX_HISTORY_ITEMS = 20;

/** @tweakable [The color of the heart icon when an item is favorited] */
const FAVORITED_COLOR = 'red';
/** @tweakable [The color of the heart icon when an item is not favorited] */
const NOT_FAVORITED_COLOR = 'grey';

// --- Module-level state for the player ---
let currentItem = null;
let currentSeasonIndex = 0;
let currentEpisodeIndex = 0;
// -----------------------------------------

function isFavorited(itemId) {
    if (!session?.username) return false;
    const db = getDB();
    const client = db.users.clients.find(c => c.username === session.username);
    if (client) {
        return client.favorites?.includes(itemId) || false;
    }
    const test = (db.users.tests || []).find(t => t.username === session.username);
    if (test) {
        return test.favorites?.includes(itemId) || false;
    }
    return false;
}

function addToHistory(item) {
    if (!session?.username) return;

    const itemType = item.id.startsWith('movie') ? 'movie' : (item.id.startsWith('series') ? 'series' : 'anime');
    
    const historyKey = `watchHistory_${session.username}`;
    let history = JSON.parse(localStorage.getItem(historyKey) || '[]');

    // Remove existing entry for this item to move it to the top
    history = history.filter(entry => entry.id !== item.id);

    // Add the new entry to the top
    history.unshift({
        id: item.id,
        type: itemType,
        timestamp: new Date().toISOString()
    });

    // Limit the history size
    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    localStorage.setItem(historyKey, JSON.stringify(history));
    console.log('Histórico atualizado:', history);
    showToast("Adicionado ao histórico!");
}

function updatePlayerUI(link) {
    const playerContainer = document.getElementById('player-wrapper');
    const embedUrl = getEmbedUrl(link);
    console.log('Loading episode:', link);

    if (embedUrl) {
        playerContainer.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else {
        playerContainer.innerHTML = `<div class="player-placeholder">Link inválido. <a href="${link}" target="_blank">Abrir em nova aba</a>.</div>`;
    }
}

function updateNextEpisodeButtonState() {
    const nextEpBtn = document.getElementById('next-episode-btn');
    if (!nextEpBtn || !currentItem) return;

    const { nextSeasonIndex, nextEpisodeIndex } = getNextEpisodeIndices();

    if (nextSeasonIndex !== null) {
        nextEpBtn.disabled = false;
    } else {
        nextEpBtn.disabled = true;
    }
}

function getNextEpisodeIndices() {
    if (!currentItem || !currentItem.seasons) return { nextSeasonIndex: null, nextEpisodeIndex: null };

    const currentSeason = currentItem.seasons[currentSeasonIndex];
    
    // Check for next episode in the same season
    if (currentEpisodeIndex < currentSeason.episodes.length - 1) {
        return { nextSeasonIndex: currentSeasonIndex, nextEpisodeIndex: currentEpisodeIndex + 1 };
    }
    
    // Check for next season
    if (currentSeasonIndex < currentItem.seasons.length - 1) {
        const nextSeason = currentItem.seasons[currentSeasonIndex + 1];
        if (nextSeason && nextSeason.episodes.length > 0) {
            return { nextSeasonIndex: currentSeasonIndex + 1, nextEpisodeIndex: 0 };
        }
    }

    return { nextSeasonIndex: null, nextEpisodeIndex: null };
}

function loadEpisode(seasonIndex, episodeIndex) {
    if (!currentItem || !currentItem.seasons) return;
    
    const season = currentItem.seasons[seasonIndex];
    if (!season || !season.episodes[episodeIndex]) {
        console.error(`Episode S${seasonIndex+1}E${episodeIndex+1} not found.`);
        return;
    }

    currentSeasonIndex = seasonIndex;
    currentEpisodeIndex = episodeIndex;

    const episode = season.episodes[episodeIndex];
    updatePlayerUI(episode.link);

    // Highlight active buttons
    document.querySelectorAll('.btn-season').forEach(b => b.classList.remove('active'));
    document.querySelector(`.btn-season[data-season-index="${seasonIndex}"]`)?.classList.add('active');
    
    document.querySelectorAll('.btn-episode').forEach(b => b.classList.remove('active'));
    document.querySelector(`.btn-episode[data-season-index="${seasonIndex}"][data-episode-index="${episodeIndex}"]`)?.classList.add('active');
    
    updateNextEpisodeButtonState();
}

function handleNextEpisode() {
    const { nextSeasonIndex, nextEpisodeIndex } = getNextEpisodeIndices();
    if (nextSeasonIndex !== null) {
        console.log(`Advancing to S${nextSeasonIndex + 1}E${nextEpisodeIndex + 1}`);
        // If changing season, we need to re-render episode list for that season first.
        if (nextSeasonIndex !== currentSeasonIndex) {
            const seasonButton = document.querySelector(`.btn-season[data-season-index="${nextSeasonIndex}"]`);
            seasonButton?.click(); // This will render the episodes for the new season
        }
        loadEpisode(nextSeasonIndex, nextEpisodeIndex);
    } else {
        console.log("No next episode.");
    }
}

function updateLikeSection() {
    if (!currentItem) return;
    const db = getDB();
    const itemType = currentItem.id.startsWith('series') ? 'series' : 'animes';
    const dbItem = db[itemType].find(i => i.id === currentItem.id);

    if (!dbItem) return;

    const likeCount = dbItem.likeCount || 0;
    const likedBy = dbItem.likedBy || [];
    const hasUserLiked = session?.username && likedBy.includes(session.username);

    const likeText = document.getElementById('like-text');
    const likeHeart = document.getElementById('like-heart');

    if (likeText) {
        if (hasUserLiked) {
            likeText.innerHTML = `Obrigado por curtir! (${likeCount})`;
            likeText.style.color = 'grey';
            likeText.style.textDecoration = 'none';
            likeText.style.cursor = 'default';
            likeText.onclick = null;
        } else {
            likeText.innerHTML = `clique aqui para curtir (${likeCount})`;
            likeText.style.color = '#4facfe';
            likeText.style.textDecoration = 'underline';
            likeText.style.cursor = 'pointer';
            likeText.setAttribute('onclick', `handleLike('${currentItem.id}')`);
        }
    }
    if (likeHeart) {
        likeHeart.style.color = hasUserLiked ? 'red' : 'white';
    }
}

function handleLikeEvent(event) {
    const { itemId } = event.detail;
    if (!session?.username) {
        showToast('Você precisa estar logado para curtir.', 'error');
        return;
    }
    const db = getDB();
    const itemType = itemId.startsWith('series') ? 'series' : 'animes';
    const itemIndex = db[itemType].findIndex(i => i.id === itemId);

    if (itemIndex === -1) return;

    const item = db[itemType][itemIndex];
    item.likedBy = item.likedBy || [];

    if (item.likedBy.includes(session.username)) {
        showToast('Você já curtiu isso!', 'error');
        return;
    }

    item.likeCount = (item.likeCount || 0) + 1;
    item.likedBy.push(session.username);
    
    saveDB(db);
    showToast('Curtido com sucesso!');
    console.log(`Curtida registrada para ${itemId}: ${item.likeCount}`);
    updateLikeSection();
}

function handleEpisodeClick(e) {
    const link = e.target.dataset.link;
    const playerContainer = document.getElementById('player-wrapper');
    const embedUrl = getEmbedUrl(link);
    
    playerContainer.innerHTML = '';
    
    if (embedUrl) {
        showToast("Carregando player...");
        playerContainer.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        playerContainer.style.display = 'block';
    } else {
        showToast("Erro ao carregar o player.", "error");
        playerContainer.innerHTML = `<div class="container"><a href="${link}" target="_blank" class="btn btn-primary">Assistir Episódio em Nova Aba</a></div>`;
        playerContainer.style.display = 'none';
    }
}

function attachPlayerListeners(item, container) {
    // The favorite button now uses the global `toggleFavorite` via its `onclick` attribute.
    // The local event listener and handler function have been removed to prevent the "add and remove at the same time" bug.
    // The global event handler in `app.js` will manage the logic and UI updates.
    console.log("Player listeners attached. Favorite logic handled globally.");

    document.removeEventListener('handleLike', handleLikeEvent);
    document.addEventListener('handleLike', handleLikeEvent);

    const seasonButtons = document.querySelectorAll('.btn-season');
    if (seasonButtons.length > 0) {
        seasonButtons.forEach((btn, sIndex) => {
            btn.addEventListener('click', e => {
                console.log(`Temporada selecionada: ${sIndex + 1}`);
                seasonButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const season = item.seasons[sIndex];
                const episodesContainer = document.getElementById('episodes-container');
                episodesContainer.innerHTML = `
                    <h4>Episódios</h4>
                    <div class="episode-buttons">
                        ${season.episodes.map((ep, eIndex) => `
                            <button class="btn btn-secondary btn-episode" data-season-index="${sIndex}" data-episode-index="${eIndex}">Episódio ${ep.episodeNumber}</button>
                        `).join('')}
                    </div>
                `;
                document.querySelectorAll('.btn-episode').forEach(epBtn => {
                    epBtn.addEventListener('click', (ev) => {
                        const sIdx = parseInt(ev.target.dataset.seasonIndex);
                        const eIdx = parseInt(ev.target.dataset.episodeIndex);
                        loadEpisode(sIdx, eIdx);
                    });
                });

                // Auto-load first episode of the selected season
                if (season.episodes.length > 0) {
                    loadEpisode(sIndex, 0);
                } else {
                    document.getElementById('player-wrapper').innerHTML = '<div class="player-placeholder">Nenhum episódio nesta temporada.</div>';
                }
            });
        });

        // Trigger click on first season to render its episodes, then auto-load first episode
        if (seasonButtons[0]) {
            seasonButtons[0].click();
        }
    }
    
    const nextEpBtn = document.getElementById('next-episode-btn');
    if (nextEpBtn) {
        nextEpBtn.addEventListener('click', handleNextEpisode);
    }
    
    attachCommonClientListeners(container);
}

function renderItemContent(item) {
    const isCurrentlyFavorited = isFavorited(item.id);
    const itemType = item.id.startsWith('movie') ? 'filme' : (item.id.startsWith('series') ? 'serie' : 'anime');

    let playerHTML = '';
    let seasonHTML = '';
    let nextEpisodeButtonHTML = '';
    let likeSectionHTML = '';
    
    if (itemType === 'filme') {
        if (!item.link) {
            showToast("Link do player indisponível.", 'error');
            return `<p class="container">Link do player indisponível.</p>`;
        }
        const embedUrl = getEmbedUrl(item.link);
        playerHTML = embedUrl 
            ? `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
            : `<div class="container"><a href="${item.link}" target="_blank" class="btn btn-primary">Assistir em Nova Aba</a></div>`;
    } else {
        // For series/animes, player is initially a placeholder, will be filled by `loadEpisode`.
        playerHTML = '<div class="player-placeholder">Selecione um episódio para assistir.</div>';
        seasonHTML = `
            <h3>Temporadas</h3>
            <div class="season-buttons">
                ${item.seasons.map((season, sIndex) => `
                    <button class="btn btn-secondary btn-season" data-season-index="${sIndex}">Temporada ${season.seasonNumber}</button>
                `).join('')}
            </div>
            <div id="episodes-container"></div>
        `;
        /* @tweakable [Styling for the next episode button] */
        nextEpisodeButtonHTML = `
            <div class="next-episode-container">
                 <button id="next-episode-btn" class="btn">Próximo Episódio</button>
            </div>
        `;
        /* @tweakable [Styling for the like section in the player footer] */
        likeSectionHTML = `
            <div class="like-section-container">
                <div class="like-section-divider"></div>
                <div class="like-section-content">
                    <span id="like-heart" class="like-heart">❤️</span>
                    <span id="like-text" class="like-text">clique aqui para curtir</span>
                </div>
                <div class="like-section-divider"></div>
            </div>
        `;
    }

    return `
        <div class="player-wrapper" id="player-wrapper">
            ${playerHTML}
        </div>
        <div class="player-info-container container">
            <h2 style="font-weight: bold; font-size: 24px; margin: 10px 0;">${item.name}</h2>
            <p style="margin: 5px 0;">Ano de Lançamento: ${item.releaseYear || 'Não informado'}</p>
            <div class="favorite-button-wrapper-player">
                <button 
                    class="favorite-btn-player ${isCurrentlyFavorited ? 'favorited' : ''}" 
                    data-id="${item.id}"
                    onclick="toggleFavorite('${item.id}', this)">
                    <span class="fav-icon">${isCurrentlyFavorited ? '❤️' : '🤍'}</span>
                    <span id="favoriteText_${item.id}">${isCurrentlyFavorited ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}</span>
                </button>
            </div>
            <p>${item.description}</p>
            ${seasonHTML}
            ${nextEpisodeButtonHTML}
            ${likeSectionHTML}
        </div>
    `;
}

export function renderPlayerPage(container) {
    if (!session?.username) {
        window.location.hash = '#login';
        return;
    }
    showToast("Carregando player...");

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const itemId = urlParams.get('id');

    if (!itemId) {
        window.location.hash = '#/cliente/filmes';
        showToast("ID do item não encontrado.", "error");
        return;
    }

    const db = getDB();
    const allMedia = [
        ...(db.movies || []),
        ...(db.series || []),
        ...(db.animes || [])
    ];
    const item = allMedia.find(m => m.id === itemId);

    if (!item) {
        window.location.hash = '#/cliente/filmes';
        showToast("Item não encontrado.", "error");
        return;
    }

    // Set module-level item for other functions to access
    currentItem = item;
    
    // Determine the active link for the header
    let activeLink = 'filmes';
    if(item.id.startsWith('series')) activeLink = 'series';
    if(item.id.startsWith('anime')) activeLink = 'animes';

    container.innerHTML = `
        ${renderHeader(activeLink, item)}
        <main class="page player-page">
            ${renderItemContent(item)}
        </main>
        <div id="menu-overlay"></div>
        <div id="slide-in-menu">
            <a href="#/cliente/favoritos">Favoritos</a>
            <a href="#/cliente/historico">Histórico</a>
            <a href="#/cliente/perfil">Perfil</a>
            <a href="#/cliente/configuracoes-usuario">Configurações</a>
            <button id="slide-menu-logout-btn">Sair</button>
        </div>
    `;
    
    addToHistory(item);
    attachPlayerListeners(item, container);
    if(item.id.startsWith('series') || item.id.startsWith('anime')) {
        updateLikeSection();
    }
}