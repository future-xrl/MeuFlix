import { getDB, saveDB } from 'db';
import { showToast, generateNumericId } from 'utils';
import { renderLayout } from 'views/admin/Layout';

/** @tweakable [Test user validity duration in days] */
const TEST_USER_DURATION_DAYS = 7;

function handleGenerateTest(e) {
    e.preventDefault();
    const description = e.target.elements['client-description'].value;
    const db = getDB();

    let username, password;
    const existingUsernames = [...db.users.clients.map(c => c.username), ...(db.users.tests || []).map(t => t.username)];

    do {
        username = generateNumericId(5);
    } while (existingUsernames.includes(username));

    password = generateNumericId(5);

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(now.getDate() + TEST_USER_DURATION_DAYS);

    const newTest = {
        username,
        password,
        description,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: 'ativo'
    };

    if (!db.users.tests) db.users.tests = [];
    db.users.tests.push(newTest);
    saveDB(db);

    document.getElementById('gen-username').textContent = username;
    document.getElementById('gen-password').textContent = password;
    document.getElementById('generated-credentials-card').style.display = 'block';

    document.getElementById('copy-user').onclick = () => {
        navigator.clipboard.writeText(username);
        showToast('Usuário copiado!');
    };
    document.getElementById('copy-pass').onclick = () => {
        navigator.clipboard.writeText(password);
        showToast('Senha copiada!');
    };

    e.target.reset();
    showToast('Teste gerado com sucesso!');
}

export function renderGenerateTestPage(container) {
    const content = `
        <div class="card">
            <h2 class="card-title">Gerar Novo Teste</h2>
            <form id="generate-test-form">
                <div class="form-group">
                    <label for="client-description">Descrição (nota)</label>
                    <input type="text" id="client-description" class="form-control" placeholder="Ex: Teste para João">
                </div>
                <button type="submit" class="btn btn-primary">Gerar Teste</button>
            </form>
            <p style="margin-top: 1rem; color: var(--text-muted-color); font-size: 0.9em;">
                Testes gerados têm validade de ${TEST_USER_DURATION_DAYS} dias e podem ser gerenciados na página "Meus Testes".
            </p>
        </div>
        <div id="generated-credentials-card" class="card" style="display:none;">
            <h2 class="card-title">Credenciais Geradas</h2>
            <p><strong>Usuário:</strong> <span id="gen-username"></span> <button class="btn btn-secondary btn-sm" id="copy-user">Copiar</button></p>
            <p><strong>Senha:</strong> <span id="gen-password"></span> <button class="btn btn-secondary btn-sm" id="copy-pass">Copiar</button></p>
        </div>
    `;
    renderLayout(container, content, 'Gerar Teste');

    const form = document.getElementById('generate-test-form');
    if (form) {
        form.addEventListener('submit', handleGenerateTest);
    } else {
        console.warn('Element #generate-test-form not found on page #/admin/gerar-teste.');
    }
}