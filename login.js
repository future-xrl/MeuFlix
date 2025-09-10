import * as db from './db.js';

const room = new WebsimSocket();

const checkCode = async (codeValue) => {
    const codes = await room.collection('codes').filter({ code: codeValue }).getList();
    if (codes.length === 0) return false;
    
    const foundCode = codes[0];
    const now = new Date().getTime();
    return now < foundCode.expiresAt;
};

const showAlert = (message) => {
    const alertBackdrop = document.getElementById('custom-alert');
    const alertMessage = document.getElementById('custom-alert-message');
    const alertOkBtn = document.getElementById('custom-alert-ok');

    alertMessage.innerHTML = message; // Use innerHTML to render the link
    alertBackdrop.classList.remove('hidden');

    const closeAlert = () => alertBackdrop.classList.add('hidden');
    
    // Remove previous listener to avoid multiple bindings
    const newOkBtn = alertOkBtn.cloneNode(true);
    alertOkBtn.parentNode.replaceChild(newOkBtn, alertOkBtn);
    
    newOkBtn.addEventListener('click', closeAlert);
};

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    const codeInput = document.getElementById('code-input');
    const errorMessage = document.getElementById('error-message');

    // Check if user is already logged in
    const loggedInCode = localStorage.getItem('loggedInCode');
    if (loggedInCode) {
        if (await checkCode(loggedInCode)) {
            window.location.href = '/home.html';
            return;
        } else {
            localStorage.removeItem('loggedInCode'); // Clean up invalid code
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = codeInput.value.trim();
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Verificando...';

        try {
            const isValid = await checkCode(code);
            if (isValid) {
                localStorage.setItem('loggedInCode', code);
                window.location.href = '/home.html';
            } else {
                const contactMessage = `Código inválido ou expirado.<br><br>Acesse esse site e entre em contato com um de nossos atendentes pelo Whatsapp para pedir um código de acesso: <a href="https://linktr.ee/Play_Filmes" target="_blank">linktr.ee/Play_Filmes</a>`;
                showAlert(contactMessage);
                errorMessage.textContent = ''; // Clear old error message
                codeInput.focus();
            }
        } catch (error) {
            console.error("Error checking code:", error);
            errorMessage.textContent = 'Erro ao verificar o código. Tente novamente.';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Entrar';
        }
    });
});