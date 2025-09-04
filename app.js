import { initDB, getDB, saveDB } from 'db';
import { renderLogin } from 'views/Login';
import { renderAdminPanel } from 'views/Admin';
import { renderClientPanel } from 'views/Client';
import { renderProfilePage } from 'views/client/Profile';
import { renderSettingsPage } from 'views/client/Settings';
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

    userIndex = db.users.clients.findIndex(c => c.username === username);
    if (userIndex !== -1) {
        user = db.users.clients[userIndex];
        userListKey = 'clients';
    } else {
        userIndex = (db.users.tests || []).findIndex(t => t.username === username);
        if (userIndex !== -1) {
            user = db.users.tests[userIndex];
            userListKey = 'tests';
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
        } else if (path.startsWith('/cliente/configuracoes')) {
            renderSettingsPage(app);
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

document.addEventListener('logout', handleLogout);
document.addEventListener('toggleFavorite', handleToggleFavoriteEvent);

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', async () => {
    // Show a loading indicator
    document.getElementById('app').innerHTML = '<div class="loading-spinner">Carregando...</div>';
    await initDB();
    router();
});