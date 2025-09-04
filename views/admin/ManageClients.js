import { getDB, saveDB } from 'db';
import { showToast, generateNumericId, normalizeString, formatDate, renderPaginationControls } from 'utils';
import { renderLayout } from 'views/admin/Layout';

let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let currentSearchTerm = '';

function renderClientRow(client) {
    const now = new Date();
    const expiresAt = new Date(client.expiresAt);
    const diffTime = expiresAt - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let status, statusClass;
    if (diffDays <= 0) {
        status = 'Expirado';
        statusClass = 'expirado';
    } else if (diffDays <= 7) {
        status = `Faltam ${diffDays} dia(s)`;
        statusClass = 'pendente';
    } else {
        status = 'Ativo';
        statusClass = 'ativo';
    }

    return `
        <tr data-username="${client.username}">
            <td data-label="Usuário">${client.username}</td>
            <td data-label="Senha">
                <span class="password-text" style="display:none;">${client.password}</span>
                <span class="password-dots">*****</span>
                <button class="btn-icon password-toggle-table"><i class="fa-solid fa-eye"></i></button>
            </td>
            <td data-label="Descrição" class="client-description">${client.description || ''}</td>
            <td data-label="Criado em">${formatDate(client.createdAt)}</td>
            <td data-label="Expira em">${formatDate(client.expiresAt)}</td>
            <td data-label="Status"><span class="status ${statusClass}">${status}</span></td>
            <td data-label="Ações" class="actions">
                <div class="action-dropdown">
                    <button class="btn btn-sm btn-success action-toggle">+</button>
                    <div class="action-dropdown-content">
                        ${diffDays < 7 && diffDays > 0 ? `<a href="#" class="add-days-btn" data-days="3">Adicionar 3 dias extras</a>` : ''}
                        <a href="#" class="edit-desc-btn">Editar Descrição</a>
                        <a href="#" class="reset-pass-btn">Resetar Senha</a>
                    </div>
                </div>
                <button class="btn-icon delete-btn"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `;
}

function attachManageClientsListeners(onPageChange) {
    const tableBody = document.getElementById('clients-table-body');
    if (!tableBody) return;

    tableBody.addEventListener('click', e => {
        const target = e.target;
        if (!target) return;

        const row = target.closest('tr');
        if (!row) return;
        
        const username = row.dataset.username;

        if (target.matches('.password-toggle-table, .password-toggle-table *')) {
            const passText = row.querySelector('.password-text');
            const passDots = row.querySelector('.password-dots');
            const icon = target.closest('button').querySelector('i');
            const isHidden = passText.style.display === 'none';
            passText.style.display = isHidden ? 'inline' : 'none';
            passDots.style.display = isHidden ? 'none' : 'inline';
            icon.className = `fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}`;
        }
        else if (target.matches('.edit-desc-btn')) {
            e.preventDefault();
            const descCell = row.querySelector('.client-description');
            const currentDesc = descCell.textContent;
            const newDesc = prompt('Editar Descrição:', currentDesc);
            if (newDesc !== null && newDesc.trim() !== currentDesc) {
                const db = getDB();
                const client = db.users.clients.find(c => c.username === username);
                if (client) {
                    client.description = newDesc.trim();
                    saveDB(db);
                    descCell.textContent = newDesc.trim();
                    showToast('Descrição atualizada!');
                }
            }
        }
         else if (target.matches('.add-days-btn')) {
            e.preventDefault();
            const daysToAdd = parseInt(target.dataset.days);
            if (confirm(`Deseja adicionar ${daysToAdd} dias extras para o cliente ${username}?`)) {
                const db = getDB();
                const client = db.users.clients.find(c => c.username === username);
                if (client) {
                    const currentExpiry = new Date(client.expiresAt);
                    currentExpiry.setDate(currentExpiry.getDate() + daysToAdd);
                    client.expiresAt = currentExpiry.toISOString();
                    saveDB(db);
                    onPageChange(currentPage); // Re-render page
                    showToast(`${daysToAdd} dias adicionados com sucesso!`);
                }
            }
        }
        else if (target.matches('.reset-pass-btn')) {
             e.preventDefault();
             if (confirm(`Deseja resetar a senha do cliente ${username}?`)) {
                const db = getDB();
                const client = db.users.clients.find(c => c.username === username);
                if (client) {
                    client.password = generateNumericId(5);
                    saveDB(db);
                    onPageChange(currentPage); // Re-render page
                    showToast(`Nova senha para ${username} gerada!`);
                }
            }
        }
        else if (target.matches('.delete-btn, .delete-btn *')) {
             if (confirm(`Tem certeza que quer excluir esse login? ${username}?`)) {
                let db = getDB();
                db.users.clients = db.users.clients.filter(c => c.username !== username);
                saveDB(db);
                onPageChange(currentPage); // Re-render page
                showToast('Cliente excluído com sucesso!');
            }
        }
         else if (target.matches('.action-toggle')) {
            document.querySelectorAll('.action-dropdown.show').forEach(dd => {
                if (dd !== target.parentElement) dd.classList.remove('show');
            });
            target.parentElement.classList.toggle('show');
        }
    });

    document.getElementById('search-client').addEventListener('input', e => {
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

function updateManageClientsView(container, page = 1) {
    currentPage = page;
    const db = getDB();
    const now = new Date();

    const allClients = (db.users?.clients || []).filter(c => {
        const expiresAt = new Date(c.expiresAt);
        return c.status === 'ativo' || expiresAt < now;
    });

    const filteredClients = allClients.filter(client => {
        const searchTerm = normalizeString(currentSearchTerm);
        return normalizeString(client.username).includes(searchTerm) || normalizeString(client.description).includes(searchTerm);
    });

    const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
    const paginatedClients = filteredClients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const content = `
        <div class="card">
            <h2 class="card-title">Gerenciar Clientes</h2>
            <div class="form-group">
                <input type="text" id="search-client" class="form-control" placeholder="Buscar por usuário ou descrição..." value="${currentSearchTerm}">
            </div>
            <div class="table-wrapper">
                <table class="styled-table" id="clients-table">
                    <thead>
                        <tr>
                            <th>Usuário</th>
                            <th>Senha</th>
                            <th>Descrição</th>
                            <th>Criado em</th>
                            <th>Expira em</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="clients-table-body">
                        ${paginatedClients.map(client => renderClientRow(client)).join('')}
                    </tbody>
                </table>
            </div>
            <div id="pagination-container"></div>
        </div>
    `;
    
    if (container.innerHTML === '' || !document.getElementById('admin-page-content')) {
        renderLayout(container, content, 'Gerenciar Clientes');
    } else {
        document.getElementById('admin-page-content').innerHTML = content;
        document.querySelector('.main-header h1').textContent = 'Gerenciar Clientes';
    }

    renderPaginationControls(document.getElementById('pagination-container'), currentPage, totalPages, (newPage) => {
        updateManageClientsView(container, newPage);
    });

    attachManageClientsListeners((pageToRender) => updateManageClientsView(container, pageToRender));
}

export function renderManageClientsPage(container) {
    currentPage = 1;
    currentSearchTerm = '';
    updateManageClientsView(container, 1);
}