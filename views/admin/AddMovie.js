import { getDB, saveDB } from 'db';
import { showToast, generateUniqueId, fileToBase64, isValidLink, MEDIA_CATEGORIES } from 'utils';
import { renderLayout } from 'views/admin/Layout';

async function handleMovieSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.elements['movie-name'].value;
    const description = form.elements['movie-description'].value;
    const link = form.elements['movie-link'].value;
    const category = form.elements['movie-category'].value;
    const coverFile = form.elements['movie-cover'].files[0];
    const editId = form.dataset.editId;

    if (!name || !description || !link) {
        showToast('Todos os campos são obrigatórios.', 'error');
        return;
    }
    
    if (!category) {
        showToast('Por favor, selecione uma categoria.', 'error');
        return;
    }

    if (!isValidLink(link)) {
        showToast('Link inválido, use apenas Google Drive, Dropbox, Archive.org, Pixeldrain, YouTube, Terabox, VidLii ou BitChute.', 'error');
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
    movieData.category = category;
    
    const releaseYear = form.elements['movie-release-year'].value;
    if (releaseYear && (releaseYear.length !== 4 || isNaN(parseInt(releaseYear)))) {
        showToast('Insira um ano válido com 4 dígitos.', 'error');
        return;
    }
    movieData.releaseYear = releaseYear ? parseInt(releaseYear) : null;

    if (!editId) {
        movieData.createdAt = new Date().toISOString();
    }

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
    renderAddMoviePage(document.getElementById('app'));
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
            renderAddMoviePage(document.getElementById('app'), movie);
        }
        if (e.target.classList.contains('delete-movie')) {
            if (confirm('Deseja excluir este filme?')) {
                const movieId = e.target.dataset.id;
                let db = getDB();
                db.movies = db.movies.filter(m => m.id !== movieId);
                saveDB(db);
                showToast('Filme excluído!');
                renderAddMoviePage(document.getElementById('app'));
            }
        }
    });

    const cancelBtn = document.getElementById('cancel-edit');
    if(cancelBtn) {
        cancelBtn.addEventListener('click', () => renderAddMoviePage(document.getElementById('app')));
    }
}

export function renderAddMoviePage(container, movieToEdit = null) {
    const db = getDB();
    const releaseYear = movieToEdit?.releaseYear || '';
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
                    <label for="movie-release-year">Ano de Lançamento</label>
                    <input type="number" id="movie-release-year" class="form-control" min="1900" max="${new Date().getFullYear() + 1}" placeholder="Ano (ex: 2023)" value="${releaseYear}">
                </div>
                <div class="form-group">
                    <label for="movie-category">Categoria</label>
                    <select id="movie-category" class="form-control" required>
                        <option value="">Selecione uma categoria</option>
                        ${MEDIA_CATEGORIES.map(cat => `<option value="${cat.key}" ${movieToEdit?.category === cat.key ? 'selected' : ''}>${cat.name}</option>`).join('')}
                    </select>
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
    renderLayout(container, content, movieToEdit ? 'Editar Filme' : 'Adicionar Filme');
    attachMovieFormListeners();
}