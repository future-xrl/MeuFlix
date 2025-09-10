import * as db from './db.js';
const room = new WebsimSocket();

const ADMIN_PASSWORD = '36365852';

let stagedChanges = {
    codes: [],
    movies: [],
    series: []
};
let dbCache = {
    codes: [],
    movies: [],
    series: []
};

document.addEventListener('DOMContentLoaded', () => {
    const passwordPrompt = document.getElementById('admin-password-prompt');
    const adminPanel = document.getElementById('admin-panel');
    const passwordForm = document.getElementById('admin-password-form');
    const passwordInput = document.getElementById('admin-password');
    const errorMessage = document.getElementById('admin-error-message');

    // --- Authentication ---
    const checkLogin = () => {
        if (sessionStorage.getItem('isAdmin') === 'true') {
            passwordPrompt.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            setupAdminPanel();
        }
    };

    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (passwordInput.value === ADMIN_PASSWORD) {
            sessionStorage.setItem('isAdmin', 'true');
            checkLogin();
        } else {
            errorMessage.textContent = 'Senha incorreta.';
        }
    });

    // --- Panel Setup ---
    const setupAdminPanel = () => {
        const navButtons = document.querySelectorAll('.nav-btn');
        const sections = document.querySelectorAll('.admin-section');
        const logoutBtn = document.getElementById('logout-btn');
        const publishBtn = document.getElementById('publish-btn');
        const loadingIndicator = document.getElementById('loading-indicator');

        // Show loading indicator while fetching data
        loadingIndicator.classList.remove('hidden');
        adminPanel.querySelector('main').classList.add('hidden');

        // Subscribe to all data changes
        room.collection('codes').subscribe(codes => {
            dbCache.codes = codes;
            if(document.getElementById('my-tests').classList.contains('hidden') === false) renderTestsList();
            if(document.getElementById('activated-codes').classList.contains('hidden') === false) renderActivatedCodesList();
            if(document.getElementById('expired-codes').classList.contains('hidden') === false) renderExpiredCodesList();
        });
        room.collection('movies').subscribe(movies => {
            dbCache.movies = movies;
            if(document.getElementById('add-movie').classList.contains('hidden') === false) renderMoviesList();
        });
        room.collection('series').subscribe(series => {
            dbCache.series = series;
            if(document.getElementById('add-series').classList.contains('hidden') === false) renderSeriesList();
        });
        room.collection('requests').subscribe(requests => {
            dbCache.requests = requests;
            if(document.getElementById('message-box').classList.contains('hidden') === false) renderRequestsList();
        });

        // Initial fetch to hide loader
        Promise.all([
            room.collection('codes').getList(true),
            room.collection('movies').getList(true),
            room.collection('series').getList(true),
            room.collection('requests').getList(true),
        ]).then(([codes, movies, series, requests]) => {
             dbCache = { codes, movies, series, requests };
             loadingIndicator.classList.add('hidden');
             adminPanel.querySelector('main').classList.remove('hidden');
             // Render the default view
             switchView('generate-code');
        });

        const updatePublishNotification = () => {
            const pendingCount = stagedChanges.codes.length + stagedChanges.movies.length + stagedChanges.series.length;
            const notification = document.getElementById('publish-notification');
            if (pendingCount > 0) {
                notification.textContent = pendingCount;
                notification.classList.remove('hidden');
            } else {
                notification.classList.add('hidden');
            }
        };

        publishBtn.addEventListener('click', async () => {
            if (stagedChanges.codes.length === 0 && stagedChanges.movies.length === 0 && stagedChanges.series.length === 0) {
                alert('Não há alterações pendentes para publicar.');
                return;
            }

            publishBtn.disabled = true;
            publishBtn.textContent = 'Publicando...';

            try {
                // Create promises for all database operations
                const creationPromises = [
                    ...stagedChanges.codes.map(code => room.collection('codes').create(code)),
                    ...stagedChanges.movies.map(movie => room.collection('movies').create(movie)),
                    ...stagedChanges.series.map(series => room.collection('series').create(series)),
                ];

                await Promise.all(creationPromises);
                
                stagedChanges = { codes: [], movies: [], series: [] };
                updatePublishNotification();

                alert('Alterações publicadas com sucesso!');
            } catch (error) {
                console.error("Publishing error: ", error);
                alert('Ocorreu um erro ao publicar as alterações. Verifique o console.');
            } finally {
                publishBtn.disabled = false;
                publishBtn.querySelector('span').insertAdjacentText('beforebegin', 'Publicar');
                publishBtn.textContent = 'Publicar';
            }
        });

        const switchView = (targetId) => {
            sections.forEach(section => section.classList.add('hidden'));
            document.getElementById(targetId)?.classList.remove('hidden');
            
            navButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector(`.nav-btn[data-target="${targetId}"]`)?.classList.add('active');
            
            if (targetId === 'my-tests') renderTestsList();
            if (targetId === 'activated-codes') renderActivatedCodesList();
            if (targetId === 'expired-codes') renderExpiredCodesList();
            if (targetId === 'add-movie') renderMoviesList();
            if (targetId === 'add-series') renderSeriesList();
            if (targetId === 'message-box') renderRequestsList();
        };

        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                switchView(button.dataset.target);
            });
        });

        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('isAdmin');
            window.location.reload();
        });
        
        // Add listener for the new search bar
        const activatedCodesSearchInput = document.getElementById('activated-codes-search');
        activatedCodesSearchInput.addEventListener('input', renderActivatedCodesList);

        const testsSearchInput = document.getElementById('tests-search-input');
        testsSearchInput.addEventListener('input', renderTestsList);

        const expiredCodesSearchInput = document.getElementById('expired-codes-search-input');
        expiredCodesSearchInput.addEventListener('input', renderExpiredCodesList);

        // Add listener for the new movie search bar
        const movieSearchInput = document.getElementById('admin-movie-search-input');
        movieSearchInput.addEventListener('input', renderMoviesList);

        // Add listener for the new series search bar
        const seriesSearchInput = document.getElementById('admin-series-search-input');
        seriesSearchInput.addEventListener('input', renderSeriesList);

        setupCodeGeneration(updatePublishNotification);
        setupMovieForm(updatePublishNotification);
        setupSeriesForm(updatePublishNotification);
        setupInfoModal();
        updatePublishNotification(); // Initial check
    };

    // --- Message Box / Requests ---
    const renderRequestsList = () => {
        const listContainer = document.getElementById('requests-list');
        listContainer.innerHTML = '';
        const allRequests = dbCache.requests || [];

        if (allRequests.length === 0) {
            listContainer.innerHTML = '<p>Nenhum pedido foi feito ainda.</p>';
            return;
        }

        // Aggregate requests by title
        const aggregatedRequests = allRequests.reduce((acc, request) => {
            const title = request.title.trim();
            if (!acc[title]) {
                acc[title] = { count: 0, ids: [] };
            }
            acc[title].count++;
            acc[title].ids.push(request.id);
            return acc;
        }, {});

        // Convert to array and sort by count
        const sortedRequests = Object.entries(aggregatedRequests)
            .map(([title, data]) => ({ title, ...data }))
            .sort((a, b) => b.count - a.count);

        sortedRequests.forEach(request => {
            const item = document.createElement('div');
            item.className = 'test-item'; // Reusing style
            item.innerHTML = `
                <div class="info">
                    <strong>${request.title}</strong>
                    <p>Total de Pedidos: <strong>${request.count}</strong></p>
                </div>
                <div class="actions">
                    <button class="delete-request-btn" data-title="${request.title}">Excluir Pedidos</button>
                    <button class="notify-btn" data-title="${request.title}">Pedido Adicionado</button>
                </div>
            `;
            listContainer.appendChild(item);
        });

        // Attach event listeners
        listContainer.querySelectorAll('.notify-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const title = e.target.dataset.title;
                if (!confirm(`Enviar notificação de que "${title}" foi adicionado?`)) {
                    return;
                }

                e.target.disabled = true;
                e.target.textContent = 'Enviando...';

                try {
                    const allDbRequests = dbCache.requests || [];
                    const relevantRequests = allDbRequests.filter(r => r.title === title);
                    const uniqueCodes = [...new Set(relevantRequests.map(r => r.requestedByCode))];

                    if (uniqueCodes.length === 0) {
                        alert("Nenhum usuário para notificar.");
                        return;
                    }

                    const notificationPromises = uniqueCodes.map(code => {
                        return room.collection('notifications').create({
                            code: code,
                            message: `Seu pedido para "${title}" foi adicionado com sucesso!`,
                            createdAt: Date.now(),
                            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
                        });
                    });

                    await Promise.all(notificationPromises);
                    alert(`${uniqueCodes.length} usuário(s) notificado(s) com sucesso.`);

                } catch (error) {
                    console.error('Error sending notifications:', error);
                    alert('Ocorreu um erro ao enviar as notificações.');
                } finally {
                     e.target.disabled = false;
                     e.target.textContent = 'Pedido Adicionado';
                }
            });
        });

        listContainer.querySelectorAll('.delete-request-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const title = e.target.dataset.title;
                if (confirm(`Tem certeza que deseja excluir todos os pedidos para "${title}"?`)) {
                    const requestsToDelete = (dbCache.requests || []).filter(r => r.title === title);
                    const deletePromises = requestsToDelete.map(r => room.collection('requests').delete(r.id));
                    
                    e.target.disabled = true;
                    e.target.textContent = 'Excluindo...';
                    
                    try {
                        await Promise.all(deletePromises);
                        alert(`Pedidos para "${title}" excluídos com sucesso.`);
                    } catch (error) {
                        console.error('Error deleting requests:', error);
                        alert('Ocorreu um erro ao excluir os pedidos.');
                    }
                }
            });
        });
    };

    // --- Code Generation ---
    const setupCodeGeneration = (updatePublishNotification) => {
        const form = document.getElementById('generate-code-form');
        const descriptionInput = document.getElementById('code-description');
        const resultBox = document.getElementById('generated-code-result');
        const newCodeEl = document.getElementById('new-code');
        const expiryEl = document.getElementById('new-code-expiry');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const description = descriptionInput.value.trim();
            const newCode = {
                code: 'ST' + Date.now().toString().slice(-8),
                description,
                createdAt: Date.now(),
                expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
                status: 'Teste' // Add status
            };

            stagedChanges.codes.push(newCode);
            updatePublishNotification();

            newCodeEl.textContent = `${newCode.code} (Pendente)`;
            expiryEl.textContent = new Date(newCode.expiresAt).toLocaleString('pt-BR');
            resultBox.classList.remove('hidden');
            form.reset();
            alert('Código gerado e pronto para ser publicado.');
        });
    };
    
    // --- My Tests View ---
    const renderTestsList = () => {
        const searchInput = document.getElementById('tests-search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const listContainer = document.getElementById('tests-list');
        listContainer.innerHTML = '';
        const now = new Date().getTime();
        
        let testCodes = [...dbCache.codes]
            .filter(code => now < code.expiresAt && (!code.status || code.status === 'Teste'));

        if (searchTerm) {
            testCodes = testCodes.filter(code => {
                const codeMatch = code.code.toLowerCase().includes(searchTerm);
                const descriptionMatch = code.description && code.description.toLowerCase().includes(searchTerm);
                return codeMatch || descriptionMatch;
            });
        }

        testCodes.sort((a, b) => b.createdAt - a.createdAt);

        if (testCodes.length === 0) {
            listContainer.innerHTML = searchTerm
                ? '<p>Nenhum código corresponde à sua pesquisa.</p>'
                : '<p>Nenhum código de teste ativo encontrado.</p>';
            return;
        }

        testCodes.forEach(code => {
            const item = document.createElement('div');
            item.className = 'test-item';

            const expiryDate = new Date(code.expiresAt).toLocaleString('pt-BR');
            
            item.innerHTML = `
                <div class="info">
                    <strong>Código: ${code.code}</strong>
                    <p>Descrição: <span class="desc">${code.description}</span></p>
                    <p>Expira em: <span>${expiryDate}</span></p>
                    <p>Status: <span style="color: #e87c03; font-weight: bold;">${code.status || 'Teste'}</span></p>
                </div>
                <div class="actions">
                    <select class="extend-select" data-id="${code.id}">
                        <option value="">Estender...</option>
                        <option value="10">10 dias</option>
                        <option value="20">20 dias</option>
                        <option value="30">30 dias</option>
                        <option value="60">60 dias</option>
                        <option value="90">90 dias</option>
                        <option value="180">180 dias</option>
                        <option value="400">400 dias</option>
                    </select>
                    <button class="edit-btn" data-id="${code.id}">Editar Desc.</button>
                    <button class="delete-btn" data-id="${code.id}">Excluir</button>
                </div>
            `;
            listContainer.appendChild(item);
        });
        
        attachTestListListeners();
    };

    const renderActivatedCodesList = () => {
        const searchInput = document.getElementById('activated-codes-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const listContainer = document.getElementById('activated-codes-list');
        listContainer.innerHTML = '';
        const now = new Date().getTime();
        const fiveDaysFromNow = now + (5 * 24 * 60 * 60 * 1000);

        let activatedCodes = [...dbCache.codes]
            .filter(code => now < code.expiresAt && code.status === 'Ativo');

        if (searchTerm) {
            activatedCodes = activatedCodes.filter(code => {
                const codeMatch = code.code.toLowerCase().includes(searchTerm);
                const nameMatch = code.clientName && code.clientName.toLowerCase().includes(searchTerm);
                const descriptionMatch = code.description && code.description.toLowerCase().includes(searchTerm);
                return codeMatch || nameMatch || descriptionMatch;
            });
        }
        
        activatedCodes.sort((a, b) => a.expiresAt - b.expiresAt); // Sort by soonest to expire

        if (activatedCodes.length === 0) {
            listContainer.innerHTML = searchTerm 
                ? '<p>Nenhum código corresponde à sua pesquisa.</p>'
                : '<p>Nenhum código ativado no momento.</p>';
            return;
        }

        activatedCodes.forEach(code => {
            const item = document.createElement('div');
            item.className = 'test-item';
            if (code.expiresAt < fiveDaysFromNow) {
                item.classList.add('expiring-soon');
            }
            const expiryDate = new Date(code.expiresAt).toLocaleString('pt-BR');
            const clientInfo = [
                code.clientName ? `Nome: ${code.clientName}` : '',
                code.clientWhatsapp ? `Whatsapp: ${code.clientWhatsapp}` : '',
                code.clientTelegram ? `Telegram: ${code.clientTelegram}` : '',
                code.clientInstagram ? `Instagram: ${code.clientInstagram}` : ''
            ].filter(Boolean).join('<br>');
            
            item.innerHTML = `
                <div class="info">
                    <strong>Código: ${code.code}</strong>
                    <p>Descrição: <span class="desc">${code.description}</span></p>
                    <p>Expira em: <span>${expiryDate}</span></p>
                    <p>Status: <span style="color: #2E8B57; font-weight: bold;">Ativo</span></p>
                    ${clientInfo ? `<div style="margin-top:10px; font-size: 0.9em; opacity: 0.8;">${clientInfo}</div>` : ''}
                </div>
                <div class="actions">
                    <button class="edit-desc-btn" data-id="${code.id}">Editar Desc.</button>
                    <button class="add-info-btn" data-id="${code.id}">Add Info</button>
                    <button class="delete-btn" data-id="${code.id}">Excluir</button>
                </div>
            `;
            listContainer.appendChild(item);
        });
        attachActivatedCodeListeners();
    };

    const renderExpiredCodesList = () => {
        const searchInput = document.getElementById('expired-codes-search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const listContainer = document.getElementById('expired-codes-list');
        listContainer.innerHTML = '';
        const now = new Date().getTime();

        let expiredCodes = [...dbCache.codes]
            .filter(code => now >= code.expiresAt); // Only expired codes

        if (searchTerm) {
            expiredCodes = expiredCodes.filter(code => {
                const codeMatch = code.code.toLowerCase().includes(searchTerm);
                const descriptionMatch = code.description && code.description.toLowerCase().includes(searchTerm);
                const nameMatch = code.clientName && code.clientName.toLowerCase().includes(searchTerm);
                return codeMatch || descriptionMatch || nameMatch;
            });
        }

        expiredCodes.sort((a, b) => b.expiresAt - a.expiresAt); // Show most recently expired first

        if (expiredCodes.length === 0) {
            listContainer.innerHTML = searchTerm
                ? '<p>Nenhum código vencido corresponde à sua pesquisa.</p>'
                : '<p>Nenhum código vencido.</p>';
            return;
        }

        expiredCodes.forEach(code => {
            const item = document.createElement('div');
            item.className = 'test-item';
            const expiryDate = new Date(code.expiresAt).toLocaleString('pt-BR');
            const clientInfo = code.clientName ? `<p>Nome: ${code.clientName}</p>` : '';

            item.innerHTML = `
                <div class="info">
                    <strong>Código: ${code.code}</strong>
                    <p>Descrição: <span class="desc">${code.description}</span></p>
                    ${clientInfo}
                    <p>Venceu em: <span style="color: #E50914;">${expiryDate}</span></p>
                </div>
                <div class="actions">
                    <button class="delete-btn" data-id="${code.id}">Excluir</button>
                </div>
            `;
            listContainer.appendChild(item);
        });
        attachGeneralDeleteListener(); // Use a more general listener
    };

    const attachTestListListeners = () => {
        document.querySelectorAll('.extend-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const days = parseInt(e.target.value, 10);
                if (!days) return;
                
                const currentCode = dbCache.codes.find(c => c.id === id);
                if (!currentCode) return;

                const newExpiresAt = currentCode.expiresAt + (days * 24 * 60 * 60 * 1000);
                room.collection('codes').update(id, { expiresAt: newExpiresAt, status: 'Ativo' });
                e.target.value = ""; // Reset select
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const newDesc = prompt('Digite a nova descrição:');
                if (newDesc !== null && newDesc.trim() !== '') {
                    room.collection('codes').update(id, { description: newDesc.trim() });
                }
            });
        });
        
        attachGeneralDeleteListener();
    };
    
    const attachActivatedCodeListeners = () => {
        document.querySelectorAll('.edit-desc-btn').forEach(btn => {
             btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                openInfoModal(id);
            });
        });
        document.querySelectorAll('.add-info-btn').forEach(btn => {
             btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                openInfoModal(id);
            });
        });
        attachGeneralDeleteListener();
    };

    const attachGeneralDeleteListener = () => {
        document.querySelectorAll('.delete-btn').forEach(btn => {
            // Prevent multiple listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const code = dbCache.codes.find(c => c.id === id);
                if (code && confirm(`Tem certeza que deseja excluir o código ${code.code}?`)) {
                    room.collection('codes').delete(id);
                }
            });
        });
    };
    
    // --- Info Modal ---
    const infoModal = document.getElementById('info-modal');
    const infoForm = document.getElementById('info-form');
    const infoCodeIdInput = document.getElementById('info-code-id');
    const infoDescriptionInput = document.getElementById('info-description');
    const infoNameInput = document.getElementById('info-name');
    const infoWhatsappInput = document.getElementById('info-whatsapp');
    const infoTelegramInput = document.getElementById('info-telegram');
    const infoInstagramInput = document.getElementById('info-instagram');
    const cancelInfoBtn = document.getElementById('cancel-info-btn');

    const openInfoModal = (codeId) => {
        const code = dbCache.codes.find(c => c.id === codeId);
        if (!code) return;

        infoCodeIdInput.value = code.id;
        infoDescriptionInput.value = code.description || '';
        infoNameInput.value = code.clientName || '';
        infoWhatsappInput.value = code.clientWhatsapp || '';
        infoTelegramInput.value = code.clientTelegram || '';
        infoInstagramInput.value = code.clientInstagram || '';
        
        infoModal.classList.remove('hidden');
    };
    
    const closeInfoModal = () => {
        infoForm.reset();
        infoModal.classList.add('hidden');
    };

    const setupInfoModal = () => {
        infoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = infoCodeIdInput.value;
            const updatedInfo = {
                description: infoDescriptionInput.value.trim(),
                clientName: infoNameInput.value.trim(),
                clientWhatsapp: infoWhatsappInput.value.trim(),
                clientTelegram: infoTelegramInput.value.trim(),
                clientInstagram: infoInstagramInput.value.trim(),
            };
            
            await room.collection('codes').update(id, updatedInfo);
            alert('Informações salvas com sucesso!');
            closeInfoModal();
        });

        cancelInfoBtn.addEventListener('click', closeInfoModal);
    };
    
    // --- Movie Form ---
    let isEditingMovie = false;
    const movieForm = document.getElementById('add-movie-form');
    const movieIdInput = document.getElementById('movie-id');
    const movieTitleInput = document.getElementById('movie-title');
    const movieDescriptionInput = document.getElementById('movie-description');
    const movieThumbnailInput = document.getElementById('movie-thumbnail');
    const movieUrlInput = document.getElementById('movie-url');
    const addMovieBtn = document.getElementById('add-movie-btn');
    const cancelEditMovieBtn = document.getElementById('cancel-edit-movie-btn');

    const resetMovieForm = () => {
        movieForm.reset();
        movieIdInput.value = '';
        addMovieBtn.textContent = 'Adicionar Filme';
        cancelEditMovieBtn.classList.add('hidden');
        isEditingMovie = false;
    };

    const renderMoviesList = () => {
        const searchInput = document.getElementById('admin-movie-search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        const listContainer = document.getElementById('existing-movies-list');
        listContainer.innerHTML = '';
        
        let movies = [...dbCache.movies];

        if (searchTerm) {
            movies = movies.filter(movie => movie.title.toLowerCase().includes(searchTerm));
        }

        movies.sort((a, b) => (a.title > b.title ? 1 : -1));

        if (movies.length === 0) {
            listContainer.innerHTML = searchTerm
                ? '<p>Nenhum filme corresponde à sua pesquisa.</p>'
                : '<p>Nenhum filme adicionado ainda.</p>';
            return;
        }

        movies.forEach(movie => {
            const item = document.createElement('div');
            item.className = 'content-item';
            
            item.innerHTML = `
                <div class="info">
                    <strong>${movie.title}</strong>
                </div>
                <div class="actions">
                    <button class="edit-btn" data-id="${movie.id}">Editar</button>
                    <button class="delete-btn" data-id="${movie.id}">Excluir</button>
                </div>
            `;
            listContainer.appendChild(item);
        });

        // Attach event listeners
        listContainer.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const movieId = e.target.dataset.id;
                const movie = dbCache.movies.find(m => m.id === movieId);
                if (movie) {
                    isEditingMovie = true;
                    movieIdInput.value = movie.id;
                    movieTitleInput.value = movie.title;
                    movieDescriptionInput.value = movie.description;
                    movieThumbnailInput.value = movie.thumbnail;
                    movieUrlInput.value = movie.url;
                    addMovieBtn.textContent = 'Salvar Alterações';
                    cancelEditMovieBtn.classList.remove('hidden');
                    window.scrollTo(0, 0); // Scroll to top to see the form
                }
            });
        });

        listContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const movieId = e.target.dataset.id;
                const movie = dbCache.movies.find(m => m.id === movieId);
                if (movie && confirm(`Tem certeza que deseja excluir o filme "${movie.title}"?`)) {
                    room.collection('movies').delete(movieId);
                    alert('Filme excluído com sucesso.');
                }
            });
        });
    };

    const setupMovieForm = (updatePublishNotification) => {
        movieForm.addEventListener('submit', async e => {
            e.preventDefault();
            const movieData = {
                // id is handled by websim on create, but we need it for updates
                type: 'movie',
                title: movieTitleInput.value,
                description: movieDescriptionInput.value,
                thumbnail: movieThumbnailInput.value,
                url: movieUrlInput.value,
            };

            addMovieBtn.disabled = true;

            if (isEditingMovie) {
                addMovieBtn.textContent = 'Salvando...';
                await room.collection('movies').update(movieIdInput.value, movieData);
                alert('Filme atualizado com sucesso!');
                resetMovieForm();
            } else {
                addMovieBtn.textContent = 'Adicionando...';
                stagedChanges.movies.push(movieData);
                updatePublishNotification();
                alert('Filme adicionado e pronto para ser publicado! Lembre-se de clicar em "Publicar" para salvar permanentemente.');
                resetMovieForm();
            }
            addMovieBtn.disabled = false;
        });
        
        cancelEditMovieBtn.addEventListener('click', resetMovieForm);
    };

    // --- Series Form ---
    let currentSeries = null;
    let isEditingSeries = false;

    const seriesForm = document.getElementById('add-series-form');
    const seriesIdInput = document.getElementById('series-id');
    const seriesTitleInput = document.getElementById('series-title');
    const seriesDescriptionInput = document.getElementById('series-description');
    const seriesThumbnailInput = document.getElementById('series-thumbnail');
    const addSeriesBtn = document.getElementById('add-series-btn');
    const cancelEditSeriesBtn = document.getElementById('cancel-edit-series-btn');
    
    const seasonsEpisodesSection = document.getElementById('seasons-episodes-section');

    const resetSeriesForm = () => {
        seriesForm.reset();
        seriesIdInput.value = '';
        currentSeries = null;
        isEditingSeries = false;
        
        addSeriesBtn.textContent = 'Salvar Série e Adicionar Temporadas';
        cancelEditSeriesBtn.classList.add('hidden');
        seasonsEpisodesSection.classList.add('hidden');
        seriesForm.classList.remove('hidden');
        document.getElementById('finish-series-btn').classList.add('hidden');
    };

    const renderSeriesList = () => {
        const searchInput = document.getElementById('admin-series-search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        const listContainer = document.getElementById('existing-series-list');
        listContainer.innerHTML = '';
        
        let seriesList = [...dbCache.series];

        if (searchTerm) {
            seriesList = seriesList.filter(series => series.title.toLowerCase().includes(searchTerm));
        }

        seriesList.sort((a, b) => (a.title > b.title ? 1 : -1));

        if (seriesList.length === 0) {
            listContainer.innerHTML = searchTerm
                ? '<p>Nenhuma série corresponde à sua pesquisa.</p>'
                : '<p>Nenhuma série adicionada ainda.</p>';
            return;
        }

        seriesList.forEach(series => {
            const item = document.createElement('div');
            item.className = 'content-item';
            
            item.innerHTML = `
                <div class="info">
                    <strong>${series.title}</strong>
                </div>
                <div class="actions">
                    <button class="edit-btn" data-id="${series.id}">Editar</button>
                    <button class="delete-btn" data-id="${series.id}">Excluir</button>
                </div>
            `;
            listContainer.appendChild(item);
        });

        listContainer.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const seriesId = e.target.dataset.id;
                const seriesToEdit = dbCache.series.find(s => s.id === seriesId);
                if (seriesToEdit) {
                    isEditingSeries = true;
                    currentSeries = JSON.parse(JSON.stringify(seriesToEdit)); // Deep copy

                    seriesIdInput.value = currentSeries.id;
                    seriesTitleInput.value = currentSeries.title;
                    seriesDescriptionInput.value = currentSeries.description;
                    seriesThumbnailInput.value = currentSeries.thumbnail;

                    addSeriesBtn.textContent = 'Salvar Alterações e Editar Episódios';
                    cancelEditSeriesBtn.classList.remove('hidden');

                    seasonsEpisodesSection.classList.remove('hidden');
                    document.getElementById('current-series-title').textContent = `Editando temporadas para: ${currentSeries.title}`;
                    renderSeasons();

                    window.scrollTo(0, 0);
                }
            });
        });

        listContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const seriesId = e.target.dataset.id;
                const series = dbCache.series.find(s => s.id === seriesId);
                if (series && confirm(`Tem certeza que deseja excluir a série "${series.title}"?`)) {
                    room.collection('series').delete(seriesId);
                    alert('Série excluída com sucesso.');
                }
            });
        });
    };

    const setupSeriesForm = (updatePublishNotification) => {
        seriesForm.addEventListener('submit', async e => {
            e.preventDefault();
            addSeriesBtn.disabled = true;

            if (isEditingSeries) {
                addSeriesBtn.textContent = 'Salvando...';
                // Update the currentSeries object in memory from the form
                currentSeries.title = seriesTitleInput.value;
                currentSeries.description = seriesDescriptionInput.value;
                currentSeries.thumbnail = seriesThumbnailInput.value;
                // The seasons/episodes are already in `currentSeries`
                await room.collection('series').update(currentSeries.id, {
                    title: currentSeries.title,
                    description: currentSeries.description,
                    thumbnail: currentSeries.thumbnail,
                    seasons: currentSeries.seasons
                });
                alert('Série atualizada com sucesso!');
                resetSeriesForm();
                addSeriesBtn.disabled = false;
                return;
            }

            // --- Logic for adding a NEW series ---
            const seriesData = {
                type: 'series',
                title: seriesTitleInput.value,
                description: seriesDescriptionInput.value,
                thumbnail: seriesThumbnailInput.value,
                seasons: []
            };
            
            currentSeries = seriesData;
            addSeriesBtn.disabled = false;
            
            seriesForm.classList.add('hidden');
            seasonsEpisodesSection.classList.remove('hidden');
            document.getElementById('current-series-title').textContent = `Adicionando temporadas para: ${seriesData.title}`;
            renderSeasons();

            const finishBtn = document.getElementById('finish-series-btn');
            finishBtn.classList.remove('hidden');
            
            const finishHandler = () => {
                if (currentSeries && !stagedChanges.series.find(s => s.id === currentSeries.id)) {
                    stagedChanges.series.push(currentSeries);
                    updatePublishNotification();
                    alert(`Série '${currentSeries.title}' pronta para ser publicada.`);
                    resetSeriesForm();
                }
            };
            
            const newFinishBtn = finishBtn.cloneNode(true);
            finishBtn.parentNode.replaceChild(newFinishBtn, finishBtn);
            newFinishBtn.addEventListener('click', finishHandler, { once: true });
        });

        cancelEditSeriesBtn.addEventListener('click', resetSeriesForm);

        document.getElementById('add-season-btn').addEventListener('click', () => {
            if (!currentSeries) return;
            const seasonNumber = currentSeries.seasons.length + 1;
            const newSeason = {
                number: seasonNumber,
                episodes: []
            };
            currentSeries.seasons.push(newSeason);
            renderSeasons();
        });
    };

    const renderSeasons = () => {
        const container = document.getElementById('seasons-container');
        container.innerHTML = '';
        if (!currentSeries) return;

        // Renumber seasons before rendering to ensure consistency
        currentSeries.seasons.forEach((season, index) => {
            season.number = index + 1;
        });

        currentSeries.seasons.forEach((season, seasonIndex) => {
            const seasonEl = document.createElement('div');
            seasonEl.className = 'season-editor';
            seasonEl.innerHTML = `
                <h4>
                    Temporada ${season.number}
                    <button type="button" class="delete-season-btn" data-season-index="${seasonIndex}">Excluir Temporada</button>
                </h4>
            `;
            
            const episodesList = document.createElement('div');
            episodesList.className = 'episodes-editor-list';

            // Renumber episodes
            season.episodes.forEach((ep, index) => {
                ep.number = index + 1;
            });

            season.episodes.forEach((ep, episodeIndex) => {
                const episodeItem = document.createElement('div');
                episodeItem.className = 'episode-editor-item';
                episodeItem.innerHTML = `
                    <span>${ep.number}. ${ep.title}</span>
                    <div class="actions">
                        <button type="button" class="edit-episode-btn" data-season-index="${seasonIndex}" data-episode-index="${episodeIndex}">Editar</button>
                        <button type="button" class="delete-episode-btn" data-season-index="${seasonIndex}" data-episode-index="${episodeIndex}">Excluir</button>
                    </div>
                `;
                episodesList.appendChild(episodeItem);
            });
            seasonEl.appendChild(episodesList);

            const addEpisodeForm = document.createElement('form');
            addEpisodeForm.className = 'add-episode-form';
            addEpisodeForm.innerHTML = `
                <input type="text" placeholder="Título do Episódio" required>
                <input type="url" placeholder="URL do Vídeo" required>
                <button type="submit">Adicionar Episódio</button>
            `;

            addEpisodeForm.addEventListener('submit', e => {
                e.preventDefault();
                const titleInput = e.target.children[0];
                const urlInput = e.target.children[1];
                const episodeNumber = season.episodes.length + 1;

                const newEpisode = { number: episodeNumber, title: titleInput.value, url: urlInput.value };
                season.episodes.push(newEpisode);
                renderSeasons(); // Re-render to show the new episode
            });

            seasonEl.appendChild(addEpisodeForm);
            container.appendChild(seasonEl);
        });

        attachSeasonEditorListeners();
    };

    const attachSeasonEditorListeners = () => {
        // Edit Episode
        document.querySelectorAll('.edit-episode-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const { seasonIndex, episodeIndex } = e.target.dataset;
                const episode = currentSeries.seasons[seasonIndex].episodes[episodeIndex];
                
                const newTitle = prompt('Digite o novo título do episódio:', episode.title);
                if (newTitle === null) return; // User cancelled

                const newUrl = prompt('Digite a nova URL do vídeo:', episode.url);
                if (newUrl === null) return; // User cancelled

                episode.title = newTitle;
                episode.url = newUrl;
                renderSeasons(); // Refresh view
            });
        });

        // Delete Episode
        document.querySelectorAll('.delete-episode-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const { seasonIndex, episodeIndex } = e.target.dataset;
                const episode = currentSeries.seasons[seasonIndex].episodes[episodeIndex];
                
                if (confirm(`Tem certeza que deseja excluir o episódio "${episode.title}"?`)) {
                    currentSeries.seasons[seasonIndex].episodes.splice(episodeIndex, 1);
                    renderSeasons(); // Refresh view
                }
            });
        });

        // Delete Season
        document.querySelectorAll('.delete-season-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const { seasonIndex } = e.target.dataset;
                const season = currentSeries.seasons[seasonIndex];

                if (confirm(`Tem certeza que deseja excluir a "Temporada ${season.number}" e todos os seus episódios?`)) {
                    currentSeries.seasons.splice(seasonIndex, 1);
                    renderSeasons(); // Refresh view
                }
            });
        });
    };

    // --- Initial check ---
    checkLogin();
});