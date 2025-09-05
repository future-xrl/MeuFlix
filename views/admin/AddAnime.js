import { getDB, saveDB } from 'db';
import { showToast, generateUniqueId, fileToBase64, isValidLink, MEDIA_CATEGORIES } from 'utils';
import { renderLayout } from 'views/admin/Layout';

function attachAnimeFormListeners(animeToEdit = null) {
    let seasons = animeToEdit ? JSON.parse(JSON.stringify(animeToEdit.seasons)) : [];

    const renderSeasons = () => {
        const container = document.getElementById('seasons-container');
        if (!container) return;
        container.innerHTML = seasons.map((season, sIndex) => `
            <div class="season-block card" data-season-index="${sIndex}">
                <h4>Temporada ${season.seasonNumber} <button type="button" class="btn btn-danger btn-sm remove-season-btn">Remover</button></h4>
                <div class="episodes-container">
                    ${season.episodes.map((ep, eIndex) => `
                        <div class="episode-block form-group" data-episode-index="${eIndex}" style="display: flex; align-items: center; gap: 10px;">
                            <label style="flex-shrink: 0;">Episódio ${ep.episodeNumber}</label>
                            <input type="url" class="form-control episode-link" value="${ep.link}" placeholder="Link do episódio" required>
                             <button type="button" class="btn btn-danger btn-sm remove-episode-btn" style="width: auto; padding: 0.2rem 0.5rem;">X</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-secondary btn-sm add-episode-btn">Adicionar Episódio</button>
            </div>
        `).join('');
        updateListeners();
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
    };

    const handleAddEpisode = (e) => {
        const sIndex = e.target.closest('.season-block').dataset.seasonIndex;
        const season = seasons[sIndex];
        season.episodes.push({ episodeNumber: season.episodes.length + 1, link: '' });
        renderSeasons();
    };

    const handleRemoveSeason = (e) => {
        const sIndex = e.target.closest('.season-block').dataset.seasonIndex;
        seasons.splice(sIndex, 1);
        seasons.forEach((s, i) => s.seasonNumber = i + 1); // re-number seasons
        renderSeasons();
    };

    const handleRemoveEpisode = (e) => {
        const sIndex = e.target.closest('.season-block').dataset.seasonIndex;
        const eIndex = e.target.closest('.episode-block').dataset.episodeIndex;
        const season = seasons[sIndex];
        season.episodes.splice(eIndex, 1);
        season.episodes.forEach((ep, i) => ep.episodeNumber = i + 1);
        renderSeasons();
    };

    const handleEpisodeLinkChange = (e) => {
        const sIndex = e.target.closest('.season-block').dataset.seasonIndex;
        const eIndex = e.target.closest('.episode-block').dataset.episodeIndex;
        seasons[sIndex].episodes[eIndex].link = e.target.value;
    };

    document.getElementById('add-season-btn').addEventListener('click', handleAddSeason);
    document.getElementById('anime-cover').addEventListener('change', async e => {
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

    document.getElementById('anime-form').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const name = form.elements['anime-name'].value;
        const description = form.elements['anime-description'].value;
        const category = form.elements['anime-category'].value;
        const coverFile = form.elements['anime-cover'].files[0];
        const editId = form.dataset.editId;

        if (!name || !description) {
            showToast('Nome e descrição são obrigatórios.', 'error');
            return;
        }

        if (!category) {
            showToast('Por favor, selecione uma categoria.', 'error');
            return;
        }

        for (const season of seasons) {
            for (const episode of season.episodes) {
                if (!isValidLink(episode.link)) {
                    showToast(`Link inválido no Episódio ${episode.episodeNumber} da Temporada ${season.seasonNumber}. Use apenas os sites permitidos.`, 'error');
                    return;
                }
            }
        }

        const db = getDB();
        let animeData;

        if (editId) {
            animeData = db.animes.find(s => s.id === editId);
        } else {
            animeData = { id: generateUniqueId('anime_') };
        }

        animeData.name = name;
        animeData.description = description;
        animeData.seasons = seasons;
        animeData.category = category;
        
        const releaseYear = form.elements['anime-release-year'].value;
        if (releaseYear && (releaseYear.length !== 4 || isNaN(parseInt(releaseYear)))) {
            showToast('Insira um ano válido com 4 dígitos.', 'error');
            return;
        }
        animeData.releaseYear = releaseYear ? parseInt(releaseYear) : null;

        if (!editId) {
            animeData.createdAt = new Date().toISOString();
        }

        if (coverFile) {
            try {
                animeData.cover = await fileToBase64(coverFile);
            } catch (error) {
                showToast(error.message, 'error');
                return;
            }
        } else if (!editId) {
            showToast('A imagem da capa é obrigatória.', 'error');
            return;
        }

        if (editId) {
            const index = db.animes.findIndex(s => s.id === editId);
            db.animes[index] = animeData;
            showToast('Anime atualizado com sucesso!');
        } else {
            db.animes.push(animeData);
            showToast('Anime adicionado com sucesso!');
        }

        saveDB(db);
        renderAddAnimePage(document.getElementById('app'));
    });

    const cancelBtn = document.getElementById('cancel-edit-anime');
    if(cancelBtn) {
        cancelBtn.addEventListener('click', () => renderAddAnimePage(document.getElementById('app')));
    }

    renderSeasons();
}

export function renderAddAnimePage(container, animeToEdit = null) {
    const db = getDB();
    const releaseYear = animeToEdit?.releaseYear || '';
    const content = `
         <div class="card">
            <h2 class="card-title">${animeToEdit ? 'Editar Anime' : 'Adicionar Novo Anime'}</h2>
            <form id="anime-form" data-edit-id="${animeToEdit?.id || ''}">
                <div class="form-group">
                    <label for="anime-name">Nome do Anime</label>
                    <input type="text" id="anime-name" class="form-control" value="${animeToEdit?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label for="anime-description">Descrição</label>
                    <textarea id="anime-description" class="form-control" required>${animeToEdit?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="anime-release-year">Ano de Lançamento</label>
                    <input type="number" id="anime-release-year" class="form-control" min="1900" max="${new Date().getFullYear() + 1}" placeholder="Ano (ex: 2023)" value="${releaseYear}">
                </div>
                <div class="form-group">
                    <label for="anime-category">Categoria</label>
                    <select id="anime-category" class="form-control" required>
                        <option value="">Selecione uma categoria</option>
                        ${MEDIA_CATEGORIES.map(cat => `<option value="${cat.key}" ${animeToEdit?.category === cat.key ? 'selected' : ''}>${cat.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="anime-cover">Capa do Anime</label>
                    <input type="file" id="anime-cover" class="form-control" accept="image/*">
                    <img id="cover-preview" class="image-preview" src="${animeToEdit?.cover || ''}" style="${animeToEdit?.cover ? '' : 'display:none;'}">
                </div>
                <div id="seasons-container">
                    <!-- Seasons and episodes will be rendered here dynamically -->
                </div>
                <button type="button" id="add-season-btn" class="btn btn-secondary">Adicionar Temporada</button>
                <hr style="margin: 1rem 0;">
                <button type="submit" class="btn btn-primary">${animeToEdit ? 'Salvar Alterações' : 'Adicionar Anime'}</button>
                 ${animeToEdit ? `<button type="button" id="cancel-edit-anime" class="btn btn-secondary">Cancelar</button>` : ''}
            </form>
        </div>
        <div class="card">
            <h2 class="card-title">Animes Existentes</h2>
            <ul id="anime-list" class="item-list">
                ${(db.animes || []).map(s => `
                    <li>
                        <span>${s.name}</span>
                        <div class="actions">
                            <button class="btn btn-secondary" onclick="editItem('${s.id}', 'animes')">Editar</button>
                            <button class="btn btn-danger" onclick="deleteItem('${s.id}', 'animes')">Excluir</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    renderLayout(container, content, animeToEdit ? 'Editar Anime' : 'Adicionar Anime');
    attachAnimeFormListeners(animeToEdit);
}