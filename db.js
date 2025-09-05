const DB_NAME = 'cinemaDB';
/* @tweakable [The URL of the remote JSON database file from raw GitHub content] */
const REMOTE_DB_URL = 'https://raw.githubusercontent.com/future-xrl/MeuFlix/main/cinemaDB.json';

const initialData = {
    "config": { "expirationDays": 31 },
    "users": {
        "admin": { "password": "36365852" },
        "clients": [
            { 
                "username": "12345", 
                "password": "67890", 
                "description": "Cliente de Exemplo", 
                "createdAt": new Date().toISOString(),
                "expiresAt": new Date(new Date().setDate(new Date().getDate() + 31)).toISOString(),
                "status": "válido",
                "favorites": [] 
            }
        ],
        "tests": [
            {
                "username": "54321",
                "password": "09876",
                "description": "Teste de Exemplo",
                "createdAt": new Date().toISOString(),
                "expiresAt": new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
                "status": "ativo"
            }
        ]
    },
    "movies": [
        { 
            "id": `movie_${Date.now()}`, 
            "name": "Filme Exemplo", 
            "description": "Esta é a descrição de um filme de exemplo para demonstração. A trama é sobre aventura e descobertas.", 
            "cover": "https://via.placeholder.com/400x600.png/222/f5f5f5?text=Filme+Exemplo", 
            "link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "category": "aventura",
            "releaseYear": 2023,
            "createdAt": "2023-10-26T10:00:00.000Z"
        }
    ],
    "series": [
        { 
            "id": `series_${Date.now()}`, 
            "name": "Série Exemplo", 
            "description": "Resumo da série de exemplo com uma temporada e um episódio.", 
            "cover": "https://via.placeholder.com/400x600.png/222/f5f5f5?text=Série+Exemplo", 
            "category": "drama",
            "releaseYear": 2022,
            "createdAt": "2023-10-25T11:00:00.000Z",
            "likeCount": 0,
            "likedBy": [],
            "seasons": [
                { 
                    "seasonNumber": 1, 
                    "episodes": [
                        { "episodeNumber": 1, "link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
                    ] 
                }
            ] 
        }
    ],
    "animes": [
        { 
            "id": `anime_${Date.now()}`, 
            "name": "Anime Exemplo", 
            "description": "Resumo do anime de exemplo com uma temporada e um episódio para demonstração.", 
            "cover": "https://via.placeholder.com/400x600.png/222/f5f5f5?text=Anime+Exemplo", 
            "category": "fantasia",
            "releaseYear": 2024,
            "createdAt": "2024-01-15T12:00:00.000Z",
            "popularity": 85,
            "likeCount": 0,
            "likedBy": [],
            "seasons": [
                { 
                    "seasonNumber": 1, 
                    "episodes": [
                        { "episodeNumber": 1, "link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
                    ] 
                }
            ] 
        }
    ]
};

// For a more dynamic database without manual updates, consider using a real-time database like Firebase Firestore.
// It allows direct updates from the client-side, making changes instantly available to all users.
function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] instanceof Object && key in target) {
            if (Array.isArray(source[key])) {
                 // Simple array merge: just overwrite, as deep merging arrays with objects is complex
                 // and not required for this DB structure.
                 target[key] = source[key];
            } else {
                target[key] = deepMerge(target[key], source[key]);
            }
        } else {
             target[key] = source[key];
        }
    }
    return target;
}

export async function initDB() {
    let dbData = null;
    let localData = localStorage.getItem(DB_NAME);

    try {
        const response = await fetch(`${REMOTE_DB_URL}?t=${new Date().getTime()}`); // bust cache
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        dbData = await response.json();
        console.log('Banco de dados carregado do GitHub com sucesso.');
    } catch (error) {
        console.warn('Erro ao carregar JSON do GitHub, usando localStorage como fallback:', error);
        if (localData) {
            try {
                dbData = JSON.parse(localData);
            } catch (e) {
                console.error("Error parsing local DB, initializing with default.", e);
                // If local data is corrupt, fall through to use initialData
            }
        }
    }

    // If no data from remote or local, initialize with default data.
    if (!dbData) {
        console.log("Nenhum banco de dados encontrado. Inicializando com dados padrão.");
        dbData = JSON.parse(JSON.stringify(initialData));
    } else {
        // Ensure the database has the full structure, using initialData as a template
        // This prevents errors if the loaded DB is missing new keys.
        dbData = deepMerge(dbData, JSON.parse(JSON.stringify(initialData)));
    }
    
    saveDB(dbData);
}

export function getDB() {
    try {
        const db = JSON.parse(localStorage.getItem(DB_NAME));
        // Fallback for safety, though initDB should prevent this.
        if (!db) return JSON.parse(JSON.stringify(initialData));
        return db;
    } catch (e) {
        console.error("Failed to parse DB from localStorage, returning initial data.", e);
        return JSON.parse(JSON.stringify(initialData));
    }
}

export function saveDB(db) {
    // Data migration/ensure structure: Ensure the 'tests' array exists.
    // This prevents errors if loading data from an older schema.
    if (db && db.users && !Array.isArray(db.users.tests)) {
        /* @tweakable [Default value for the 'tests' array if it's missing from the database] */
        db.users.tests = [];
    }
    if (db && db.users && db.users.clients) {
        db.users.clients.forEach(client => {
            if (!Array.isArray(client.favorites)) {
                client.favorites = [];
            }
        });
    }
    if (db && !Array.isArray(db.animes)) {
        db.animes = [];
    }
    // Ensure series and animes have like properties
    ['series', 'animes'].forEach(type => {
        if (db && Array.isArray(db[type])) {
            db[type].forEach(item => {
                if (typeof item.likeCount !== 'number') {
                    item.likeCount = 0;
                }
                if (!Array.isArray(item.likedBy)) {
                    item.likedBy = [];
                }
            });
        }
    });
    localStorage.setItem(DB_NAME, JSON.stringify(db));
}

export function exportDB() {
    // Após exportar, faça upload manual do arquivo cinemaDB.json para https://future-xrl.github.io/MeuFlix/ no repositório do GitHub e faça commit para atualizar os dados para todos os usuários.
    const dbData = JSON.stringify(getDB(), null, 2);
    const blob = new Blob([dbData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cinemaDB.json';
    a.click();
    URL.revokeObjectURL(url);
}

export function importDB(file, callback) {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            // Basic structure validation
            if (importedData.config && importedData.users && importedData.movies && importedData.series) {
                if (confirm("Deseja substituir os dados existentes? Esta ação não pode ser desfeita.")) {
                    // Ensure new arrays exist if importing old data structure
                    if (!importedData.users.tests) {
                        importedData.users.tests = [];
                    }
                    if (!importedData.animes) {
                        importedData.animes = [];
                    }
                    saveDB(importedData);
                    callback(true);
                }
            } else {
                alert("Erro: Arquivo JSON inválido ou com estrutura incorreta.");
                callback(false);
            }
        } catch (error) {
            alert("Erro ao analisar o arquivo JSON.");
            callback(false);
        }
    };
    reader.readAsText(file);
}

export function resetDB() {
    if (confirm("Tem certeza que deseja resetar?")) {
        if (confirm("Essa ação não pode ser desfeita. Todos os dados serão perdidos. Deseja continuar?")) {
            localStorage.removeItem(DB_NAME);
            // Re-initialize with default data, as remote might be unavailable
            localStorage.setItem(DB_NAME, JSON.stringify(initialData));
            return true;
        }
    }
    return false;
}