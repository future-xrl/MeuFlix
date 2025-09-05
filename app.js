import { initDB, getDB, saveDB } from 'db';
import { renderLogin } from 'views/Login';
import { renderAdminPanel } from 'views/Admin';
import { renderClientPanel } from 'views/Client';
import { renderProfilePage } from 'views/client/Profile';
import { renderUserSettingsPage } from 'views/client/UserSettings';
import { renderFavoritesPage } from 'views/client/Favorites';
import { renderHistoryPage } from 'views/client/History';
import { renderPlayerPage } from 'views/client/Player';
import { showToast } from 'utils';

const app = document.getElementById('app');

/** @tweakable [The color of the heart icon when an item is favorited] */
const FAVORITED_COLOR = '#ff0000';
/** @tweakable [The color of the heart icon when an item is not favorited] */
const NOT_FAVORITED_COLOR = '#ccc';

function handleToggleFavoriteEvent(event) {
    const { itemId } = event.detail;
    console.log(`Toggling favorite for item: ${itemId}`);
    const session = JSON.parse(localStorage.getItem('session'));
    if (!session?.username) {
        showToast("Faça login para adicionar aos favoritos!", "error");
        window.location.hash = '#login';
        return;
    }

    const username = session.username;
    const db = getDB();
    
    let user;
    let userListKey;
    let userIndex;

    const clientIndex = db.users.clients.findIndex(c => c.username === username);
    if (clientIndex !== -1) {
        user = db.users.clients[clientIndex];
        userListKey = 'clients';
        userIndex = clientIndex;
    } else {
        const testIndex = (db.users.tests || []).findIndex(t => t.username === username);
        if (testIndex !== -1) {
            user = db.users.tests[testIndex];
            userListKey = 'tests';
            userIndex = testIndex;
        }
    }
    
    console.log('UserID:', username);

    if (!user) {
        showToast("Usuário não encontrado.", "error");
        return;
    }
    
    user.favorites = user.favorites || [];
    const itemIndex = user.favorites.indexOf(itemId);
    const isFavorited = itemIndex > -1;

    if (isFavorited) {
        user.favorites.splice(itemIndex, 1);
        showToast('Removido dos Favoritos!');
    } else {
        user.favorites.push(itemId);
        showToast('Adicionado aos Favoritos!');
    }

    db.users[userListKey][userIndex] = user;
    saveDB(db);
    console.log('Favoritos atualizados:', user.favorites);

    // Update UI for the icon and text
    const icon = document.getElementById(`favoriteIcon_${itemId}`);
    const text = document.getElementById(`favoriteText_${itemId}`);
    const isNowFavorited = !isFavorited;

    if (icon) {
        icon.style.color = isNowFavorited ? FAVORITED_COLOR : NOT_FAVORITED_COLOR;
        icon.classList.toggle('fa-solid', isNowFavorited);
        icon.classList.toggle('fa-regular', !isNowFavorited);
    }
    if (text) {
        text.textContent = isNowFavorited ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos';
    }

    // Update header icon if it exists
    const headerFavIcon = document.getElementById('header-fav-icon');
    if (headerFavIcon && headerFavIcon.dataset.id === itemId) {
        headerFavIcon.classList.toggle('favorited', isNowFavorited);
    }
};

function handleDeleteItemEvent(event) {
    const { itemId, itemType } = event.detail;
    const session = JSON.parse(localStorage.getItem('session'));

    if (session?.role !== 'admin') {
        showToast("Acesso negado.", "error");
        return;
    }

    if (!confirm("Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.")) {
        return;
    }

    const db = getDB();

    if (!db[itemType] || !Array.isArray(db[itemType])) {
        showToast(`Falha ao excluir o item. Categoria '${itemType}' inválida.`, "error");
        return;
    }

    const itemIndex = db[itemType].findIndex(item => item.id === itemId);

    if (itemIndex > -1) {
        db[itemType].splice(itemIndex, 1);
        saveDB(db);
        showToast("Item excluído com sucesso!");
        console.log('Item excluído:', itemId, 'DB atualizado:', db);
        
        // Re-render the current admin page to reflect the change
        router();

    } else {
        showToast("Falha ao excluir o item. Tente novamente.", "error");
        console.error(`Item with id ${itemId} not found in ${itemType}`);
    }
}

async function handleEditItemEvent(event) {
    const { itemId, itemType } = event.detail;
    const session = JSON.parse(localStorage.getItem('session'));

    if (session?.role !== 'admin') {
        showToast("Acesso negado.", "error");
        return;
    }
    const db = getDB();

    if (itemType === 'movies') {
        const { renderAddMoviePage } = await import('views/admin/AddMovie');
        const movieToEdit = db.movies.find(i => i.id === itemId);
        renderAddMoviePage(document.getElementById('app'), movieToEdit);
    } else if (itemType === 'series') {
        const { renderAddSeriesPage } = await import('views/admin/AddSeries');
        const seriesToEdit = db.series.find(i => i.id === itemId);
        renderAddSeriesPage(document.getElementById('app'), seriesToEdit);
    } else if (itemType === 'animes') {
        const { renderAddAnimePage } = await import('views/admin/AddAnime');
        const animeToEdit = db.animes.find(i => i.id === itemId);
        renderAddAnimePage(document.getElementById('app'), animeToEdit);
    }
}

