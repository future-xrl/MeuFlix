import { getDB } from 'db';
import { navigate } from 'app';
import { showToast } from 'utils';

export function renderLogin(container) {
    container.innerHTML = `
        <div class="login-container">
            <div class="login-form">
                <h1>🎬 CinemaStream</h1>
                <form id="login-form">
                    <div class="form-group">
                        <label for="username">Usuário</label>
                        <input type="text" id="username" class="form-control" required minlength="5" maxlength="50">
                    </div>
                    <div class="form-group">
                        <label for="password">Senha</label>
                        <div class="password-wrapper">
                            <input type="password" id="password" class="form-control" required minlength="5" maxlength="8">
                             <button type="button" class="password-toggle" id="toggle-password">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Entrar</button>
                </form>
            </div>
        </div>
    `;

    const form = document.getElementById('login-form');
    form.addEventListener('submit', handleLogin);
    
    const togglePassword = document.getElementById('toggle-password');
    togglePassword.addEventListener('click', () => {
        const passwordInput = document.getElementById('password');
        const icon = togglePassword.querySelector('i');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
}

function handleLogin(e) {
    e.preventDefault();
    const username = e.target.elements.username.value.trim();
    const password = e.target.elements.password.value;
    const db = getDB();

    // Admin login attempt
    if (/[a-zA-Z]/.test(username)) {
        if (username === 'admin' && password === db.users.admin.password) {
            localStorage.setItem('session', JSON.stringify({ username: 'admin', role: 'admin' }));
            navigate('/admin');
        } else {
            showToast("Credenciais de administrador inválidas.", 'error');
        }
        return;
    }

    // Client login attempt
    if (/^\d{5}$/.test(username)) {
        const client = db.users.clients.find(c => c.username === username && c.password === password);
        if (client) {
            const isExpired = new Date(client.expiresAt) < new Date();
            if (client.status === 'válido' && !isExpired) {
                localStorage.setItem('session', JSON.stringify({ username: client.username, role: 'client' }));
                navigate('/cliente');
            } else {
                showToast("Sua conta está expirada ou inválida.", 'error');
            }
        } else {
            showToast("Credenciais inválidas ou expiradas.", 'error');
        }
        return;
    }

    showToast("Formato de usuário inválido.", 'error');
}

