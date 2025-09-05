import { getDB, saveDB } from 'db';
import { renderHeader } from 'views/Client';
import { getEmbedUrl, showToast } from 'utils';

const session = JSON.parse(localStorage.getItem('session'));

/** @tweakable [The maximum number of items to keep in the watch history] */
const MAX_HISTORY_ITEMS = 20;

/** @tweakable [The color of the heart icon when an item is favorited] */
const FAVORITED_COLOR = 'red';
/** @tweakable [The color of the heart icon when an item is not favorited] */
const NOT_FAVORITED_COLOR = 'grey';

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

function updateFavoriteButtonState(button, isFavorited) {
    const icon = button.querySelector('i');
    const text = button.querySelector('span');

    button.classList.toggle('favorited', isFavorited);
    if (icon) {
        icon.classList.toggle('fa-solid', isFavorited);
        icon.classList.toggle('fa-regular', !isFavorited);
        icon.style.color = isFavorited ? FAVORITED_COLOR : NOT_FAVORITED_COLOR;
    }
    if (text) {
        text.textContent = isFavorited ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos';
    }
}

async function handleToggleFavorite(itemId, button) {
    const db = getDB();
    const clientIndex = db.users.clients.findIndex(c => c.username === session.username);
    if (clientIndex === -1) return;

    const client = db.users.clients[clientIndex];
    client.favorites = client.favorites || [];
    const itemIndex = client.favorites.indexOf(itemId);
    const isCurrentlyFavorited = itemIndex > -1;

    let isNowFavorited;

    if (isCurrentlyFavorited) {
        client.favorites.splice(itemIndex, 1); // Unfavorite
        showToast('Removido dos Favoritos!');
        isNowFavorited = false;
    } else {
        client.favorites.push(itemId); // Favorite
        showToast('Adicionado aos Favoritos!');
        isNowFavorited = true;
    }
    
    db.users.clients[clientIndex] = client;
    saveDB(db);

    console.log('Favorites updated:', client.favorites);

    // Update the button state directly instead of re-rendering
    if (button) {
       updateFavoriteButtonState(button, isNowFavorited);
    }

    // Also update the header icon if it exists
    const headerFavIcon = document.getElementById('header-fav-icon');
    if (headerFavIcon && headerFavIcon.dataset.id === itemId) {
        headerFavIcon.classList.toggle('favorited', isNowFavorited);
    }
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
    document.querySelectorAll('.favorite-btn-player').forEach(button => {
        button.addEventListener('click', async (e) => {
            const currentButton = e.currentTarget;
            await handleToggleFavorite(item.id, currentButton);
        });
    });

    const headerFavIcon = document.getElementById('header-fav-icon');
    if(headerFavIcon) {
        const favDropdown = document.getElementById('header-fav-dropdown');
        headerFavIcon.addEventListener('click', async () => {
            // Use the global toggle function
            window.toggleFavorite(item.id);
            
            if (favDropdown) {
                const isNowFavorited = headerFavIcon.classList.contains('favorited');
                favDropdown.innerHTML = isNowFavorited 
                    ? 'Adicionado aos Favoritos! <a href="#/cliente/favoritos">Ver lista</a>'
                    : 'Removido dos Favoritos!';
                favDropdown.classList.add('show');
                setTimeout(() => favDropdown.classList.remove('show'), 2000);
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
                const currentItem = (item.id.startsWith('series') ? db.series : db.animes).find(s => s.id === item.id);
                const season = currentItem.seasons.find(s => s.seasonNumber === seasonNumber);
                
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

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('logout'));
    });
    
    document.getElementById('slide-menu-logout-btn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('logout'));
    });
}

function renderItemContent(item) {
    const isCurrentlyFavorited = isFavorited(item.id);
    const itemType = item.id.startsWith('movie') ? 'filme' : (item.id.startsWith('series') ? 'serie' : 'anime');

    let playerHTML = '';
    let seasonHTML = '';
    
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
        // For series/animes, player is initially empty.
        playerHTML = '<div class="player-placeholder">Selecione um episódio para assistir.</div>';
        seasonHTML = `
            <h3>Temporadas</h3>
            <div class="season-buttons">
                ${item.seasons.map(season => `
                    <button class="btn btn-secondary btn-season" data-season="${season.seasonNumber}">Temporada ${season.seasonNumber}</button>
                `).join('')}
            </div>
            <div id="episodes-container"></div>
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
                    onclick="toggleFavorite('${item.id}')">
                    <i id="favoriteIcon_${item.id}" class="fa-${isCurrentlyFavorited ? 'solid' : 'regular'} fa-heart" style="color: ${isCurrentlyFavorited ? FAVORITED_COLOR : NOT_FAVORITED_COLOR};"></i>
                    <span id="favoriteText_${item.id}" style="margin-left: 5px;">${isCurrentlyFavorited ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}</span>
                </button>
            </div>
            <p>${item.description}</p>
            ${seasonHTML}
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
            <a href="#/cliente/configuracoes">Configurações</a>
            <button id="slide-menu-logout-btn">Sair</button>
        </div>
    `;
    
    addToHistory(item);
    attachPlayerListeners(item, container);
}