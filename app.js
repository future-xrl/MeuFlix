import { initDB } from 'db';
import { renderLogin } from 'views/Login';
import { renderAdminPanel } from 'views/Admin';
import { renderClientPanel } from 'views/Client';

const app = document.getElementById('app');

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
        renderClientPanel(app, path);
    } else {
        if (session) {
            // If logged in but on wrong page, redirect
            const newPath = session.role === 'admin' ? '/admin' : '/cliente';
            navigate(newPath);
        } else {
            renderLogin(app);
        }
    }
}

function handleLogout() {
    localStorage.removeItem('session');
    navigate('/login');
}

document.addEventListener('logout', handleLogout);

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
    initDB();
    router();
});

