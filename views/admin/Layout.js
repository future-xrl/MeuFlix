import { showToast, publishToGitHub } from 'utils';

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

export function renderLayout(container, content, pageTitle) {
    const path = window.location.hash.slice(1);
    container.innerHTML = `
        <div class="main-layout">
            <aside class="sidebar" id="admin-sidebar">
                <h2>Admin</h2>
                <nav>
                    <ul>
                        <li><a href="#/admin/painel" class="${path.includes('painel') ? 'active' : ''}">Painel</a></li>
                        <li><a href="#/admin/gerar-teste" class="${path.includes('gerar-teste') ? 'active' : ''}">Gerar Teste</a></li>
                        <li><a href="#/admin/meus-testes" class="${path.includes('meus-testes') ? 'active' : ''}">Meus Testes</a></li>
                        <li><a href="#/admin/gerenciar-clientes" class="${path.includes('gerenciar-clientes') ? 'active' : ''}">Gerenciar Clientes</a></li>
                        <li><a href="#/admin/adicionar-filme" class="${path.includes('adicionar-filme') ? 'active' : ''}">Adicionar Filme</a></li>
                        <li><a href="#/admin/adicionar-serie" class="${path.includes('adicionar-serie') ? 'active' : ''}">Adicionar Série</a></li>
                        <li><a href="#/admin/adicionar-anime" class="${path.includes('adicionar-anime') ? 'active' : ''}">Adicionar Animes</a></li>
                        <li><a href="#/admin/backup" class="${path.includes('backup') ? 'active' : ''}">Backup/Restaurar</a></li>
                    </ul>
                </nav>
            </aside>
            <main class="main-content">
                <div class="fixed-header-buttons">
                    <button id="publish-btn-fixed" class="btn btn-sm">Publicar</button>
                    <button id="logout-btn-fixed" class="btn btn-secondary btn-sm">Sair</button>
                </div>
                <header class="main-header">
                   <div id="admin-header-content">
                     <button id="mobile-menu-toggle"><i class="fa-solid fa-bars"></i></button>
                     <h1>${pageTitle}</h1>
                   </div>
                </header>
                <div id="admin-page-content">
                    ${content}
                </div>
            </main>
        </div>
    `;
    document.getElementById('logout-btn-fixed').addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('logout'));
    });

    document.getElementById('publish-btn-fixed').addEventListener('click', handleFixedPublishClick);

    const sidebar = document.getElementById('admin-sidebar');
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
    });
    
    document.body.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    }, true); // Use capture phase to catch clicks anywhere
}