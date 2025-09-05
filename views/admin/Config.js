import { renderLayout } from 'views/admin/Layout';
import { showToast } from 'utils';
import { setLanguage, getLanguage, t } from 'i18n';
import { getDB, saveDB } from 'db';

// --- Module-level state for GitHub integration ---
let currentDBContent = null;
let currentDBSha = null;
/**
 * @tweakable [Configuration for the GitHub repository to save settings]
 */
const GITHUB_CONFIG = {
    owner: 'future-xrl',
    repo: 'MeuFlix',
    path: 'cinemaDB.json',
};
// --------------------------------------------------

function handleLanguageChange(e) {
    const newLang = e.target.value;
    console.log("Linguagem selecionada:", newLang);
    setLanguage(newLang);
    showToast(t('language_changed_success'));
    // Reload to apply changes everywhere
    setTimeout(() => {
        window.location.hash = '#/admin/configuracoes';
        window.location.reload();
    }, 500);
}

/**
 * @tweakable [Validation error messages for security questions]
 */
const SECURITY_VALIDATION_MESSAGES = {
    usernameEndsWith7: "O nome de usuário deve terminar com o número 7.",
    birthdayRequired: "A data de aniversário é obrigatória.",
};

async function loadConfigFromGitHub() {
    const token = localStorage.getItem('githubToken');
    if (!token) {
        showToast('Token do GitHub não encontrado. Configure na página de Backup.', 'error');
        document.getElementById('save-security-btn').disabled = true;
        return;
    }

    const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
    
    try {
        console.log("Carregando cinemaDB.json do GitHub...");
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
            throw new Error(`Erro ao buscar configurações: ${response.statusText}`);
        }

        const fileData = await response.json();
        currentDBSha = fileData.sha;
        // The content is base64 encoded. Decode it safely for UTF-8 characters.
        currentDBContent = JSON.parse(decodeURIComponent(escape(atob(fileData.content))));
        
        console.log("Carregado cinemaDB.json", currentDBContent);

        // Populate form
        const securitySettings = currentDBContent.users?.admin?.security || {};
        const usernameInput = document.getElementById('security-username');
        const birthdayInput = document.getElementById('security-birthday');
        if (usernameInput) usernameInput.value = securitySettings.username || '';
        if (birthdayInput) birthdayInput.value = securitySettings.birthday || '';

    } catch (error) {
        console.error('Falha ao carregar configuração do GitHub:', error);
        showToast(error.message, 'error');
        document.getElementById('save-security-btn').disabled = true;
    }
}

async function handleSaveSecurityQuestions() {
    const usernameInput = document.getElementById('security-username');
    const birthdayInput = document.getElementById('security-birthday');

    const username = usernameInput.value.trim();
    const birthday = birthdayInput.value;

    if (!username.endsWith('7')) {
        showToast(SECURITY_VALIDATION_MESSAGES.usernameEndsWith7, 'error');
        return;
    }
    if (!birthday) {
        showToast(SECURITY_VALIDATION_MESSAGES.birthdayRequired, 'error');
        return;
    }

    const token = localStorage.getItem('githubToken');
    if (!token) {
        showToast('Token do GitHub não encontrado.', 'error');
        return;
    }

    if (!currentDBContent || !currentDBSha) {
        showToast('Dados do DB não foram carregados do GitHub. Tente recarregar a página.', 'error');
        return;
    }

    // Update the local copy of the DB content
    if (!currentDBContent.users.admin.security) {
        currentDBContent.users.admin.security = {};
    }
    currentDBContent.users.admin.security.username = username;
    currentDBContent.users.admin.security.birthday = birthday;

    // Now, send it to GitHub
    const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
    const newContent = JSON.stringify(currentDBContent, null, 2);
    // Correct Base64 encoding for UTF-8 characters
    const newContentBase64 = btoa(unescape(encodeURIComponent(newContent)));


    const saveButton = document.getElementById('save-security-btn');
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando...';

    try {
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Atualização das configurações de segurança via App',
                content: newContentBase64,
                sha: currentDBSha,
            }),
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(`Erro ao salvar no GitHub: ${responseData.message || response.statusText}`);
        }
        
        // IMPORTANT: Update SHA for next save
        currentDBSha = responseData.content.sha;
        
        // Also update local storage db to be in sync
        saveDB(currentDBContent);

        showToast('Configurações salvas com sucesso no GitHub!');
        console.log("Salvamento no GitHub:", response.status, responseData);

    } catch (error) {
        console.error('Falha ao salvar no GitHub:', error);
        showToast(error.message, 'error');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar';
    }
}

function attachConfigListeners() {
    const langSelect = document.getElementById('language-select');
    if (langSelect) {
        langSelect.addEventListener('change', handleLanguageChange);
    }
    const saveSecurityBtn = document.getElementById('save-security-btn');
    if (saveSecurityBtn) {
        saveSecurityBtn.addEventListener('click', handleSaveSecurityQuestions);
    }
}

export function renderConfigPage(container) {
    const db = getDB();
    const securitySettings = db.users.admin.security || {};
    const currentLang = getLanguage();
    const content = `
        <div class="card" id="configContent">
            <h2 class="card-title">${t('settings')}</h2>
            <div class="form-group">
                <label for="language-select">${t('change_language')}</label>
                <select id="language-select" class="form-control">
                    <option value="pt-BR" ${currentLang === 'pt-BR' ? 'selected' : ''}>Português Brasil</option>
                    <option value="en" ${currentLang === 'en' ? 'selected' : ''}>Inglês</option>
                    <option value="zh-CN" ${currentLang === 'zh-CN' ? 'selected' : ''}>Chinês Simplificado</option>
                    <option value="es" ${currentLang === 'es' ? 'selected' : ''}>Espanhol</option>
                    <option value="pt-PT" ${currentLang === 'pt-PT' ? 'selected' : ''}>Português de Portugal</option>
                </select>
            </div>
        </div>
        <div class="card">
            <h2 class="card-title">Perguntas de Segurança do Administrador</h2>
             <p style="margin-bottom: 1rem; color: var(--text-muted-color);">Configure uma camada extra de segurança para o login de administrador.</p>
            <div class="form-group">
                <label for="security-username">Nome de usuário principal que termina com o número 7</label>
                <input type="text" id="security-username" class="form-control" value="${securitySettings.username || ''}">
            </div>
            <div class="form-group">
                <label for="security-birthday">Data de aniversário</label>
                <input type="date" id="security-birthday" class="form-control" value="${securitySettings.birthday || ''}">
            </div>
            <button id="save-security-btn" class="btn" style="background-color: green; color: white; width: auto;">Salvar</button>
        </div>
    `;
    renderLayout(container, content, t('settings'));
    attachConfigListeners();
    loadConfigFromGitHub();
}