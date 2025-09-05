import { getDB, saveDB } from 'db';
import { showToast, formatDate, renderPaginationControls } from 'utils';
import { renderLayout } from 'views/admin/Layout';

let countdownIntervals = [];
let currentPage = 1;
/* @tweakable [Number of items to display per page in the admin tables] */
const ITEMS_PER_PAGE = 10;
let currentSearchTerm = '';

function renderTestRow(test) {
    const expiresAt = new Date(test.expiresAt);
    const now = new Date();
    const isExpired = expiresAt < now;
    let statusClass = test.status;
    if (isExpired && test.status !== 'bloqueado') statusClass = 'expirado';

    return `
         <tr data-username="${test.username}">
            <td data-label="Usuário">${test.username}</td>
             <td data-label="Senha">
                <span class="password-text" style="display:none;">${test.password}</span>
                <span class="password-dots">*****</span>
                <button class="btn-icon password-toggle-table"><i class="fa-solid fa-eye"></i></button>
            </td>
            <td data-label="Tempo Restante" class="countdown" data-expires-at="${test.expiresAt}">Calculando...</td>
            <td data-label="Vencimento">${formatDate(test.expiresAt)}</td>
            <td data-label="Descrição">${test.description}</td>
            <td data-label="Status"><span class="status ${statusClass}">${isExpired ? 'expirado' : test.status}</span></td>
            <td data-label="Ações" class="actions">
                 <div class="action-dropdown">
                    <button class="btn btn-sm btn-success action-toggle">+</button>
                    <div class="action-dropdown-content">
                        <a href="#" class="activate-client-btn">Ativar Cliente</a>
                        <a href="#" class="block-test-btn">${test.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}</a>
                    </div>
                </div>
                <button class="btn-icon delete-test-btn"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `;
}

function attachMyTestsListeners(onPageChange) {
    countdownIntervals.forEach(clearInterval);
    countdownIntervals = [];

    document.querySelectorAll('.countdown').forEach(el => {
        const expiresAt = new Date(el.dataset.expiresAt);
        const intervalId = setInterval(() => {
            const now = new Date();
            const diff = expiresAt - now;
            if (diff <= 0) {
                el.textContent = "Expirado";
                clearInterval(intervalId);
                return;
            }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            el.textContent = `${d}d ${h}h ${m}m`;
        }, 1000);
        countdownIntervals.push(intervalId);
    });

    document.getElementById('tests-table-body')?.addEventListener('click', e => {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;
        const username = row.dataset.username;

        if (target.matches('.password-toggle-table, .password-toggle-table *')) {
            const passText = row.querySelector('.password-text');
            const passDots = row.querySelector('.password-dots');
            const icon = row.querySelector('.password-toggle-table i');
            const isHidden = passText.style.display === 'none';
            passText.style.display = isHidden ? 'inline' : 'none';
            passDots.style.display = isHidden ? 'none' : 'inline';
            icon.className = `fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}`;
        } else if (target.matches('.delete-test-btn, .delete-test-btn *')) {
            if (confirm(`Deseja excluir o teste ${username}?`)) {
                let db = getDB();
                db.users.tests = (db.users.tests || []).filter(t => t.username !== username);
                saveDB(db);
                onPageChange(currentPage); // Re-render current page
                showToast('Teste excluído com sucesso!');
            }
        } else if (target.matches('.block-test-btn')) {
            e.preventDefault();
            let db = getDB();
            const test = (db.users.tests || []).find(t => t.username === username);
            if(test) {
                const isBlocked = test.status === 'bloqueado';
                test.status = isBlocked ? 'ativo' : 'bloqueado';
                saveDB(db);
                onPageChange(currentPage); // Re-render current page
                showToast(`Teste ${isBlocked ? 'desbloqueado' : 'bloqueado'}!`);
            }
        } else if (target.matches('.activate-client-btn')) {
            e.preventDefault();
            showActivationModal(username, () => onPageChange(currentPage));
        } else if (target.matches('.action-toggle')) {
            document.querySelectorAll('.action-dropdown.show').forEach(dd => {
                if (dd !== target.parentElement) dd.classList.remove('show');
            });
            target.parentElement.classList.toggle('show');
        }
    });

    document.getElementById('search-test')?.addEventListener('input', e => {
        currentSearchTerm = e.target.value;
        currentPage = 1;
        onPageChange(1);
    });

    document.addEventListener('click', e => {
        if (!e.target.matches('.action-toggle')) {
            document.querySelectorAll('.action-dropdown.show').forEach(dd => dd.classList.remove('show'));
        }
    });
}

