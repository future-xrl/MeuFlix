import { renderHeader } from 'views/Client';
import { showToast } from 'utils';
import { setLanguage, getLanguage, t } from 'i18n';

function handleLanguageChange(e) {
    const newLang = e.target.value;
    console.log("Linguagem do cliente:", newLang);
    setLanguage(newLang);
    showToast(t('language_changed_success'));
    
    setTimeout(() => {
        window.location.hash = '#/cliente/configuracoes-usuario';
        window.location.reload();
    }, 500);
}

function attachUserSettingsListeners() {
    const langSelect = document.getElementById('client-language-select');
    if (langSelect) {
        langSelect.addEventListener('change', handleLanguageChange);
    }

    const historyBtn = document.getElementById('history-btn-settings');
    if (historyBtn) {
        historyBtn.onclick = () => {
            console.log("Navegação Histórico iniciada");
            window.location.hash = '#/cliente/historico';
        };
    }
}

export function renderUserSettingsPage(container) {
    const currentLang = getLanguage();
    const content = `
        <div class="container" id="configUserContent">
            <h2>${t('user_settings')}</h2>
            
            <div class="settings-section">
                <button id="history-btn-settings" class="btn btn-secondary">${t('history')}</button>
            </div>

            <div class="settings-section">
                <div class="form-group">
                    <label for="client-language-select">${t('change_language')}</label>
                    <select id="client-language-select" class="form-control">
                        <option value="pt-BR" ${currentLang === 'pt-BR' ? 'selected' : ''}>Português Brasil</option>
                        <option value="en" ${currentLang === 'en' ? 'selected' : ''}>Inglês</option>
                        <option value="zh-CN" ${currentLang === 'zh-CN' ? 'selected' : ''}>Chinês Simplificado</option>
                        <option value="es" ${currentLang === 'es' ? 'selected' : ''}>Espanhol</option>
                        <option value="pt-PT" ${currentLang === 'pt-PT' ? 'selected' : ''}>Português de Portugal</option>
                    </select>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = `
        ${renderHeader('configuracoes-usuario')}
        <main class="page">
            ${content}
        </main>
    `;

    attachUserSettingsListeners();
}