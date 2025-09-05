import { getDB } from 'db';
import { showToast } from 'utils';
import { renderLayout } from 'views/admin/Layout';
import { renderLogin } from 'views/Login';
import { renderAdminPanel } from 'views/Admin';
import { renderClientPanel } from 'views/Client';
import { renderPlayerPage } from 'views/client/Player';

let capturedErrors = [];

/**
 * @tweakable [Timeout in milliseconds for each page analysis step to allow rendering]
 */
const ANALYSIS_STEP_DELAY = 100;

async function analyzeErrors() {
    const errorLogContainer = document.getElementById('errorLog');
    const analyzeBtn = document.getElementById('analyze-btn');
    const downloadBtn = document.getElementById('download-btn');
    
    if (!errorLogContainer || !analyzeBtn || !downloadBtn) return;

    analyzeBtn.disabled = true;
    downloadBtn.disabled = true;
    errorLogContainer.innerHTML = '<div class="loading-spinner" style="height: 100px;">Analisando...</div>';
    showToast('Analisando erros...');

    capturedErrors = [];
    const originalSession = localStorage.getItem('session');
    const dummyContainer = document.createElement('div');

    const db = getDB();
    const firstMovieId = db.movies[0]?.id;
    const firstSeriesId = db.series[0]?.id;

    /**
     * @tweakable [List of pages to be checked by the debug analysis tool]
     */
    const pagesToTest = [
        { name: 'Login', path: '#/login', render: () => renderLogin(dummyContainer), session: null },
        { name: 'Admin Dashboard', path: '#/admin/painel', render: () => renderAdminPanel(dummyContainer, '/admin/painel'), session: { role: 'admin' } },
        { name: 'Admin Generate Test', path: '#/admin/gerar-teste', render: () => renderAdminPanel(dummyContainer, '/admin/gerar-teste'), session: { role: 'admin' } },
        { name: 'Client Movies', path: '#/cliente/filmes', render: () => renderClientPanel(dummyContainer, '/cliente/filmes'), session: { role: 'client' } },
        { name: 'Client Series', path: '#/cliente/series', render: () => renderClientPanel(dummyContainer, '/cliente/series'), session: { role: 'client' } },
        { name: 'Client Animes', path: '#/cliente/animes', render: () => renderClientPanel(dummyContainer, '/cliente/animes'), session: { role: 'client' } },
        { name: 'Client Favorites', path: '#/cliente/favoritos', render: () => renderClientPanel(dummyContainer, '/cliente/favoritos'), session: { role: 'client' } },
        { name: 'Client History', path: '#/cliente/historico', render: () => renderClientPanel(dummyContainer, '/cliente/historico'), session: { role: 'client' } },
        firstMovieId && { name: 'Player (Movie)', path: `#/player?id=${firstMovieId}`, render: () => renderPlayerPage(dummyContainer), session: { role: 'client' } },
        firstSeriesId && { name: 'Player (Series)', path: `#/player?id=${firstSeriesId}`, render: () => renderPlayerPage(dummyContainer), session: { role: 'client' } },
    ].filter(Boolean);

    // This simulates URL changes for render functions that depend on it
    const originalHash = window.location.hash;
    const originalPushState = window.history.pushState;
    window.history.pushState = () => {}; // Temporarily disable history manipulation by renderers

    for (const page of pagesToTest) {
        try {
            // Simulate session
            if (page.session) {
                localStorage.setItem('session', JSON.stringify(page.session));
            } else {
                localStorage.removeItem('session');
            }
            // Simulate hash for renderers that use it
            window.location.hash = page.path;

            await page.render();
            await new Promise(resolve => setTimeout(resolve, ANALYSIS_STEP_DELAY));
        } catch (e) {
            console.error(`Error on page ${page.path}:`, e);
            capturedErrors.push({ page: page.path, error: e.message, code: e.stack });
        }
    }
    
    // Restore original state
    window.location.hash = originalHash;
    window.history.pushState = originalPushState;
    if (originalSession) {
        localStorage.setItem('session', originalSession);
    } else {
        localStorage.removeItem('session');
    }

    if (capturedErrors.length > 0) {
        errorLogContainer.innerHTML = capturedErrors.map(error => `
            <div class="error-entry">
                <p><strong>Página:</strong> ${error.page}</p>
                <p><strong>Erro:</strong> ${error.error}</p>
                <strong>Código:</strong><pre>${error.code}</pre>
            </div>
        `).join('');
    } else {
        errorLogContainer.innerHTML = '<p>Nenhum erro encontrado!</p>';
    }

    analyzeBtn.disabled = false;
    downloadBtn.disabled = false;
    showToast('Análise completa!');
    console.log('Erros encontrados:', capturedErrors);
}

function handleDownloadErrors() {
    if (capturedErrors.length === 0) {
        showToast('Nenhum erro para baixar.', 'error');
        return;
    }

    const textContent = capturedErrors.map(e => 
        `Página: ${e.page}\nErro: ${e.error}\nCódigo:\n${e.code}\n----------------------------------\n`
    ).join('');

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erros_site.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Arquivo de erros baixado com sucesso!');
}

function attachDebugListeners() {
    document.getElementById('analyze-btn').addEventListener('click', analyzeErrors);
    document.getElementById('download-btn').addEventListener('click', handleDownloadErrors);
}

export function renderDebugPage(container) {
    const content = `
        <style>
            .debug-actions {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
            }
            #errorLog {
                background: var(--dark-color);
                padding: 20px;
                border: 1px solid var(--light-dark-color);
                border-radius: 5px;
                max-height: 50vh;
                overflow-y: auto;
                margin-top: 20px;
                font-family: monospace;
            }
            .error-entry {
                margin-bottom: 1rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid var(--light-dark-color);
            }
            .error-entry:last-child {
                border-bottom: none;
            }
            #errorLog pre {
                background: #000;
                padding: 10px;
                border-radius: 5px;
                white-space: pre-wrap;
                word-break: break-all;
                color: #ff8e8e;
            }
        </style>
        <div class="card">
            <h2 class="card-title">Página de Debug</h2>
            <div class="debug-actions">
                <button id="analyze-btn" class="btn" style="background: #28a745; color: #fff; width: auto;">Analisar</button>
                <button id="download-btn" class="btn" style="background: #fff; color: #000; border: 1px solid #ccc; width: auto;">Baixar</button>
            </div>
            <div id="errorLog">
                <p>Clique em "Analisar" para verificar erros no site.</p>
            </div>
        </div>
    `;
    renderLayout(container, content, 'Debug');
    attachDebugListeners();
}