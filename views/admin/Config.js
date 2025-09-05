import { renderLayout } from 'views/admin/Layout';
import { showToast } from 'utils';
import { setLanguage, getLanguage, t } from 'i18n';
import { getDB, saveDB } from 'db';

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

function handleSaveSecurityQuestions() {
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

    const db = getDB();
    db.users.admin.security = {
        username,
        birthday
    };
    saveDB(db);
    showToast('Perguntas de segurança salvas com sucesso!');
    console.log("Respostas salvas", db.users.admin.security);
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
}