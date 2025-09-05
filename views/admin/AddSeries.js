import { getDB, saveDB } from 'db';
import { showToast, generateUniqueId, fileToBase64, isValidLink, MEDIA_CATEGORIES } from 'utils';
import { renderLayout } from 'views/admin/Layout';

function attachSeriesFormListeners(seriesToEdit = null) {
    let seasons = seriesToEdit ? JSON.parse(JSON.stringify(seriesToEdit.seasons)) : [];

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
        const category = form.elements['series-category'].value;
        const coverFile = form.elements['series-cover'].files[0];
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
        let seriesData;

        if (editId) {
            seriesData = db.series.find(s => s.id === editId);
        } else {
            seriesData = { id: generateUniqueId('series_') };
        }

        seriesData.name = name;
        seriesData.description = description;
        seriesData.seasons = seasons;
        seriesData.category = category;

        const releaseYear = form.elements['series-release-year'].value;
        if (releaseYear && (releaseYear.length !== 4 || isNaN(parseInt(releaseYear)))) {
            showToast('Insira um ano válido com 4 dígitos.', 'error');
            return;
        }
        seriesData.releaseYear = releaseYear ? parseInt(releaseYear) : null;

        if (!editId) {
            seriesData.createdAt = new Date().toISOString();
        }

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
        renderAddSeriesPage(document.getElementById('app'));
    });

    // The delete functionality is now handled by a global event listener in app.js
    // to simplify state management and avoid attaching multiple listeners.

    const cancelBtn = document.getElementById('cancel-edit-series');
    if(cancelBtn) {
        cancelBtn.addEventListener('click', () => renderAddSeriesPage(document.getElementById('app')));
    }

    renderSeasons();
}

export function renderAddSeriesPage(container, seriesToEdit = null) {
    const db = getDB();
    const releaseYear = seriesToEdit?.releaseYear || '';
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
                    <label for="series-release-year">Ano de Lançamento</label>
                    <input type="number" id="series-release-year" class="form-control" min="1900" max="${new Date().getFullYear() + 1}" placeholder="Ano (ex: 2023)" value="${releaseYear}">
                </div>
                 <div class="form-group">
                    <label for="series-category">Categoria</label>
                    <select id="series-category" class="form-control" required>
                        <option value="">Selecione uma categoria</option>
                        ${MEDIA_CATEGORIES.map(cat => `<option value="${cat.key}" ${seriesToEdit?.category === cat.key ? 'selected' : ''}>${cat.name}</option>`).join('')}
                    </select>
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
                            <button class="btn btn-secondary" onclick="editItem('${s.id}', 'series')">Editar</button>
                            <button class="btn btn-danger" onclick="deleteItem('${s.id}', 'series')">Excluir</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    renderLayout(container, content, seriesToEdit ? 'Editar Série' : 'Adicionar Série');
    attachSeriesFormListeners(seriesToEdit);
}