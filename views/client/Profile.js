import { renderHeader } from 'views/Client';
import { t } from 'i18n';

export function renderProfilePage(container) {
    container.innerHTML = `
        ${renderHeader('perfil')}
        <main class="page">
            <div class="container">
                <h1>${t('profile')}</h1>
                <p>Esta página está em construção.</p>
                <button id="back-to-catalog-btn" class="btn btn-primary" style="margin-top: 2rem;">Voltar ao Catálogo</button>
            </div>
        </main>
    `;

    document.getElementById('back-to-catalog-btn').onclick = () => {
        window.location.hash = '#/cliente/filmes';
    };
}

