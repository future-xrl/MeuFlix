import * as db from './db.js';

const room = new WebsimSocket();

const checkCode = async (codeValue) => {
    const codes = await room.collection('codes').filter({ code: codeValue }).getList();
    if (codes.length === 0) return false;
    
    const foundCode = codes[0];
    const now = new Date().getTime();
    return now < foundCode.expiresAt;
};

document.addEventListener('DOMContentLoaded', async () => {
    // --- Authentication ---
    const loggedInCode = localStorage.getItem('loggedInCode');
    if (!loggedInCode || !(await checkCode(loggedInCode))) {
        localStorage.removeItem('loggedInCode');
        window.location.href = '/index.html';
        return;
    }

    // --- Notifications Subscription ---
    room.collection('notifications').filter({ code: loggedInCode }).subscribe(notifications => {
        const now = Date.now();
        const validNotifications = notifications.filter(n => n.expiresAt > now);
        
        const notificationsContainer = document.getElementById('user-notifications');
        if (!notificationsContainer) return;

        notificationsContainer.innerHTML = ''; // Clear previous
        
        if (validNotifications.length > 0) {
            const title = document.createElement('h3');
            title.textContent = 'Notificações';
            notificationsContainer.appendChild(title);

            validNotifications.sort((a,b) => b.createdAt - a.createdAt).forEach(n => {
                const noteEl = document.createElement('div');
                noteEl.className = 'notification-item';
                noteEl.textContent = n.message;
                notificationsContainer.appendChild(noteEl);
            });
        }
    });

    let previousView = 'grid'; // To track navigation for the back button
    let previousCatalogType = null; // 'movies', 'series', or null

    // --- View Elements ---
    const mainView = document.getElementById('main-view');
    const playerView = document.getElementById('player-view');
    const catalog = document.getElementById('catalog');
    const homeGridView = document.getElementById('home-grid-view');
    const favoritesCatalogView = document.getElementById('favorites-catalog-view');
    
    // --- Buttons ---
    const backToGridBtn = document.getElementById('back-to-grid');
    const backToGridFromFavoritesBtn = document.getElementById('back-to-grid-from-favorites');
    const backToCatalogBtn = document.getElementById('back-to-catalog');
    const homeLogoutBtn = document.getElementById('home-logout-btn');
    const moviesBtn = document.getElementById('movies-btn');
    const seriesBtn = document.getElementById('series-btn');
    const requestsBtn = document.getElementById('requests-btn');
    const favoritesBtn = document.getElementById('favorites-btn');
    const favoriteBtn = document.getElementById('favorite-btn');
    
    // --- Content Grids ---
    const moviesGrid = document.getElementById('movies-grid');
    const seriesGrid = document.getElementById('series-grid');
    const favoritesGrid = document.getElementById('favorites-grid');

    // --- Search Inputs ---
    const movieSearchInput = document.getElementById('movie-search-input');
    const seriesSearchInput = document.getElementById('series-search-input');

    // --- Player Elements ---
    const videoPlayerContainer = document.getElementById('video-player-container');
    const videoTitle = document.getElementById('video-title');
    const videoDescription = document.getElementById('video-description');
    const toggleDescriptionBtn = document.getElementById('toggle-description-btn');
    
    let currentItem = null; // To keep track of the item in the player
    let allMovies = [];
    let allSeries = [];

    homeLogoutBtn.addEventListener('click', () => {
        localStorage.removeItem('loggedInCode');
        window.location.href = '/index.html';
    });

    const showGridView = () => {
        catalog.classList.add('hidden');
        favoritesCatalogView.classList.add('hidden');
        document.getElementById('requests-view')?.classList.add('hidden'); // Hide requests view
        playerView.classList.add('hidden');
        homeGridView.classList.remove('hidden');
        previousView = 'grid';
        previousCatalogType = null;
    };

    const showCatalog = (type) => {
        homeGridView.classList.add('hidden');
        favoritesCatalogView.classList.add('hidden');
        document.getElementById('requests-view')?.classList.add('hidden'); // Hide requests view
        catalog.classList.remove('hidden');
        previousView = 'catalog';
        previousCatalogType = type;

        document.getElementById('movies-catalog').style.display = 'none';
        document.getElementById('series-catalog').style.display = 'none';

        if (type === 'movies') {
            document.getElementById('movies-catalog').style.display = 'block';
            movieSearchInput.value = ''; // clear search
            renderMovies(allMovies);
        } else if (type === 'series') {
            document.getElementById('series-catalog').style.display = 'block';
            seriesSearchInput.value = ''; // clear search
            renderSeries(allSeries);
        }
    };
    
    moviesBtn.addEventListener('click', () => showCatalog('movies'));
    seriesBtn.addEventListener('click', () => showCatalog('series'));
    
    backToGridBtn.addEventListener('click', showGridView);
    backToGridFromFavoritesBtn.addEventListener('click', showGridView);
    document.getElementById('back-to-grid-from-requests')?.addEventListener('click', showGridView);

    favoritesBtn.addEventListener('click', () => {
        homeGridView.classList.add('hidden');
        catalog.classList.add('hidden');
        document.getElementById('requests-view')?.classList.add('hidden'); // Hide requests view
        favoritesCatalogView.classList.remove('hidden');
        previousView = 'favorites';
        previousCatalogType = null;
        populateFavorites();
    });

    // --- Requests View Logic ---
    requestsBtn.addEventListener('click', () => {
        homeGridView.classList.add('hidden');
        catalog.classList.add('hidden');
        favoritesCatalogView.classList.add('hidden');
        document.getElementById('requests-view')?.classList.remove('hidden');
        previousView = 'requests'; // A new state
        previousCatalogType = null;
    });

    const requestForm = document.getElementById('request-form');
    if (requestForm) {
        requestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('request-title');
            const feedbackEl = document.getElementById('request-feedback');
            const submitBtn = requestForm.querySelector('button[type="submit"]');

            const title = titleInput.value.trim();
            if (!title) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';

            try {
                const userCode = localStorage.getItem('loggedInCode');
                await room.collection('requests').create({ title: title, requestedByCode: userCode });
                
                feedbackEl.textContent = `Seu pedido para "${title}" foi enviado com sucesso!`;
                feedbackEl.classList.remove('hidden');
                titleInput.value = '';

                setTimeout(() => feedbackEl.classList.add('hidden'), 5000);

            } catch (error) {
                console.error("Error submitting request:", error);
                feedbackEl.textContent = 'Ocorreu um erro ao enviar seu pedido. Tente novamente.';
                feedbackEl.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Pedido';
            }
        });
    }

    const createThumbnail = (item) => {
        const div = document.createElement('div');
        div.className = 'thumbnail-container';
        div.innerHTML = `
            <img src="${item.thumbnail}" alt="${item.title}" class="thumbnail">
            <p class="thumbnail-title">${item.title}</p>
        `;
        div.addEventListener('click', () => showPlayer(item));
        return div;
    };

    const renderMovies = (moviesToRender) => {
        moviesGrid.innerHTML = '';
        if (moviesToRender.length === 0) {
            moviesGrid.innerHTML = '<p>Nenhum filme encontrado.</p>';
            return;
        }
        moviesToRender.forEach(movie => moviesGrid.appendChild(createThumbnail(movie)));
    };
    
    const renderSeries = (seriesToRender) => {
        seriesGrid.innerHTML = '';
        if (seriesToRender.length === 0) {
            seriesGrid.innerHTML = '<p>Nenhuma série encontrada.</p>';
            return;
        }
        seriesToRender.forEach(s => seriesGrid.appendChild(createThumbnail(s)));
    };
    
    const populateCatalogs = async () => {
        allMovies = await room.collection('movies').getList();
        allSeries = await room.collection('series').getList();
        
        renderMovies(allMovies);
        renderSeries(allSeries);
    };
    
    const populateFavorites = async () => {
        const movies = await room.collection('movies').getList();
        const series = await room.collection('series').getList();
        const allContent = [...movies, ...series];
        const favoriteIds = db.getFavorites();

        favoritesGrid.innerHTML = '';
        if (favoriteIds.length === 0) {
            favoritesGrid.innerHTML = '<p>Você ainda não adicionou nenhum favorito.</p>';
            return;
        }

        const favoriteItems = allContent.filter(item => favoriteIds.includes(item.id));
        favoriteItems.forEach(item => favoritesGrid.appendChild(createThumbnail(item)));
    };

    const getEmbedUrl = (url) => {
        if (!url) return '';
        if (url.includes('drive.google.com')) {
            const fileId = url.split('/d/')[1].split('/')[0];
            return `https://drive.google.com/file/d/${fileId}/preview`;
        } else if (url.includes('bitchute.com')) {
            const videoId = url.split('/video/')[1].split('/')[0];
            return `https://www.bitchute.com/embed/${videoId}/`;
        }
        return url; // fallback
    };

    const showPlayer = (item) => {
        currentItem = item; // Store current item
        catalog.classList.add('hidden');
        favoritesCatalogView.classList.add('hidden');
        document.getElementById('requests-view')?.classList.add('hidden'); // Hide requests view
        homeGridView.classList.add('hidden'); // Ensure grid is also hidden
        playerView.classList.remove('hidden');

        videoTitle.textContent = item.title;
        videoDescription.textContent = item.description;
        updateFavoriteButton();

        // Reset description view
        videoDescription.classList.add('hidden');
        toggleDescriptionBtn.textContent = 'Ver Descrição';

        const seriesPlayerDetails = document.getElementById('series-player-details');
        
        if (item.type === 'movie') {
            seriesPlayerDetails.classList.add('hidden');
            playVideo(item.url);
        } else if (item.type === 'series') {
            seriesPlayerDetails.classList.remove('hidden');
            renderSeriesEpisodes(item);
            // Play first episode of first season by default
            if (item.seasons?.[0]?.episodes?.[0]) {
                playVideo(item.seasons[0].episodes[0].url, item.seasons[0].episodes[0].title);
            } else {
                videoPlayerContainer.innerHTML = '<p>Nenhum episódio disponível.</p>';
            }
        }
    };
    
    const playVideo = (url, title = '') => {
        const embedUrl = getEmbedUrl(url);
        videoPlayerContainer.innerHTML = `<iframe src="${embedUrl}" allowfullscreen></iframe>`;
        if (title) {
            videoTitle.textContent = title;
        }
    };
    
    const renderSeriesEpisodes = (series) => {
        const seasonsList = document.getElementById('seasons-list');
        seasonsList.innerHTML = '';

        series.seasons.forEach(season => {
            const seasonBlock = document.createElement('div');
            seasonBlock.className = 'season-block';
            seasonBlock.innerHTML = `<h3 class="season-title">Temporada ${season.number}</h3>`;
            
            const episodesList = document.createElement('div');
            episodesList.className = 'episodes-list';

            season.episodes.forEach(episode => {
                const epItem = document.createElement('div');
                epItem.className = 'episode-item';
                epItem.textContent = `Ep. ${episode.number}: ${episode.title}`;
                epItem.addEventListener('click', () => {
                    playVideo(episode.url, `${series.title} - ${episode.title}`);
                    // Highlight active episode
                     document.querySelectorAll('.episode-item').forEach(el => el.classList.remove('active'));
                    epItem.classList.add('active');
                });
                episodesList.appendChild(epItem);
            });
            
            seasonBlock.appendChild(episodesList);
            seasonsList.appendChild(seasonBlock);
        });
    };

    const updateFavoriteButton = () => {
        if (db.isFavorite(currentItem.id)) {
            favoriteBtn.textContent = 'Remover dos Favoritos';
            favoriteBtn.classList.add('active');
        } else {
            favoriteBtn.textContent = 'Adicionar aos Favoritos';
            favoriteBtn.classList.remove('active');
        }
    };

    favoriteBtn.addEventListener('click', () => {
        if (!currentItem) return;
        if (db.isFavorite(currentItem.id)) {
            db.removeFavorite(currentItem.id);
        } else {
            db.addFavorite(currentItem.id);
        }
        updateFavoriteButton();
    });

    toggleDescriptionBtn.addEventListener('click', () => {
        videoDescription.classList.toggle('hidden');
        if (videoDescription.classList.contains('hidden')) {
            toggleDescriptionBtn.textContent = 'Ver Descrição';
        } else {
            toggleDescriptionBtn.textContent = 'Ocultar Descrição';
        }
    });

    backToCatalogBtn.addEventListener('click', () => {
        playerView.classList.add('hidden');
        // Use the state variable to return to the correct screen
        if (previousView === 'catalog' && previousCatalogType) {
            showCatalog(previousCatalogType);
        } else if (previousView === 'favorites') {
            favoritesCatalogView.classList.remove('hidden');
            populateFavorites(); // Refresh favorites view
        } else {
            // Fallback to grid view if something is wrong
            showGridView();
        }
        document.querySelector('.player-content-wrapper').style.display = ''; // Reset display style
        videoPlayerContainer.innerHTML = ''; // Stop video playback
        currentItem = null;
    });

    // --- Search Listeners ---
    movieSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredMovies = allMovies.filter(movie => 
            movie.title.toLowerCase().includes(searchTerm)
        );
        renderMovies(filteredMovies);
    });

    seriesSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredSeries = allSeries.filter(series => 
            series.title.toLowerCase().includes(searchTerm)
        );
        renderSeries(filteredSeries);
    });

    // --- Initial Load ---
    populateCatalogs();
});