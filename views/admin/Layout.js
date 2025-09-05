import { showToast, publishToGitHub, safeAddEventListener } from 'utils';
import { t } from 'i18n';

async function handleFixedPublishClick() {
    const token = localStorage.getItem('githubToken');
    if (!token) {
        showToast('Token não encontrado. Vá para a página de Backup para configurar.', 'error');
        return;
    }
    try {
        await publishToGitHub(token);
        showToast('Banco de dados publicado com sucesso no GitHub!');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderAdminTopMenu() {
    const path = window.location.hash;
    return `
        <div id="admin-top-menu">
            <button class="btn ${path.includes('gerar-teste') ? 'active' : ''}" onclick="adminNavigateTo('#/admin/gerar-teste')">${t('generate_test')}</button>
            <button class="btn ${path.includes('meus-testes') ? 'active' : ''}" onclick="adminNavigateTo('#/admin/meus-testes')">${t('my_tests')}</button>
            <button class="btn ${path.includes('gerenciar-clientes') ? 'active' : ''}" onclick="adminNavigateTo('#/admin/gerenciar-clientes')">${t('manage_clients')}</button>
            <button class="btn ${path.includes('configuracoes') ? 'active' : ''}" onclick="adminNavigateTo('#/admin/configuracoes')">${t('config')}</button>
        </div>
    `;
}

function attachLayoutListeners() {
    safeAddEventListener('#logout-btn-fixed', 'click', () => {
        document.dispatchEvent(new CustomEvent('logout'));
    });

    safeAddEventListener('#publish-btn-fixed', 'click', handleFixedPublishClick);

    const sidebar = document.getElementById('admin-sidebar');
    const toggleBtn = document.getElementById('mobile-menu-toggle');

    if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });

        document.body.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }, true); // Use capture phase
    } else {
        console.warn('Sidebar or mobile toggle button not found. Mobile menu may not work.');
    }

    console.log('Layout listeners attached successfully for page:', window.location.hash);
}

export function renderLayout(container, content, pageTitle) {
    const path = window.location.hash.slice(1);
    const managementPages = ['painel', 'gerar-teste', 'meus-testes', 'gerenciar-clientes', 'configuracoes'];
    const showTopMenu = managementPages.some(p => path.includes(p));

    container.innerHTML = `
        <div class="main-layout">
            <aside class="sidebar" id="admin-sidebar">
                <h2>Admin</h2>
                <nav>
                    <ul>
                        <li><a href="#/admin/painel" class="${path.includes('painel') ? 'active' : ''}">${t('dashboard')}</a></li>
                        <li><a href="#/admin/adicionar-filme" class="${path.includes('adicionar-filme') ? 'active' : ''}">${t('add_movie')}</a></li>
                        <li><a href="#/admin/adicionar-serie" class="${path.includes('adicionar-serie') ? 'active' : ''}">${t('add_series')}</a></li>
                        <li><a href="#/admin/adicionar-anime" class="${path.includes('adicionar-anime') ? 'active' : ''}">${t('add_animes')}</a></li>
                        <li><a href="#/admin/backup" class="${path.includes('backup') ? 'active' : ''}">${t('backup_restore')}</a></li>
                        <li><a href="#/admin/debug" class="${path.includes('debug') ? 'active' : ''}">${t('debug')}</a></li>
                    </ul>
                </nav>
            </aside>
            <main class="main-content">
                <div class="fixed-header-buttons">
                    <button id="publish-btn-fixed" class="btn btn-sm">${t('publish')}</button>
                    <button id="logout-btn-fixed" class="btn btn-secondary btn-sm">${t('logout')}</button>
                </div>
                <header class="main-header">
                   <div id="admin-header-content">
                     <button id="mobile-menu-toggle"><i class="fa-solid fa-bars"></i></button>
                     <h1>${pageTitle}</h1>
                   </div>
                </header>
                <div id="admin-page-content">
                    ${showTopMenu ? renderAdminTopMenu() : ''}
                    ${content}
                </div>
            </main>
        </div>
    `;

    // Attach listeners after the DOM is updated
    attachLayoutListeners();
    showToast("Layout carregado com sucesso!");
    console.log('Layout rendered successfully on page:', window.location.hash);
}