export function navigate(path) {
    window.location.hash = path;
}

function router() {
    const path = window.location.hash.slice(1) || '/login';
    app.innerHTML = '';
    
    const session = JSON.parse(localStorage.getItem('session'));

    if (path.startsWith('/admin') && session?.role === 'admin') {
        renderAdminPanel(app, path);
    } else if (path.startsWith('/cliente') && session?.role === 'client') {
        if (path.startsWith('/cliente/perfil')) {
            renderProfilePage(app);
        } else if (path.startsWith('/cliente/configuracoes-usuario')) {
            renderUserSettingsPage(app);
        } else if (path.startsWith('/cliente/favoritos')) {
            renderFavoritesPage(app);
        } else if (path.startsWith('/cliente/historico')) {
            renderHistoryPage(app);
        } else {
            renderClientPanel(app, path);
        }
    } else if (path.startsWith('/player') && session?.role === 'client') {
        renderPlayerPage(app);
    } else {
        // Prevent redirect loop if session is stale but hash is for a protected route
        if (session && (path.startsWith('/admin') || path.startsWith('/cliente') || path.startsWith('/player'))) {
            localStorage.removeItem('session');
            navigate('/login');
            router();
            return;
        }
        renderLogin(app);
    }
}

function handleLogout() {
    localStorage.removeItem('session');
    navigate('/login');
}

async function runSplashAnimation() {
    const splashScreen = document.getElementById('splash-screen');
    if (!splashScreen) return;
    
    // Skip animation if already shown in this session
    if (sessionStorage.getItem('splashShown')) {
        splashScreen.style.display = 'none';
        return;
    }

    const logoM = splashScreen.querySelector('.logo-m');
    
    /** @tweakable [Animation durations for the Netflix-style intro on desktop] */
    const INTRO_DURATIONS_DESKTOP = { fadeIn: 1200, grow: 2500, fadeOut: 1200 };
    /** @tweakable [Animation durations for the Netflix-style intro on mobile] */
    const INTRO_DURATIONS_MOBILE = { fadeIn: 600, grow: 1250, fadeOut: 600 };
    
    const isMobile = window.innerWidth <= 768;
    const durations = isMobile ? INTRO_DURATIONS_MOBILE : INTRO_DURATIONS_DESKTOP;
    const totalDuration = durations.fadeIn + durations.grow + durations.fadeOut;

    // Responsive adjustments via JS if needed, e.g., for font size
    if (isMobile) {
        logoM.style.fontSize = '125px'; // Initial mobile size
        const keyframesGrow = `
            @keyframes grow {
                from { font-size: 125px; transform: translate(-50%, -50%) scale(1.1); filter: brightness(1.2) saturate(1.5); }
                to { font-size: 300px; transform: translate(-50%, -50%) scale(1.5); filter: brightness(1.5) saturate(2) blur(3px); }
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.innerText = keyframesGrow;
        document.head.appendChild(styleSheet);
    }

    let audioContext, whooshBuffer;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch('whoosh.mp3');
        const arrayBuffer = await response.arrayBuffer();
        whooshBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.warn("Could not initialize Web Audio.", e);
    }

    const playSound = (buffer) => {
        if (!audioContext || !buffer) return;
        if (audioContext.state === 'suspended') audioContext.resume();
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
    };
    
    // Animation sequence
    return new Promise(resolve => {
        console.log("Animação Netflix clone: fade-in");
        logoM.classList.add('fade-in');
        playSound(whooshBuffer);

        setTimeout(() => {
            console.log("Animação Netflix clone: grow");
            logoM.classList.remove('fade-in');
            logoM.classList.add('grow');
            
            setTimeout(() => {
                console.log("Animação Netflix clone: fade-out");
                logoM.classList.remove('grow');
                logoM.classList.add('fade-out');
                
                setTimeout(() => {
                    console.log("Animação Netflix clone: finished");
                    splashScreen.style.opacity = '0';
                    splashScreen.addEventListener('transitionend', () => {
                        splashScreen.style.display = 'none';
                    });
                    sessionStorage.setItem('splashShown', 'true');
                    resolve();
                }, durations.fadeOut);

            }, durations.grow);

        }, durations.fadeIn);
    });
}

document.addEventListener('logout', handleLogout);
document.addEventListener('toggleFavorite', handleToggleFavoriteEvent);
document.addEventListener('deleteItem', handleDeleteItemEvent);
document.addEventListener('editItem', handleEditItemEvent);

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', async () => {
    // Show a loading indicator
    document.getElementById('app').innerHTML = '<div class="loading-spinner">Carregando...</div>';
    
    // Run animation first, then the rest of the app
    await runSplashAnimation();

    await initDB();
    router();
});