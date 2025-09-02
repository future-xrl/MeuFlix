import { getDB, saveDB, exportDB, importDB, resetDB } from 'db';
import { showToast, generateUniqueId, generateNumericId, fileToBase64, isValidLink, normalizeString, formatDate } from 'utils';

const session = JSON.parse(localStorage.getItem('session'));

function renderLayout(container, content) {
    const path = window.location.hash.slice(1);
    container.innerHTML = `
        <div class="main-layout">
            <aside class="sidebar">
                <h2>Admin</h2>
                <nav>
                    <ul>
                        <li><a href="#/admin/gerar-clientes" class="${path.includes('gerar-clientes') ? 'active' : ''}">Gerar Clientes</a></li>
                        <li><a href="#/admin/gerenciar-clientes" class="${path.includes('gerenciar-clientes') ? 'active' : ''}">Gerenciar Clientes</a></li>
                        <li><a href="#/admin/adicionar-filme" class="${path.includes('adicionar-filme') ? 'active' : ''}">Adicionar Filme</a></li>
                        <li><a href="#/admin/adicionar-serie" class="${path.includes('adicionar-serie') ? 'active' : ''}">Adicionar Série</a></li>
                        <li><a href="#/admin/backup" class="${path.includes('backup') ? 'active' : ''}">Backup/Restaurar</a></li>
                    </ul>
                </nav>
            </aside>
            <main class="main-content">
                <header class="main-header">
                    <h1>Painel do Administrador</h1>
                    <button id="logout-btn" class="btn btn-secondary btn-sm">Sair <i class="fa-solid fa-right-from-bracket"></i></button>
                </header>
                <div id="admin-page-content">
                    ${content}
                </div>
            </main>
        </div>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('logout'));
    });
}

export function renderAdminPanel(container, path) {
    const subpage = path.split('/')[2] || 'gerar-clientes';
    switch (subpage) {
        case 'gerar-clientes':
            renderGenerateClients(container);
            break;
        case 'gerenciar-clientes':
            renderManageClients(container);
            break;
        case 'adicionar-filme':
            renderAddMovie(container);
            break;
        case 'adicionar-serie':
            renderAddSeries(container);
            break;
        case 'backup':
            renderBackup(container);
            break;
        default:
            renderGenerateClients(container);
    }
}

// Sub-page render functions
function renderGenerateClients(container) {
    const content = `
        <div class="card">
            <h2 class="card-title">Gerar Novo Cliente</h2>
            <form id="generate-client-form">
                <div class="form-group">
                    <label for="client-description">Descrição (nota)</label>
                    <input type="text" id="client-description" class="form-control" placeholder="Ex: Cliente da loja X">
                </div>
                <button type="submit" class="btn btn-primary">Gerar</button>
            </form>
            <p style="margin-top: 1rem; color: var(--text-muted-color);">
                <strong>Atenção:</strong> Após gerar clientes ou fazer alterações, exporte o banco de dados na seção "Backup/Restaurar" e atualize o arquivo <code>cinemaDB.json</code> no GitHub para que as mudanças fiquem disponíveis para todos.
            </p>
        </div>
        <div id="generated-credentials-card" class="card" style="display:none;">
            <h2 class="card-title">Credenciais Geradas</h2>
            <p><strong>Usuário:</strong> <span id="gen-username"></span> <button class="btn btn-secondary btn-sm" id="copy-user">Copiar</button></p>
            <p><strong>Senha:</strong> <span id="gen-password"></span> <button class="btn btn-secondary btn-sm" id="copy-pass">Copiar</button></p>
        </div>
    `;
    renderLayout(container, content);

    const form = document.getElementById('generate-client-form');
    form.addEventListener('submit', handleGenerateClient);
}

function renderManageClients(container) {
    const db = getDB();
    const content = `
        <div class="card">
            <h2 class="card-title">Gerenciar Clientes</h2>
            <div class="form-group">
                <input type="text" id="search-client" class="form-control" placeholder="Buscar por usuário ou descrição...">
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
                    <tbody>
                        ${db.users.clients.map(client => renderClientRow(client)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    renderLayout(container, content);
    attachManageClientsListeners();
}

function renderAddMovie(container, movieToEdit = null) {
    const db = getDB();
    const content = `
        <div class="card">
            <h2 class="card-title">${movieToEdit ? 'Editar Filme' : 'Adicionar Novo Filme'}</h2>
            <form id="movie-form" data-edit-id="${movieToEdit?.id || ''}">
                <div class="form-group">
                    <label for="movie-name">Nome do Filme</label>
                    <input type="text" id="movie-name" class="form-control" value="${movieToEdit?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label for="movie-description">Descrição</label>
                    <textarea id="movie-description" class="form-control" required>${movieToEdit?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="movie-link">Link</label>
                    <input type="url" id="movie-link" class="form-control" value="${movieToEdit?.link || ''}" required>
                </div>
                 <div class="form-group">
                    <label for="movie-cover">Capa do Filme</label>
                    <input type="file" id="movie-cover" class="form-control" accept="image/*">
                    <img id="cover-preview" class="image-preview" src="${movieToEdit?.cover || ''}" style="${movieToEdit?.cover ? '' : 'display:none;'}">
                </div>
                <button type="submit" class="btn btn-primary">${movieToEdit ? 'Salvar Alterações' : 'Adicionar Filme'}</button>
                ${movieToEdit ? `<button type="button" id="cancel-edit" class="btn btn-secondary">Cancelar</button>` : ''}
            </form>
        </div>
        <div class="card">
            <h2 class="card-title">Filmes Existentes</h2>
            <ul id="movie-list" class="item-list">
                ${db.movies.map(movie => `
                    <li>
                        <span>${movie.name}</span>
                        <div class="actions">
                            <button class="btn btn-secondary btn-sm edit-movie" data-id="${movie.id}">Editar</button>
                            <button class="btn btn-danger btn-sm delete-movie" data-id="${movie.id}">Excluir</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    renderLayout(container, content);
    attachMovieFormListeners();
}

function renderAddSeries(container, seriesToEdit = null) {
    const db = getDB();
    // This is a simplified version for brevity. A real implementation would need more complex state management for dynamic seasons/episodes.
    const content = `
         <div class="card">
            <h2 class="card-title">${seriesToEdit ? 'Editar Série' : 'Adicionar Nova Série'}</h2>
            <form id="series-form" data-edit-id="${seriesToEdit?.id || ''}">
                <div class="form-group">
                    <label for="series-name">Nome da Série</label>
                    <input type="text" id="series-name" class="form-control" value="${seriesToEdit?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label for="series-description">Descrição</label>
                    <textarea id="series-description" class="form-control" required>${seriesToEdit?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="series-cover">Capa da Série</label>
                    <input type="file" id="series-cover" class="form-control" accept="image/*">
                    <img id="cover-preview" class="image-preview" src="${seriesToEdit?.cover || ''}" style="${seriesToEdit?.cover ? '' : 'display:none;'}">
                </div>
                
                <div id="seasons-container">
                    <!-- Seasons and episodes will be rendered here dynamically -->
                </div>
                <button type="button" id="add-season-btn" class="btn btn-secondary">Adicionar Temporada</button>
                <hr style="margin: 1rem 0;">
                <button type="submit" class="btn btn-primary">${seriesToEdit ? 'Salvar Alterações' : 'Adicionar Série'}</button>
                 ${seriesToEdit ? `<button type="button" id="cancel-edit-series" class="btn btn-secondary">Cancelar</button>` : ''}
            </form>
        </div>
        <div class="card">
            <h2 class="card-title">Séries Existentes</h2>
            <ul id="series-list" class="item-list">
                ${db.series.map(s => `
                    <li>
                        <span>${s.name}</span>
                        <div class="actions">
                            <button class="btn btn-secondary btn-sm edit-series" data-id="${s.id}">Editar</button>
                            <button class="btn btn-danger btn-sm delete-series" data-id="${s.id}">Excluir</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    renderLayout(container, content);
    attachSeriesFormListeners(seriesToEdit);
}

function renderBackup(container) {
    const content = `
        <div class="card">
            <h2 class="card-title">Exportar Banco de Dados</h2>
            <p>Faça o download de todos os seus dados como um arquivo JSON. Este é o arquivo que deve ser enviado para o GitHub.</p>
            <p style="margin-top: 0.5rem; color: var(--text-muted-color);">
                <strong>Instruções:</strong> Para que novos usuários e conteúdos fiquem disponíveis para todos, exporte o banco, substitua o arquivo <code>cinemaDB.json</code> no <a href="https://github.com/Future-XRL/MeuFlix" target="_blank">repositório do GitHub</a> e faça o commit das alterações.
            </p>
            <button id="export-btn" class="btn btn-primary" style="margin-top: 10px;">Exportar Banco (cinemaDB.json)</button>
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
    renderLayout(container, content);

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


// Handlers and Listeners

function handleGenerateClient(e) {
    e.preventDefault();
    const description = e.target.elements['client-description'].value;
    const db = getDB();
    
    let username, password;
    do {
        username = generateNumericId(5);
    } while (db.users.clients.some(c => c.username === username));

    password = generateNumericId(5);
    
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(now.getDate() + db.config.expirationDays);

    const newClient = {
        username,
        password,
        description,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: 'válido'
    };

    db.users.clients.push(newClient);
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
    showToast('Cliente gerado com sucesso!');
}

function renderClientRow(client) {
    const now = new Date();
    const expires = new Date(client.expiresAt);
    const isExpired = now > expires;
    const status = isExpired ? 'expirado' : 'válido';
    if (client.status !== status) {
        // Auto-update status in DB if it's different
        const db = getDB();
        const clientInDb = db.users.clients.find(c => c.username === client.username);
        if (clientInDb) clientInDb.status = status;
        saveDB(db);
    }

    return `
        <tr data-username="${client.username}">
            <td>${client.username}</td>
            <td>
                <span class="password-text" style="display:none;">${client.password}</span>
                <span class="password-dots">*****</span>
                <button class="btn btn-sm password-toggle-table"><i class="fa-solid fa-eye"></i></button>
            </td>
            <td class="client-description">${client.description}</td>
            <td>${formatDate(client.createdAt)}</td>
            <td>${formatDate(client.expiresAt)}</td>
            <td><span class="status ${status}">${status}</span></td>
            <td class="actions">
                <button class="btn btn-sm btn-secondary edit-desc-btn">Editar</button>
                <button class="btn btn-sm btn-secondary renew-btn">Renovar</button>
                <button class="btn btn-sm btn-secondary reset-pass-btn">Resetar Senha</button>
                <button class="btn btn-sm btn-danger delete-btn">Excluir</button>
            </td>
        </tr>
    `;
}

function attachManageClientsListeners() {
    const table = document.getElementById('clients-table');
    table.addEventListener('click', e => {
        const target = e.target.closest('button');
        if (!target) return;

        const row = target.closest('tr');
        const username = row.dataset.username;

        if (target.classList.contains('password-toggle-table')) {
            const passText = row.querySelector('.password-text');
            const passDots = row.querySelector('.password-dots');
            const icon = target.querySelector('i');
            const isHidden = passText.style.display === 'none';
            passText.style.display = isHidden ? 'inline' : 'none';
            passDots.style.display = isHidden ? 'none' : 'inline';
            icon.className = `fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}`;
        }
        else if (target.classList.contains('edit-desc-btn')) {
            const descCell = row.querySelector('.client-description');
            const currentDesc = descCell.textContent;
            const newDesc = prompt('Editar Descrição:', currentDesc);
            if (newDesc !== null && newDesc.trim() !== currentDesc) {
                const db = getDB();
                const client = db.users.clients.find(c => c.username === username);
                client.description = newDesc.trim();
                saveDB(db);
                descCell.textContent = newDesc.trim();
                showToast('Descrição atualizada!');
            }
        }
        else if (target.classList.contains('renew-btn')) {
            if (confirm(`Deseja renovar o cliente ${username} por mais 31 dias?`)) {
                 const db = getDB();
                const client = db.users.clients.find(c => c.username === username);
                const newExpiry = new Date();
                newExpiry.setDate(newExpiry.getDate() + db.config.expirationDays);
                client.expiresAt = newExpiry.toISOString();
                client.status = 'válido';
                saveDB(db);
                row.outerHTML = renderClientRow(client);
                showToast('Cliente renovado com sucesso!');
            }
        }
        else if (target.classList.contains('reset-pass-btn')) {
             if (confirm(`Deseja resetar a senha do cliente ${username}?`)) {
                const db = getDB();
                const client = db.users.clients.find(c => c.username === username);
                client.password = generateNumericId(5);
                saveDB(db);
                row.outerHTML = renderClientRow(client);
                showToast(`Nova senha para ${username} gerada!`);
            }
        }
        else if (target.classList.contains('delete-btn')) {
             if (confirm(`Deseja excluir o cliente ${username}?`)) {
                let db = getDB();
                db.users.clients = db.users.clients.filter(c => c.username !== username);
                saveDB(db);
                row.remove();
                showToast('Cliente excluído com sucesso!');
            }
        }
    });

    document.getElementById('search-client').addEventListener('input', e => {
        const searchTerm = normalizeString(e.target.value);
        document.querySelectorAll('#clients-table tbody tr').forEach(row => {
            const username = row.cells[0].textContent;
            const description = row.cells[2].textContent;
            const isVisible = normalizeString(username).includes(searchTerm) || normalizeString(description).includes(searchTerm);
            row.style.display = isVisible ? '' : 'none';
        });
    });
}

function attachMovieFormListeners() {
    const form = document.getElementById('movie-form');
    form.addEventListener('submit', handleMovieSubmit);
    
    document.getElementById('movie-cover').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (file) {
            try {
                const base64 = await fileToBase64(file);
                document.getElementById('cover-preview').src = base64;
                document.getElementById('cover-preview').style.display = 'block';
            } catch (error) {
                showToast(error.message, 'error');
                e.target.value = '';
            }
        }
    });
    
    document.getElementById('movie-list').addEventListener('click', e => {
        const db = getDB();
        if (e.target.classList.contains('edit-movie')) {
            const movieId = e.target.dataset.id;
            const movie = db.movies.find(m => m.id === movieId);
            renderAddMovie(document.getElementById('app'), movie);
        }
        if (e.target.classList.contains('delete-movie')) {
            if (confirm('Deseja excluir este filme?')) {
                const movieId = e.target.dataset.id;
                let db = getDB();
                db.movies = db.movies.filter(m => m.id !== movieId);
                saveDB(db);
                showToast('Filme excluído!');
                renderAddMovie(document.getElementById('app'));
            }
        }
    });
    
    const cancelBtn = document.getElementById('cancel-edit');
    if(cancelBtn) {
        cancelBtn.addEventListener('click', () => renderAddMovie(document.getElementById('app')));
    }
}

async function handleMovieSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.elements['movie-name'].value;
    const description = form.elements['movie-description'].value;
    const link = form.elements['movie-link'].value;
    const coverFile = form.elements['movie-cover'].files[0];
    const editId = form.dataset.editId;
    
    if (!isValidLink(link)) {
        showToast('Link inválido, use apenas Google Drive, Dropbox, Archive.org, Pixeldrain, YouTube ou Terabox.', 'error');
        return;
    }

    const db = getDB();
    let movieData;

    if (editId) {
        movieData = db.movies.find(m => m.id === editId);
    } else {
        movieData = { id: generateUniqueId('movie_') };
    }

    movieData.name = name;
    movieData.description = description;
    movieData.link = link;
    
    if (coverFile) {
        try {
            movieData.cover = await fileToBase64(coverFile);
        } catch (error) {
            showToast(error.message, 'error');
            return;
        }
    } else if (!editId) {
        showToast('A imagem da capa é obrigatória.', 'error');
        return;
    }
    
    if (editId) {
        const index = db.movies.findIndex(m => m.id === editId);
        db.movies[index] = movieData;
        showToast('Filme atualizado com sucesso!');
    } else {
        db.movies.push(movieData);
        showToast('Filme adicionado com sucesso!');
    }
    
    saveDB(db);
    renderAddMovie(document.getElementById('app'));
}

function attachSeriesFormListeners(seriesToEdit = null) {
    let seasons = seriesToEdit ? JSON.parse(JSON.stringify(seriesToEdit.seasons)) : [];

    const renderSeasons = () => {
        const container = document.getElementById('seasons-container');
        container.innerHTML = seasons.map((season, sIndex) => `
            <div class="season-block card" data-season-index="${sIndex}">
                <h4>Temporada ${season.seasonNumber} <button type="button" class="btn btn-danger btn-sm remove-season-btn">Remover</button></h4>
                <div class="episodes-container">
                    ${season.episodes.map((ep, eIndex) => `
                        <div class="episode-block form-group" data-episode-index="${eIndex}">
                            <label>Episódio ${ep.episodeNumber}</label>
                            <input type="url" class="form-control episode-link" value="${ep.link}" placeholder="Link do episódio" required>
                             <button type="button" class="btn btn-danger btn-sm remove-episode-btn">X</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-secondary btn-sm add-episode-btn">Adicionar Episódio</button>
            </div>
        `).join('');
    };

    const updateListeners = () => {
        document.querySelectorAll('.add-episode-btn').forEach(btn => btn.onclick = handleAddEpisode);
        document.querySelectorAll('.remove-season-btn').forEach(btn => btn.onclick = handleRemoveSeason);
        document.querySelectorAll('.remove-episode-btn').forEach(btn => btn.onclick = handleRemoveEpisode);
        document.querySelectorAll('.episode-link').forEach(input => input.onchange = handleEpisodeLinkChange);
    };
    
    const handleAddSeason = () => {
        seasons.push({ seasonNumber: seasons.length + 1, episodes: [] });
        renderSeasons();
        updateListeners();
    };

    const handleAddEpisode = (e) => {
        const sIndex = e.target.closest('.season-block').dataset.seasonIndex;
        const season = seasons[sIndex];
        season.episodes.push({ episodeNumber: season.episodes.length + 1, link: '' });
        renderSeasons();
        updateListeners();
    };
    
    const handleRemoveSeason = (e) => {
        const sIndex = e.target.closest('.season-block').dataset.seasonIndex;
        seasons.splice(sIndex, 1);
        seasons.forEach((s, i) => s.seasonNumber = i + 1); // re-number seasons
        renderSeasons();
        updateListeners();
    };
    
    const handleRemoveEpisode = (e) => {
        const sIndex = e.target.closest('.season-block').dataset.seasonIndex;
        const eIndex = e.target.closest('.episode-block').dataset.episodeIndex;
        const season = seasons[sIndex];
        season.episodes.splice(eIndex, 1);
        season.episodes.forEach((ep, i) => ep.episodeNumber = i + 1);
        renderSeasons();
        updateListeners();
    };

    const handleEpisodeLinkChange = (e) => {
        const sIndex = e.target.closest('.season-block').dataset.seasonIndex;
        const eIndex = e.target.closest('.episode-block').dataset.episodeIndex;
        seasons[sIndex].episodes[eIndex].link = e.target.value;
    };
    
    document.getElementById('add-season-btn').addEventListener('click', handleAddSeason);
    document.getElementById('series-cover').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (file) {
            try {
                const base64 = await fileToBase64(file);
                document.getElementById('cover-preview').src = base64;
                document.getElementById('cover-preview').style.display = 'block';
            } catch (error) {
                showToast(error.message, 'error');
                e.target.value = '';
            }
        }
    });

    document.getElementById('series-form').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const name = form.elements['series-name'].value;
        const description = form.elements['series-description'].value;
        const coverFile = form.elements['series-cover'].files[0];
        const editId = form.dataset.editId;

        for (const season of seasons) {
            for (const episode of season.episodes) {
                if (!isValidLink(episode.link)) {
                    showToast(`Link inválido no Episódio ${episode.episodeNumber} da Temporada ${season.seasonNumber}.`, 'error');
                    return;
                }
            }
        }
        
        const db = getDB();
        let seriesData;

        if (editId) {
            seriesData = db.series.find(s => s.id === editId);
        } else {
            seriesData = { id: generateUniqueId('series_') };
        }

        seriesData.name = name;
        seriesData.description = description;
        seriesData.seasons = seasons;

        if (coverFile) {
            try {
                seriesData.cover = await fileToBase64(coverFile);
            } catch (error) {
                showToast(error.message, 'error');
                return;
            }
        } else if (!editId) {
            showToast('A imagem da capa é obrigatória.', 'error');
            return;
        }

        if (editId) {
            const index = db.series.findIndex(s => s.id === editId);
            db.series[index] = seriesData;
            showToast('Série atualizada com sucesso!');
        } else {
            db.series.push(seriesData);
            showToast('Série adicionada com sucesso!');
        }

        saveDB(db);
        renderAddSeries(document.getElementById('app'));
    });

    document.getElementById('series-list').addEventListener('click', e => {
        const db = getDB();
        if (e.target.classList.contains('edit-series')) {
            const seriesId = e.target.dataset.id;
            const series = db.series.find(s => s.id === seriesId);
            renderAddSeries(document.getElementById('app'), series);
        }
        if (e.target.classList.contains('delete-series')) {
            if (confirm('Deseja excluir esta série?')) {
                const seriesId = e.target.dataset.id;
                let db = getDB();
                db.series = db.series.filter(s => s.id !== seriesId);
                saveDB(db);
                showToast('Série excluída!');
                renderAddSeries(document.getElementById('app'));
            }
        }
    });
    
    const cancelBtn = document.getElementById('cancel-edit-series');
    if(cancelBtn) {
        cancelBtn.addEventListener('click', () => renderAddSeries(document.getElementById('app')));
    }

    renderSeasons();
    updateListeners();
}