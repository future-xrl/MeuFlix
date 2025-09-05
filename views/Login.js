import { getDB } from 'db';
import { navigate } from 'app';
import { showToast } from 'utils';

export function renderLogin(container) {
    container.innerHTML = `
        <div class="login-container">
            <div class="login-form">
                <h1 class="logo">Meuflix</h1>
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
    if (form) {
        form.addEventListener('submit', handleLogin);
    } else {
        console.warn('Element #login-form not found on login page.');
    }
    
    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const passwordInput = document.getElementById('password');
            const icon = togglePassword.querySelector('i');
            if (passwordInput && icon) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        });
    } else {
        console.warn('Element #toggle-password not found on login page.');
    }
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

    // Client/Test login attempt
    if (/^\d{5}$/.test(username)) {
        // Check clients first
        const client = db.users.clients.find(c => c.username === username && c.password === password);
        if (client) {
            const isExpired = new Date(client.expiresAt) < new Date();
            if (client.status === 'ativo' && !isExpired) {
                localStorage.setItem('session', JSON.stringify({ username: client.username, role: 'client' }));
                navigate('/cliente');
            } else {
                showToast("Sua conta está expirada ou inválida.", 'error');
            }
            return;
        }

        // Check tests if not found in clients
        const testUser = db.users.tests.find(t => t.username === username && t.password === password);
        if (testUser) {
            const isExpired = new Date(testUser.expiresAt) < new Date();
             if (testUser.status === 'bloqueado') {
                showToast("Esta conta de teste foi bloqueada.", 'error');
            } else if (testUser.status === 'ativo' && !isExpired) {
                localStorage.setItem('session', JSON.stringify({ username: testUser.username, role: 'client' }));
                navigate('/cliente');
            } else {
                showToast("Sua conta de teste está expirada ou inválida.", 'error');
            }
            return;
        }

        showToast("Credenciais inválidas ou expiradas.", 'error');
        return;
    }

    showToast("Formato de usuário inválido.", 'error');
}