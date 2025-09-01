document.addEventListener('DOMContentLoaded', () => {
    const app = {
        // ... app initialization logic ...
    };

    // --- DATABASE (LocalStorage) --- //
    const db = {
        _get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
        _set: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
        
        getUsers: () => db._get('users'),
        setUsers: (users) => db._set('users', users),
        
        getMovies: () => db._get('movies'),
        setMovies: (movies) => db._set('movies', movies),
        
        getSeries: () => db._get('series'),
        setSeries: (series) => db._set('series', series),

        getAdminSettings: () => JSON.parse(localStorage.getItem('admin_settings') || '{}'),
        setAdminSettings: (settings) => localStorage.setItem('admin_settings', JSON.stringify(settings)),

        // Add admin accounts to DB if they don't exist, to prevent accidental deletion
        initAdmin: () => {
            let users = db.getUsers();
            if (!users.find(u => u.username === 'admin')) {
                users.push({
                    username: 'admin',
                    password: '36365852', // Storing plaintext passwords is not secure for real apps
                    role: 'admin'
                });
                db.setUsers(users);
            }
        },

        getCurrentUser: () => JSON.parse(sessionStorage.getItem('currentUser')),
        setCurrentUser: (user) => sessionStorage.setItem('currentUser', JSON.stringify(user)),
        clearCurrentUser: () => sessionStorage.removeItem('currentUser'),
    };

    // --- STATE MANAGEMENT --- //
    const state = {
        currentPage: 'login', // 'login', 'admin', 'client'
        currentAdminPage: 'admin-dashboard',
        currentClientPage: 'client-movies',
        currentMediaView: null, // { type: 'movie'/'series', id: ... }
        currentSearchQuery: '',
    };
    
    // --- ROUTER & RENDER --- //
    const router = {
        navigate: (page, subpage = null) => {
            if (page === 'admin') {
                state.currentPage = 'admin';
                state.currentAdminPage = subpage || 'admin-dashboard';
            } else if (page === 'client') {
                state.currentPage = 'client';
                state.currentClientPage = subpage || 'client-movies';
            } else {
                state.currentPage = page;
            }
            render();
        },
        viewMedia: (type, id) => {
            state.currentMediaView = { type, id };
            render();
        },
        goBack: () => {
            state.currentMediaView = null;
            render();
        }
    };
    
    function render() {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        
        const currentUser = db.getCurrentUser();

        if (currentUser) {
            if (currentUser.role === 'admin') {
                document.getElementById('admin-panel').style.display = 'block';
                renderAdminPanel();
            } else if (currentUser.role === 'client') {
                document.getElementById('client-panel').style.display = 'block';
                renderClientPanel();
            }
        } else {
            document.getElementById('login-page').style.display = 'flex';
        }
    }

    // --- TEMPLATES --- //
    const templates = {
        adminDashboard: () => `
            <div class="admin-page-content">
                <h2>Dashboard</h2>
                <p>Bem-vindo, Administrador! Use o menu à esquerda para gerenciar o conteúdo.</p>
            </div>
        `,
        adminGenerateClient: () => `
            <div class="admin-page-content">
                <h2>Gerar Novo Cliente</h2>
                <div class="form-container">
                    <div class="form-group">
                        <label for="client-desc">Descrição (para sua identificação)</label>
                        <input type="text" id="client-desc" placeholder="Ex: Cliente João da Silva">
                    </div>
                    <button class="btn" id="generate-client-btn">Gerar</button>
                    <div id="generated-creds-container" style="display:none;"></div>
                </div>
            </div>
        `,
        adminClients: () => {
            const clients = db.getUsers().filter(u => u.role === 'client');
            return `
            <div class="admin-page-content">
                <h2>Clientes Cadastrados</h2>
                <div class="content-container client-list">
                    <table>
                        <thead>
                            <tr>
                                <th>Usuário</th>
                                <th>Senha</th>
                                <th>Descrição</th>
                                <th>Expira em</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clients.map(c => `
                                <tr class="${c.isBlocked ? 'blocked' : ''}">
                                    <td>${c.username}</td>
                                    <td>${c.password}</td>
                                    <td class="client-description" data-username="${c.username}"><span>${c.description}</span></td>
                                    <td class="client-expires" data-username="${c.username}"><span>${new Date(c.expiresAt).toLocaleDateString('pt-BR')}</span></td>
                                    <td>${c.isBlocked ? '<span class="status-blocked">Bloqueado</span>' : '<span class="status-active">Ativo</span>'}</td>
                                    <td class="actions-cell">
                                        <button class="action-btn delete-client-btn" title="Excluir" data-username="${c.username}"><i class="fas fa-trash"></i></button>
                                        <button class="action-btn-dropdown" title="Mais Ações" data-username="${c.username}"><i class="fas fa-plus"></i></button>
                                        <div class="actions-menu" data-username="${c.username}">
                                            <button class="menu-btn block-btn" data-username="${c.username}">${c.isBlocked ? '<i class="fas fa-check-circle"></i> Desbloquear' : '<i class="fas fa-ban"></i> Bloquear'}</button>
                                            <button class="menu-btn renew-btn" data-username="${c.username}"><i class="fas fa-calendar-check"></i> Renovar</button>
                                            <button class="menu-btn add-days-btn" data-username="${c.username}"><i class="fas fa-calendar-plus"></i> Add Dias</button>
                                            <button class="menu-btn edit-desc-btn" data-username="${c.username}"><i class="fas fa-pencil-alt"></i> Editar</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `},
        adminConfig: () => {
            const settings = db.getAdminSettings();
            return `
            <div class="admin-page-content">
                <h2>Configurações</h2>
                <div class="form-container">
                    <div class="form-group">
                        <label for="admin-email">Email do Administrador</label>
                        <div class="input-with-button">
                            <input type="email" id="admin-email" placeholder="seu-email@dominio.com" value="${settings.email || ''}">
                            <button class="btn" id="save-email-btn">Salvar</button>
                        </div>
                         <p style="font-size: 0.9em; color: var(--text-muted); margin-top: 10px;">Após salvar, um código de confirmação será enviado para o email informado.</p>
                    </div>
                </div>
            </div>
        `},
        adminCreateReseller: () => `
            <div class="admin-page-content">
                <h2>Criar Novo Revendedor</h2>
                <form class="form-container" id="create-reseller-form">
                    <div class="form-group">
                        <label for="reseller-username">Usuário</label>
                        <div class="input-with-button">
                            <input type="text" id="reseller-username" required>
                            <button type="button" class="btn btn-secondary" id="generate-reseller-user">Gerar</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="reseller-password">Senha</label>
                        <div class="input-with-button">
                            <input type="text" id="reseller-password" required>
                            <button type="button" class="btn btn-secondary" id="generate-reseller-pass">Gerar</button>
                        </div>
                    </div>
                    
                    <h3>Permissões do Painel</h3>
                    <div class="permissions-grid">
                        <div class="permission-item">
                            <input type="checkbox" id="perm-add-movies" data-permission="addMovies">
                            <label for="perm-add-movies">Add Filmes</label>
                        </div>
                        <div class="permission-item">
                            <input type="checkbox" id="perm-add-series" data-permission="addSeries">
                            <label for="perm-add-series">Add Séries</label>
                        </div>
                        <div class="permission-item">
                            <input type="checkbox" id="perm-gen-clients" data-permission="generateClients">
                            <label for="perm-gen-clients">Gerar Clientes</label>
                        </div>
                         <div class="permission-item">
                            <input type="checkbox" id="perm-view-movies" data-permission="viewMovies">
                            <label for="perm-view-movies">Filmes (Gerenciar)</label>
                        </div>
                         <div class="permission-item">
                            <input type="checkbox" id="perm-view-series" data-permission="viewSeries">
                            <label for="perm-view-series">Séries (Gerenciar)</label>
                        </div>
                        <div class="permission-item">
                            <input type="checkbox" id="perm-view-clients" data-permission="viewClients">
                            <label for="perm-view-clients">Clientes</label>
                        </div>
                        <div class="permission-item">
                            <input type="checkbox" id="perm-view-config" data-permission="viewConfig">
                            <label for="perm-view-config">Configurações</label>
                        </div>
                        <div class="permission-item">
                            <input type="checkbox" id="perm-create-resellers" data-permission="createResellers">
                            <label for="perm-create-resellers">Permitir criar revendedores</label>
                        </div>
                    </div>

                    <button type="submit" class="btn">Criar Revendedor</button>
                </form>
            </div>
        `,
        adminAddMovie: (movie = {}) => `
            <div class="admin-page-content">
                <h2>${movie.id ? 'Editar' : 'Adicionar'} Filme</h2>
                <form class="form-container" id="movie-form" data-id="${movie.id || ''}">
                    <div class="add-media-layout">
                        <div class="media-cover-upload">
                            <div class="media-cover-preview">
                                ${movie.cover ? `<img src="${movie.cover}" alt="Capa">` : '<span>Prévia da Capa</span>'}
                            </div>
                            <div class="form-group">
                                <label for="movie-cover">Upload da Capa</label>
                                <input type="file" id="movie-cover" accept="image/*">
                            </div>
                        </div>
                        <div class="media-form-fields">
                            <div class="form-group">
                                <label for="movie-name">Nome do Filme</label>
                                <input type="text" id="movie-name" value="${movie.name || ''}" required>
                            </div>
                            <div class="form-group">
                                <label for="movie-desc">Descrição</label>
                                <textarea id="movie-desc" required>${movie.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="movie-link">Link do Filme</label>
                                <input type="url" id="movie-link" value="${movie.link || ''}" placeholder="Link do Google Drive, YouTube, etc." required>
                            </div>
                        </div>
                    </div>
                    <button type="submit" class="btn">Salvar Filme</button>
                </form>
            </div>
        `,
        adminAddSeries: (series = { seasons: [] }) => `
            <div class="admin-page-content">
                <h2>${series.id ? 'Editar' : 'Adicionar'} Série</h2>
                 <form class="form-container" id="series-form" data-id="${series.id || ''}">
                    <div class="add-media-layout">
                         <div class="media-cover-upload">
                            <div class="media-cover-preview">
                                ${series.cover ? `<img src="${series.cover}" alt="Capa">` : '<span>Prévia da Capa</span>'}
                            </div>
                            <div class="form-group">
                                <label for="series-cover">Upload da Capa</label>
                                <input type="file" id="series-cover" accept="image/*">
                            </div>
                        </div>
                        <div class="media-form-fields">
                            <div class="form-group">
                                <label for="series-name">Nome da Série</label>
                                <input type="text" id="series-name" value="${series.name || ''}" required>
                            </div>
                            <div class="form-group">
                                <label for="series-desc">Descrição</label>
                                <textarea id="series-desc" required>${series.description || ''}</textarea>
                            </div>
                        </div>
                    </div>

                    <h3 style="margin-top: 20px; margin-bottom: 10px;">Temporadas</h3>
                    <div id="seasons-container">
                        ${series.seasons.map((season, sIndex) => templates.seasonBlock(season, sIndex)).join('')}
                    </div>
                    <button type="button" class="btn btn-secondary" id="add-season-btn">Adicionar Temporada</button>
                    <hr style="margin: 20px 0;">
                    <button type="submit" class="btn">Salvar Série</button>
                </form>
            </div>
        `,
        adminMoviesList: () => {
            const movies = db.getMovies();
            return `
            <div class="admin-page-content">
                <h2>Gerenciar Filmes</h2>
                <div class="content-container">
                    ${movies.length > 0 ? `
                    <ul class="media-manage-list">
                        ${movies.map(m => `
                        <li>
                            <img src="${m.cover}" alt="${m.name}">
                            <div class="media-info">
                                <strong>${m.name}</strong>
                            </div>
                            <div class="media-actions">
                                <button class="btn-secondary" onclick="app.editMovie('${m.id}')">Editar</button>
                                <button class="btn-danger" onclick="app.deleteMovie('${m.id}')">Excluir</button>
                            </div>
                        </li>
                        `).join('')}
                    </ul>` : '<p>Nenhum filme cadastrado.</p>' }
                </div>
            </div>`;
        },
        adminSeriesList: () => {
            const series = db.getSeries();
            return `
            <div class="admin-page-content">
                <h2>Gerenciar Séries</h2>
                <div class="content-container">
                     ${series.length > 0 ? `
                    <ul class="media-manage-list">
                        ${series.map(s => `
                        <li>
                            <img src="${s.cover}" alt="${s.name}">
                            <div class="media-info">
                                <strong>${s.name}</strong>
                            </div>
                            <div class="media-actions">
                                <button class="btn-secondary" onclick="app.editSeries('${s.id}')">Editar</button>
                                <button class="btn-danger" onclick="app.deleteSeries('${s.id}')">Excluir</button>
                            </div>
                        </li>
                        `).join('')}
                    </ul>` : '<p>Nenhuma série cadastrada.</p>' }
                </div>
            </div>`;
        },
        seasonBlock: (season, sIndex) => `
            <div class="season-block" data-season-index="${sIndex}">
                <div class="season-header">
                    <h4>Temporada ${sIndex + 1}</h4>
                    <button type="button" class="btn-secondary remove-season-btn">Remover Temporada</button>
                </div>
                <div class="episodes-container">
                    ${season.episodes.map((ep, eIndex) => templates.episodeBlock(ep, sIndex, eIndex)).join('')}
                </div>
                <button type="button" class="btn-secondary add-episode-btn" style="margin-top:10px;">Adicionar Episódio</button>
            </div>
        `,
        episodeBlock: (episode, sIndex, eIndex) => `
            <div class="episode-block" data-episode-index="${eIndex}">
                <div class="form-group">
                    <label>Episódio ${eIndex + 1}: Link do Vídeo</label>
                    <div style="display:flex; gap:10px;">
                        <input type="url" class="episode-link" value="${episode.link || ''}" placeholder="Link do episódio" required style="flex-grow:1;">
                        <button type="button" class="btn-secondary remove-episode-btn">Remover</button>
                    </div>
                </div>
            </div>
        `,
        
        clientMovies: (movies) => `
            <h2>Filmes</h2>
            <div class="media-grid">
                ${movies.length === 0 ? '<p>Nenhum filme encontrado.</p>' : movies.map(movie => `
                    <div class="media-card" data-type="movie" data-id="${movie.id}">
                        <img src="${movie.cover}" alt="${movie.name}">
                        <p>${movie.name}</p>
                    </div>
                `).join('')}
            </div>
        `,
        clientSeries: (series) => `
             <h2>Séries</h2>
            <div class="media-grid">
                 ${series.length === 0 ? '<p>Nenhuma série encontrada.</p>' : series.map(s => `
                    <div class="media-card" data-type="series" data-id="${s.id}">
                        <img src="${s.cover}" alt="${s.name}">
                        <p>${s.name}</p>
                    </div>
                `).join('')}
            </div>
        `,
        mediaDetail: (media, type) => {
            const isMovie = type === 'movie';
            return `
                <button class="back-button"><i class="fas fa-arrow-left"></i> Voltar ao catálogo</button>
                <div class="detail-page-layout">
                    <div class="detail-cover">
                        <img src="${media.cover}" alt="${media.name}">
                    </div>
                    <div class="detail-info">
                        <h2>${media.name}</h2>
                        <p>${media.description}</p>
                        ${isMovie ? 
                            `<button id="play-button" class="btn">Play</button>` : 
                            `<div class="seasons-container">
                                <div class="season-tabs">
                                    ${media.seasons.map((s, i) => `<button data-season="${i}">${`Temporada ${i + 1}`}</button>`).join('')}
                                </div>
                                <div class="episode-buttons"></div>
                            </div>`
                        }
                    </div>
                </div>
                <div id="video-player-container"></div>
            `;
        }
    };

    // --- RENDER FUNCTIONS --- //
    function renderAdminPanel() {
        const contentEl = document.getElementById('admin-content');
        const page = state.currentAdminPage;
        
        document.querySelectorAll('.admin-sidebar nav button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });

        if (page === 'admin-dashboard') contentEl.innerHTML = templates.adminDashboard();
        if (page === 'admin-generate-client') contentEl.innerHTML = templates.adminGenerateClient();
        if (page === 'admin-clients') contentEl.innerHTML = templates.adminClients();
        if (page === 'admin-add-movie') contentEl.innerHTML = templates.adminAddMovie();
        if (page === 'admin-add-series') contentEl.innerHTML = templates.adminAddSeries();
        if (page === 'admin-movies-list') contentEl.innerHTML = templates.adminMoviesList();
        if (page === 'admin-series-list') contentEl.innerHTML = templates.adminSeriesList();
        if (page === 'admin-config') contentEl.innerHTML = templates.adminConfig();
        if (page === 'admin-create-reseller') contentEl.innerHTML = templates.adminCreateReseller();
    }

    function renderClientPanel() {
        const contentEl = document.getElementById('client-content');
        
        document.querySelectorAll('.client-header nav button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === state.currentClientPage);
        });
        
        const searchInput = document.getElementById('search-input');
        searchInput.value = state.currentSearchQuery;
        
        if (state.currentMediaView) {
            const { type, id } = state.currentMediaView;
            const collection = type === 'movie' ? db.getMovies() : db.getSeries();
            const media = collection.find(m => m.id === id);
            if(media) {
                contentEl.innerHTML = templates.mediaDetail(media, type);
                if (type === 'series' && media.seasons.length > 0) {
                     // Auto-select first season
                    document.querySelector('.season-tabs button[data-season="0"]')?.classList.add('active');
                    renderEpisodeButtons(media, 0);
                }
            } else {
                 contentEl.innerHTML = `<p>Conteúdo não encontrado.</p><button class="back-button"><i class="fas fa-arrow-left"></i> Voltar</button>`;
            }
        } else {
            const query = state.currentSearchQuery.toLowerCase();

            if (state.currentClientPage === 'client-movies') {
                const movies = db.getMovies().filter(m => m.name.toLowerCase().includes(query));
                contentEl.innerHTML = templates.clientMovies(movies);
                searchInput.placeholder = 'Buscar por filmes...';
            }
            if (state.currentClientPage === 'client-series') {
                const series = db.getSeries().filter(s => s.name.toLowerCase().includes(query));
                contentEl.innerHTML = templates.clientSeries(series);
                searchInput.placeholder = 'Buscar por séries...';
            }
        }
    }
    
    function renderEpisodeButtons(series, seasonIndex) {
        const container = document.querySelector('.episode-buttons');
        if (!container) return;
        const episodes = series.seasons[seasonIndex].episodes;
        container.innerHTML = episodes.map((ep, i) => `<button data-link="${ep.link}">${`Ep ${i+1}`}</button>`).join('');
    }

    // --- EVENT LISTENERS --- //
    function setupEventListeners() {
        const appEl = document.getElementById('app');

        // Login
        document.getElementById('login-form').addEventListener('submit', handleLogin);

        appEl.addEventListener('click', (e) => {
            const target = e.target;
            
            // Logout
            if (target.id === 'admin-logout-btn' || target.id === 'client-logout-btn') handleLogout();

            // Admin Navigation
            if (target.closest('.admin-sidebar nav button')) {
                router.navigate('admin', target.closest('.admin-sidebar nav button').dataset.page);
            }
            
            // Admin Actions
            if (target.id === 'generate-client-btn') handleGenerateClient();
            if (target.classList.contains('delete-client-btn') || target.parentElement.classList.contains('delete-client-btn')) {
                const username = target.dataset.username || target.parentElement.dataset.username;
                if (confirm(`Tem certeza que deseja deletar o cliente ${username}?`)) {
                    handleDeleteClient(username);
                }
            }

            // Admin Client List Actions
            if (target.closest('.action-btn-dropdown')) handleClientActionDropdown(target.closest('.action-btn-dropdown').dataset.username);
            if (target.classList.contains('block-btn')) handleBlockToggle(target.dataset.username);
            if (target.classList.contains('renew-btn')) handleRenewClient(target.dataset.username);
            if (target.classList.contains('add-days-btn')) handleAddDaysPrompt(target.dataset.username);
            if (target.classList.contains('edit-desc-btn')) handleEditDescriptionPrompt(target.dataset.username);
            
            // Admin Config / Reseller Actions
            if (target.id === 'save-email-btn') handleSaveAdminEmail();
            if (target.id === 'generate-reseller-user') handleGenerateResellerUser();
            if (target.id === 'generate-reseller-pass') handleGenerateResellerPassword();

            // Close dropdown if clicked outside
            if (!target.closest('.actions-cell')) {
                document.querySelectorAll('.actions-menu.show').forEach(menu => menu.classList.remove('show'));
            }
            
            // Series Form Actions
            if(target.id === 'add-season-btn') handleAddSeason();
            if(target.closest('.add-episode-btn')) handleAddEpisode(target.closest('.season-block').dataset.seasonIndex);
            if(target.closest('.remove-season-btn')) handleRemoveSeason(target.closest('.season-block').dataset.seasonIndex);
            if(target.closest('.remove-episode-btn')) handleRemoveEpisode(target.closest('.season-block').dataset.seasonIndex, target.closest('.episode-block').dataset.episodeIndex);
            
            // Client Navigation
            if (target.closest('.client-header nav button')) {
                state.currentSearchQuery = '';
                router.navigate('client', target.closest('.client-header nav button').dataset.page);
            }
            
            // Client View Media
            if(target.closest('.media-card')) {
                const card = target.closest('.media-card');
                router.viewMedia(card.dataset.type, card.dataset.id);
            }
            
            // Client Back Button
            if(target.closest('.back-button')) router.goBack();
            
            // Client Play Movie
            if(target.id === 'play-button') {
                const { id } = state.currentMediaView;
                const movie = db.getMovies().find(m => m.id === id);
                if(movie) playVideo(movie.link);
            }
            
            // Client Series Season/Episode Selection
            if(target.closest('.season-tabs button')) {
                const seasonBtn = target.closest('.season-tabs button');
                document.querySelectorAll('.season-tabs button').forEach(b => b.classList.remove('active'));
                seasonBtn.classList.add('active');
                const {id} = state.currentMediaView;
                const series = db.getSeries().find(s => s.id === id);
                renderEpisodeButtons(series, seasonBtn.dataset.season);
                document.getElementById('video-player-container').innerHTML = ''; // Clear player
            }
            if(target.closest('.episode-buttons button')) {
                const epBtn = target.closest('.episode-buttons button');
                document.querySelectorAll('.episode-buttons button').forEach(b => b.classList.remove('active'));
                epBtn.classList.add('active');
                playVideo(epBtn.dataset.link);
            }

            // Client Search
            if(target.closest('#search-btn')) {
                state.currentSearchQuery = document.getElementById('search-input').value;
                renderClientPanel();
            }
        });
        
        document.getElementById('search-input').addEventListener('keyup', e => {
            if (e.key === 'Enter') {
                state.currentSearchQuery = e.target.value;
                renderClientPanel();
            }
        });

        appEl.addEventListener('submit', (e) => {
            if(e.target.id === 'movie-form') {
                e.preventDefault();
                handleSaveMovie(e.target.dataset.id);
            }
            if(e.target.id === 'series-form') {
                e.preventDefault();
                handleSaveSeries(e.target.dataset.id);
            }
            if(e.target.id === 'create-reseller-form') {
                e.preventDefault();
                handleCreateReseller();
            }
        });
        
        appEl.addEventListener('change', e => {
            if (e.target.id === 'movie-cover' || e.target.id === 'series-cover') {
                handleCoverPreview(e.target);
            }
        });
    }

    // --- HANDLERS --- //
    function handleLogin(e) {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';

        // Admin login
        if (username.toLowerCase() === 'admin' && password === '36365852') {
            db.setCurrentUser({ username: 'admin', role: 'admin' });
            router.navigate('admin');
            return;
        }

        // Client login
        const users = db.getUsers();
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            if (user.isBlocked) {
                errorEl.textContent = 'Sua conta está bloqueada.';
                return;
            }
            if (new Date(user.expiresAt) > new Date()) {
                db.setCurrentUser(user);
                router.navigate('client');
            } else {
                errorEl.textContent = 'Sua assinatura expirou.';
            }
        } else {
            errorEl.textContent = 'Usuário ou senha inválidos.';
        }
    }

    function handleLogout() {
        db.clearCurrentUser();
        router.navigate('login');
    }

    function handleSaveAdminEmail() {
        const emailInput = document.getElementById('admin-email');
        const email = emailInput.value.trim();

        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            const settings = db.getAdminSettings();
            settings.email = email;
            db.setAdminSettings(settings);
            alert(`Um código de confirmação foi enviado para ${email}.`);
        } else {
            alert("Por favor, insira um endereço de email válido.");
        }
    }
    
    function handleGenerateResellerUser() {
        // Generates a random 6-digit number as username
        const userInput = document.getElementById('reseller-username');
        userInput.value = Math.floor(100000 + Math.random() * 900000).toString();
    }
    
    function handleGenerateResellerPassword() {
        // Generates a random 8-character alphanumeric password
        const passInput = document.getElementById('reseller-password');
        passInput.value = Math.random().toString(36).slice(-8);
    }
    
    function handleCreateReseller() {
        const form = document.getElementById('create-reseller-form');
        const username = document.getElementById('reseller-username').value.trim();
        const password = document.getElementById('reseller-password').value.trim();
        
        if (!username || !password) {
            alert('Usuário e senha são obrigatórios.');
            return;
        }

        const users = db.getUsers();
        if (users.some(u => u.username === username)) {
            alert('Este nome de usuário já existe. Por favor, escolha outro.');
            return;
        }

        const permissions = {};
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (checkbox.checked) {
                permissions[checkbox.dataset.permission] = true;
            }
        });

        const newReseller = {
            username,
            password,
            role: 'reseller',
            permissions,
        };

        users.push(newReseller);
        db.setUsers(users);

        alert(`Revendedor "${username}" criado com sucesso!`);
        form.reset(); // Clear the form
    }

    function handleGenerateClient() {
        const description = document.getElementById('client-desc').value.trim();
        if (!description) {
            alert('Por favor, insira uma descrição.');
            return;
        }

        const users = db.getUsers();
        let newUser;
        do {
            newUser = {
                username: Math.floor(10000 + Math.random() * 90000).toString(),
                password: Math.floor(10000 + Math.random() * 90000).toString(),
            };
        } while (users.some(u => u.username === newUser.username));

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 31);

        const client = {
            ...newUser,
            description,
            role: 'client',
            expiresAt: expiryDate.toISOString(),
            isBlocked: false, // Add isBlocked property
        };

        users.push(client);
        db.setUsers(users);

        document.getElementById('generated-creds-container').innerHTML = `
            <div class="generated-creds">
                <p>Usuário: <span>${client.username}</span></p>
                <p>Senha: <span>${client.password}</span></p>
                <p>Válido até: <span>${expiryDate.toLocaleDateString('pt-BR')}</span></p>
            </div>`;
        document.getElementById('generated-creds-container').style.display = 'block';
        document.getElementById('client-desc').value = '';
    }

    function handleDeleteClient(username) {
        let users = db.getUsers();
        users = users.filter(u => u.username !== username);
        db.setUsers(users);
        router.navigate('admin', 'admin-clients'); // Re-render the client list
    }

    function handleClientActionDropdown(username) {
        const allMenus = document.querySelectorAll('.actions-menu');
        const targetMenu = document.querySelector(`.actions-menu[data-username="${username}"]`);
        
        // Hide other menus
        allMenus.forEach(menu => {
            if (menu !== targetMenu) {
                menu.classList.remove('show');
            }
        });
        
        // Toggle target menu
        targetMenu.classList.toggle('show');
    }

    function handleBlockToggle(username) {
        let users = db.getUsers();
        const user = users.find(u => u.username === username);
        if (user) {
            user.isBlocked = !user.isBlocked;
            db.setUsers(users);
            render(); // Re-render the admin panel
        }
    }

    function handleRenewClient(username) {
        let users = db.getUsers();
        const user = users.find(u => u.username === username);
        if (user) {
            const newExpiry = new Date(user.expiresAt);
            newExpiry.setDate(newExpiry.getDate() + 31);
            user.expiresAt = newExpiry.toISOString();
            db.setUsers(users);
            render();
        }
    }

    function handleAddDaysPrompt(username) {
        const currentCell = document.querySelector(`.client-expires[data-username="${username}"]`);
        const days = prompt("Quantos dias deseja adicionar?", "30");
        if (days !== null && !isNaN(parseInt(days))) {
            let users = db.getUsers();
            const user = users.find(u => u.username === username);
            if (user) {
                const newExpiry = new Date(user.expiresAt);
                newExpiry.setDate(newExpiry.getDate() + parseInt(days));
                user.expiresAt = newExpiry.toISOString();
                db.setUsers(users);
                render();
            }
        } else if (days !== null) {
            alert("Por favor, insira um número válido.");
        }
    }
    
    function handleEditDescriptionPrompt(username) {
        let users = db.getUsers();
        const user = users.find(u => u.username === username);
        if (!user) return;
        
        const newDescription = prompt("Editar descrição:", user.description);
        
        if (newDescription !== null && newDescription.trim() !== '') {
            user.description = newDescription.trim();
            db.setUsers(users);
            render();
        } else if (newDescription !== null) {
            alert("A descrição não pode ficar em branco.");
        }
    }
    
    async function handleSaveMovie(id) {
        const name = document.getElementById('movie-name').value;
        const description = document.getElementById('movie-desc').value;
        const link = document.getElementById('movie-link').value;
        const coverFile = document.getElementById('movie-cover').files[0];

        let coverUrl = document.querySelector('.media-cover-preview img')?.src || '';

        if (coverFile) {
            coverUrl = await toBase64(coverFile);
        }
        
        if(!coverUrl) {
            alert('Por favor, adicione uma imagem de capa.');
            return;
        }

        let movies = db.getMovies();
        const movieData = { id: id || `movie_${Date.now()}`, name, description, link, cover: coverUrl };
        
        if (id) {
            movies = movies.map(m => m.id === id ? movieData : m);
        } else {
            movies.push(movieData);
        }
        db.setMovies(movies);
        alert('Filme salvo com sucesso!');
        router.navigate('admin', 'admin-movies-list');
    }

    async function handleSaveSeries(id) {
        const name = document.getElementById('series-name').value;
        const description = document.getElementById('series-desc').value;
        const coverFile = document.getElementById('series-cover').files[0];
        
        let coverUrl = document.querySelector('.media-cover-preview img')?.src || '';
        if (coverFile) coverUrl = await toBase64(coverFile);

        if(!coverUrl) {
            alert('Por favor, adicione uma imagem de capa.');
            return;
        }

        const seasons = [];
        document.querySelectorAll('.season-block').forEach(seasonEl => {
            const episodes = [];
            seasonEl.querySelectorAll('.episode-link').forEach(epEl => {
                if (epEl.value) episodes.push({ link: epEl.value });
            });
            if(episodes.length > 0) seasons.push({ episodes });
        });
        
        if(seasons.length === 0) {
            alert('Adicione pelo menos uma temporada e um episódio.');
            return;
        }
        
        let seriesList = db.getSeries();
        const seriesData = { id: id || `series_${Date.now()}`, name, description, cover: coverUrl, seasons };
        
        if (id) {
            seriesList = seriesList.map(s => s.id === id ? seriesData : s);
        } else {
            seriesList.push(seriesData);
        }
        db.setSeries(seriesList);
        alert('Série salva com sucesso!');
        router.navigate('admin', 'admin-series-list');
    }
    
    function handleCoverPreview(input) {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewContainer = input.closest('.media-cover-upload').querySelector('.media-cover-preview');
                previewContainer.innerHTML = `<img src="${e.target.result}" alt="Prévia da capa">`;
            };
            reader.readAsDataURL(file);
        }
    }
    
    function handleAddSeason() {
        const container = document.getElementById('seasons-container');
        const sIndex = container.children.length;
        const newSeason = { episodes: [{ link: '' }] };
        container.insertAdjacentHTML('beforeend', templates.seasonBlock(newSeason, sIndex));
    }
    
    function handleAddEpisode(sIndex) {
        const seasonBlock = document.querySelector(`.season-block[data-season-index="${sIndex}"]`);
        const container = seasonBlock.querySelector('.episodes-container');
        const eIndex = container.children.length;
        container.insertAdjacentHTML('beforeend', templates.episodeBlock({link: ''}, sIndex, eIndex));
    }
    
    function handleRemoveSeason(sIndex) {
        document.querySelector(`.season-block[data-season-index="${sIndex}"]`).remove();
        // Re-index subsequent seasons
        document.querySelectorAll('.season-block').forEach((block, newIndex) => {
            block.dataset.seasonIndex = newIndex;
            block.querySelector('h4').textContent = `Temporada ${newIndex + 1}`;
        });
    }

    function handleRemoveEpisode(sIndex, eIndex) {
        const seasonBlock = document.querySelector(`.season-block[data-season-index="${sIndex}"]`);
        seasonBlock.querySelector(`.episode-block[data-episode-index="${eIndex}"]`).remove();
        // Re-index subsequent episodes
        seasonBlock.querySelectorAll('.episode-block').forEach((block, newIndex) => {
            block.dataset.episodeIndex = newIndex;
            block.querySelector('label').textContent = `Episódio ${newIndex + 1}: Link do Vídeo`;
        });
    }

    function playVideo(url) {
        const container = document.getElementById('video-player-container');
        let embedUrl = '';

        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
        } else if (url.includes('drive.google.com')) {
            embedUrl = url.replace('/view', '/preview').replace('?usp=sharing', '');
        } else {
            // For Dropbox, Archive.org, Pixeldrain, Terabox, a direct iframe might work
            // or they might need more specific embedding logic. This is a generic fallback.
            embedUrl = url;
        }

        container.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
        container.scrollIntoView({ behavior: 'smooth' });
    }
    
    // --- HELPERS --- //
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    // --- INITIALIZATION --- //
    function init() {
        db.initAdmin();
        setupEventListeners();
        render();
    }

    init();
});