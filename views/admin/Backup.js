import { getDB, exportDB, importDB, resetDB } from 'db';
import { showToast, publishToGitHub } from 'utils';
import { renderLayout } from 'views/admin/Layout';

/* @tweakable [Configuration for the GitHub repository where the database is stored] */
const GITHUB_CONFIG = {
    owner: 'future-xrl',
    repo: 'MeuFlix',
    path: 'cinemaDB.json',
    branch: 'main'
};

async function handlePublishToGitHub() {
    const tokenInput = document.getElementById('github-token');
    const token = tokenInput.value;
    const saveToken = document.getElementById('save-token-checkbox').checked;

    if (!token) {
        showToast('Por favor, insira o token do GitHub.', 'error');
        return;
    }

    const publishBtn = document.getElementById('publish-btn');
    /* @tweakable [Text shown on the publish button while publishing is in progress] */
    publishBtn.textContent = 'Publicando...';
    publishBtn.disabled = true;
    
    try {
        await publishToGitHub(token);
        showToast('Banco de dados publicado com sucesso no GitHub!');
        if (saveToken) {
            localStorage.setItem('githubToken', token);
            showToast('Token salvo localmente.');
        } else {
             localStorage.removeItem('githubToken');
        }
    } catch (error) {
         showToast(error.message, 'error');
    } finally {
        /* @tweakable [Text shown on the publish button after the operation is complete] */
        publishBtn.textContent = 'Publicar no GitHub';
        publishBtn.disabled = false;
    }
}

export function renderBackupPage(container) {
    const savedToken = localStorage.getItem('githubToken') || '';
    const content = `
        <div class="card">
            <h2 class="card-title">Publicar Alterações no GitHub</h2>
            <p>
                Após fazer alterações (gerar clientes, adicionar filmes, etc.), publique o banco de dados diretamente no GitHub para que as mudanças fiquem disponíveis para todos os usuários.
            </p>
            <div class="form-group" style="margin-top: 1rem;">
                <label for="github-token">Token de Acesso Pessoal do GitHub</label>
                <input type="password" id="github-token" class="form-control" placeholder="Cole seu token aqui" value="${savedToken}">
                <div class="form-group" style="margin-top: 0.5rem; display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="save-token-checkbox" style="width: auto;">
                    <label for="save-token-checkbox" style="margin-bottom: 0;">Salvar token localmente</label>
                </div>
                <small style="color: var(--text-muted-color); display: block; margin-top: 0.5rem;">
                    <strong>Como gerar um token:</strong> Vá em seu perfil do GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic) > Generate new token. Dê um nome, defina uma data de expiração e selecione o escopo <code>repo</code>.
                </small>
            </div>
            <button id="publish-btn" class="btn btn-primary">Publicar no GitHub</button>
        </div>
        <div class="card">
            <h2 class="card-title">Exportar Banco de Dados (Backup Manual)</h2>
            <p>Faça o download de todos os seus dados como um arquivo JSON. Use isso como um backup local.</p>
            <button id="export-btn" class="btn btn-secondary" style="margin-top: 10px;">Exportar Banco (cinemaDB.json)</button>
        </div>
        <div class="card">
            <h2 class="card-title">Importar Banco de Dados</h2>
            <p>Substitua todos os dados atuais por um arquivo de backup.</p>
            <input type="file" id="import-file" class="form-control" accept=".json">
            <button id="import-btn" class="btn btn-secondary" style="margin-top: 10px;">Importar Banco</button>
        </div>
        <div class="card">
            <h2 class="card-title">Resetar Banco de Dados</h2>
            <p>Atenção: Isso apagará todos os dados permanentemente e restaurará para a configuração inicial.</p>
            <button id="reset-btn" class="btn btn-danger">Resetar Banco</button>
        </div>
    `;
    renderLayout(container, content, 'Backup/Restaurar');

    document.getElementById('publish-btn').addEventListener('click', handlePublishToGitHub);

    document.getElementById('save-token-checkbox').addEventListener('change', (e) => {
        if (e.target.checked) {
            showToast('Aviso: Salvar o token localmente não é totalmente seguro, pois pode ser acessado por scripts locais.', 'error');
        }
    });

    document.getElementById('export-btn').addEventListener('click', () => {
        exportDB();
        showToast('Backup exportado com sucesso!');
    });

    document.getElementById('import-btn').addEventListener('click', () => {
        const fileInput = document.getElementById('import-file');
        if (fileInput.files.length > 0) {
            importDB(fileInput.files[0], (success) => {
                if (success) {
                    showToast('Backup importado com sucesso! A página será recarregada.');
                    setTimeout(() => window.location.reload(), 2000);
                }
            });
        } else {
            showToast('Por favor, selecione um arquivo.', 'error');
        }
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        if (resetDB()) {
            showToast('Banco de dados resetado! A página será recarregada.');
            setTimeout(() => window.location.reload(), 2000);
        }
    });
}