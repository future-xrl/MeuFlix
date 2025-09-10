const DB_KEY = 'startflix_db';

const getDb = () => {
    const db = localStorage.getItem(DB_KEY);
    if (!db) {
        const newDb = {
            codes: [],
            movies: [],
            series: [],
            favorites: [] // Add favorites array
        };
        // Add special code on first initialization
        const specialCodeValue = 'ST58044956';
        const tenYearsFromNow = Date.now() + (3650 * 24 * 60 * 60 * 1000);
        newDb.codes.push({
            code: specialCodeValue,
            description: 'Código de acesso especial',
            createdAt: Date.now(),
            expiresAt: tenYearsFromNow
        });
        localStorage.setItem(DB_KEY, JSON.stringify(newDb));
        return newDb;
    }
    const parsedDb = JSON.parse(db);
    // Ensure favorites exists for older DBs
    if (!parsedDb.favorites) {
        parsedDb.favorites = [];
    }
    return parsedDb;
};

const saveDb = (db) => {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
};

export const getAllData = () => {
    return getDb();
};

// --- Codes ---
export const getCodes = () => getDb().codes;

export const saveCode = (newCode) => {
    const db = getDb();
    db.codes.push(newCode);
    saveDb(db);
};

export const updateCode = (codeToUpdate) => {
    const db = getDb();
    const index = db.codes.findIndex(c => c.code === codeToUpdate.code);
    if (index !== -1) {
        db.codes[index] = codeToUpdate;
        saveDb(db);
    }
};

export const deleteCode = (codeValue) => {
    const db = getDb();
    db.codes = db.codes.filter(c => c.code !== codeValue);
    saveDb(db);
};

export const checkCode = (codeValue) => {
    const codes = getCodes();
    const foundCode = codes.find(c => c.code === codeValue);
    if (!foundCode) return false;
    
    const now = new Date().getTime();
    return now < foundCode.expiresAt;
};

// --- Movies ---
export const getMovies = () => getDb().movies;

export const saveMovie = (movie) => {
    const db = getDb();
    db.movies.push(movie);
    saveDb(db);
};

export const deleteMovie = (movieId) => {
    const db = getDb();
    db.movies = db.movies.filter(m => m.id !== movieId);
    saveDb(db);
};

export const updateMovie = (movieToUpdate) => {
    const db = getDb();
    const index = db.movies.findIndex(m => m.id === movieToUpdate.id);
    if (index !== -1) {
        db.movies[index] = movieToUpdate;
        saveDb(db);
    }
};

// --- Series ---
export const getSeries = () => getDb().series;

export const saveSeries = (series) => {
    const db = getDb();
    db.series.push(series);
    saveDb(db);
};

export const deleteSeries = (seriesId) => {
    const db = getDb();
    db.series = db.series.filter(s => s.id !== seriesId);
    saveDb(db);
};

export const updateSeries = (seriesToUpdate) => {
    const db = getDb();
    const index = db.series.findIndex(s => s.id === seriesToUpdate.id);
    if (index !== -1) {
        db.series[index] = seriesToUpdate;
        saveDb(db);
    }
};

// --- Favorites ---
const DB_KEY_FAVORITES = 'startflix_favorites';

export const getFavorites = () => {
    const favs = localStorage.getItem(DB_KEY_FAVORITES);
    return favs ? JSON.parse(favs) : [];
};

const saveFavorites = (favs) => {
    localStorage.setItem(DB_KEY_FAVORITES, JSON.stringify(favs));
};

export const addFavorite = (itemId) => {
    const favs = getFavorites();
    if (!favs.includes(itemId)) {
        favs.push(itemId);
        saveFavorites(favs);
    }
};

export const removeFavorite = (itemId) => {
    let favs = getFavorites();
    favs = favs.filter(id => id !== itemId);
    saveFavorites(favs);
};

export const isFavorite = (itemId) => {
    return getFavorites().includes(itemId);
};