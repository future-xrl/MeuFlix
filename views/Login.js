import { getDB } from 'db';
import { navigate } from 'app';
import { showToast } from 'utils';

async function getCurrentIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error("Não foi possível obter o IP:", error);
        return null;
    }
}

function isIpBlocked(ip) {
    const blockedIPs = JSON.parse(localStorage.getItem('blockedIPs') || '[]');
    return blockedIPs.includes(ip);
}

function blockIp(ip) {
    if (!ip) return;
    const blockedIPs = JSON.parse(localStorage.getItem('blockedIPs') || '[]');
    if (!blockedIPs.includes(ip)) {
        blockedIPs.push(ip);
        localStorage.setItem('blockedIPs', JSON.stringify(blockedIPs));
        console.log(`IP bloqueado: ${ip}`);
    }
}

export async function renderLogin(container) {
    const currentIp = await getCurrentIP();
    if (currentIp && isIpBlocked(currentIp)) {
        container.innerHTML = `
            <div class="login-container">
                <div class="login-form">
                    <div class="logo"><span>M</span>euFlix</div>
                    <h2 style="text-align:center; color: var(--error-color);">Acesso Bloqueado</h2>
                    <p style="text-align:center; color: var(--text-muted-color);">Muitas tentativas de login falharam. Por segurança, seu acesso foi temporariamente bloqueado.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="login-container">
            <div id="login-step" class="login-form">
                <div class="logo"><span>M</span>euFlix</div>
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
            <div id="security-step" class="login-form" style="display:none;">
                 <div class="logo"><span>M</span>euFlix</div>
                 <h2 style="text-align:center; margin-bottom: 1rem;">Verificação de Segurança</h2>
                <form id="security-form">
                    <div class="form-group">
                        <label for="login-security-username">Qual é seu nome de usuário principal que termina com o número 7?</label>
                        <input type="text" id="login-security-username" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="login-security-birthday">Qual a sua data de aniversário?</label>
                        <input type="date" id="login-security-birthday" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Verificar</button>
                </form>
            </div>
        </div>
    `;

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const securityForm = document.getElementById('security-form');
    if (securityForm) {
        securityForm.addEventListener('submit', handleSecurityVerification);
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
        const adminUser = db.users.admin;
        if (username === 'admin' && password === adminUser.password) {
            // Check if security questions are set up
            if (adminUser.security && adminUser.security.username && adminUser.security.birthday) {
                // Proceed to security check step
                document.getElementById('login-step').style.display = 'none';
                document.getElementById('security-step').style.display = 'block';
            } else {
                // Log in directly if no security questions are set
                localStorage.setItem('session', JSON.stringify({ username: 'admin', role: 'admin' }));
                navigate('/admin');
            }
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

async function handleSecurityVerification(e) {
    e.preventDefault();
    const usernameAnswer = document.getElementById('login-security-username').value.trim();
    const birthdayAnswer = document.getElementById('login-security-birthday').value;

    const db = getDB();
    const correctAnswers = db.users.admin.security;

    if (correctAnswers && usernameAnswer === correctAnswers.username && birthdayAnswer === correctAnswers.birthday) {
        showToast('Verificação bem-sucedida!');
        localStorage.setItem('session', JSON.stringify({ username: 'admin', role: 'admin' }));
        const currentIp = await getCurrentIP();
        if (currentIp) {
            localStorage.setItem('lastIP', currentIp);
        }
        navigate('/admin');
    } else {
        showToast("Respostas de segurança incorretas. Acesso bloqueado.", 'error');
        const currentIp = await getCurrentIP();
        blockIp(currentIp);
        // Reload the page to show the blocked message
        setTimeout(() => window.location.reload(), 1000);
    }
}