function showActivationModal(username, onActivate) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.style.display = 'flex';
    modalContainer.innerHTML = `
        <div class="modal-content">
            <span class="modal-close">&times;</span>
            <h2>Ativar Cliente: ${username}</h2>
            <form id="activation-form">
                <div class="form-group">
                    <label for="client-name">Nome do Cliente</label>
                    <input type="text" id="client-name" class="form-control">
                </div>
                 <div class="form-group">
                    <label for="client-whatsapp">Número do WhatsApp</label>
                    <input type="tel" id="client-whatsapp" class="form-control">
                </div>
                 <div class="form-group">
                    <label for="client-email">Email do Cliente</label>
                    <input type="email" id="client-email" class="form-control">
                </div>
                 <div class="form-group">
                    <label for="client-desc">Descrição</label>
                    <input type="text" id="client-desc" class="form-control">
                </div>
                <label>Selecione a Duração</label>
                <div class="duration-options" id="duration-options">
                    <button type="button" class="btn btn-secondary" data-days="15">15 dias</button>
                    <button type="button" class="btn btn-secondary active" data-days="30">30 dias</button>
                    <button type="button" class="btn btn-secondary" data-days="60">60 dias</button>
                    <button type="button" class="btn btn-secondary" data-days="90">90 dias</button>
                    <button type="button" class="btn btn-secondary" data-days="180">180 dias</button>
                    <button type="button" class="btn btn-secondary" data-days="365">365 dias</button>
                </div>
                <button type="submit" class="btn btn-primary">Ativar</button>
            </form>
        </div>
    `;

    const closeModal = () => modalContainer.style.display = 'none';
    modalContainer.querySelector('.modal-close').onclick = closeModal;

    const durationOptions = document.getElementById('duration-options');
    let selectedDays = 30;
    durationOptions.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            durationOptions.querySelector('.active').classList.remove('active');
            btn.classList.add('active');
            selectedDays = parseInt(btn.dataset.days);
        });
    });

    document.getElementById('activation-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const db = getDB();
        const testIndex = (db.users.tests || []).findIndex(t => t.username === username);
        if (testIndex === -1) {
            showToast('Usuário de teste não encontrado.', 'error');
            closeModal();
            return;
        }
        const testUser = db.users.tests[testIndex];

        const newClient = {
            ...testUser,
            name: document.getElementById('client-name').value,
            whatsapp: document.getElementById('client-whatsapp').value,
            email: document.getElementById('client-email').value,
            description: document.getElementById('client-desc').value || testUser.description,
            createdAt: new Date().toISOString(),
            status: 'ativo'
        };

        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + selectedDays);
        newClient.expiresAt = newExpiry.toISOString();

        db.users.clients.push(newClient);
        db.users.tests.splice(testIndex, 1);
        saveDB(db);

        showActivationSuccess(newClient);
        onActivate();
    });
}

function showActivationSuccess(client) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.style.display = 'flex';
    const credentialsText = `Usuário: ${client.username}\nSenha: ${client.password}`;
    modalContainer.innerHTML = `
         <div class="modal-content" style="text-align: center;">
            <span class="modal-close">&times;</span>
            <h2>Cliente Ativado!</h2>
            <p><strong>Usuário:</strong> ${client.username}</p>
            <p><strong>Senha:</strong> ${client.password}</p>
            <p><strong>Vence em:</strong> ${formatDate(client.expiresAt)}</p>
            <p style="margin-top: 1rem; color: var(--text-muted-color);">Obrigado por assinar! Qualquer dúvida, só chamar.</p>
            <button id="copy-credentials-btn" class="btn btn-success" style="margin-top: 1rem;">Copiar Credenciais</button>
        </div>
    `;
    modalContainer.querySelector('.modal-close').onclick = () => modalContainer.style.display = 'none';
    document.getElementById('copy-credentials-btn').onclick = () => {
        navigator.clipboard.writeText(credentialsText);
        showToast('Credenciais copiadas!');
    };
}

function updateMyTestsView(container, page = 1) {
    currentPage = page;
    const db = getDB();
    const allTests = db.users?.tests || [];
    
    const filteredTests = allTests.filter(test => {
        const searchTerm = currentSearchTerm.toLowerCase();
        return test.username.toLowerCase().includes(searchTerm) || test.description.toLowerCase().includes(searchTerm);
    });

    const totalPages = Math.ceil(filteredTests.length / ITEMS_PER_PAGE);
    const paginatedTests = filteredTests.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const content = `
         <div class="card">
            <h2 class="card-title">Meus Testes</h2>
             <div class="form-group">
                <input type="text" id="search-test" class="form-control" placeholder="Buscar por usuário ou descrição..." value="${currentSearchTerm}">
            </div>
             <div class="table-wrapper">
                <table class="styled-table" id="tests-table">
                     <thead>
                        <tr>
                            <th>Usuário</th>
                            <th>Senha</th>
                            <th>Tempo Restante</th>
                            <th>Vencimento</th>
                            <th>Descrição</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="tests-table-body">
                        ${paginatedTests.map(test => renderTestRow(test)).join('')}
                    </tbody>
                </table>
            </div>
             <div id="pagination-container"></div>
        </div>
    `;
    
    if (container.innerHTML === '' || !document.getElementById('admin-page-content')) {
        renderLayout(container, content, 'Meus Testes');
    } else {
        document.getElementById('admin-page-content').innerHTML = content;
        document.querySelector('.main-header h1').textContent = 'Meus Testes';
    }

    renderPaginationControls(document.getElementById('pagination-container'), currentPage, totalPages, (newPage) => {
        updateMyTestsView(container, newPage);
    });
    
    attachMyTestsListeners((pageToRender) => updateMyTestsView(container, pageToRender));
}

export function renderMyTestsPage(container) {
    currentPage = 1;
    currentSearchTerm = '';
    updateMyTestsView(container, 1);
}