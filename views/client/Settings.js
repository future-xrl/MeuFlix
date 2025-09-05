import { renderHeader } from 'views/Client';

export function renderSettingsPage(container) {
    container.innerHTML = `
        ${renderHeader('configuracoes')}
        <main class="page">
            <div class="container">
                <h1>Configurações</h1>
                <p>Esta página está em construção.</p>
                <button id="back-to-catalog-btn" class="btn btn-primary">Voltar ao Catálogo</button>
            </div>
        </main>
    `;

    document.getElementById('back-to-catalog-btn').onclick = () => {
        window.location.hash = '#/cliente/filmes';
    };
}

