const DB_NAME = 'cinemaDB';
/* @tweakable [The URL of the remote JSON database file] */
const REMOTE_DB_URL = 'https://future-xrl.github.io/MeuFlix/cinemaDB.json';

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
                "status": "válido" 
            }
        ]
    },
    "movies": [
        { 
            "id": `movie_${Date.now()}`, 
            "name": "Filme Exemplo", 
            "description": "Esta é a descrição de um filme de exemplo para demonstração. A trama é sobre aventura e descobertas.", 
            "cover": "https://via.placeholder.com/400x600.png/222/f5f5f5?text=Filme+Exemplo", 
            "link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 
        }
    ],
    "series": [
        { 
            "id": `series_${Date.now()}`, 
            "name": "Série Exemplo", 
            "description": "Resumo da série de exemplo com uma temporada e um episódio.", 
            "cover": "https://via.placeholder.com/400x600.png/222/f5f5f5?text=Série+Exemplo", 
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

export async function initDB() {
    try {
        const response = await fetch(`${REMOTE_DB_URL}?t=${new Date().getTime()}`); // bust cache
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const remoteData = await response.json();
        console.log('Banco de dados carregado do GitHub com sucesso.');
        saveDB(remoteData);
    } catch (error) {
        console.warn('Erro ao carregar JSON do GitHub, usando localStorage como fallback:', error);
        // If remote fetch fails, check if there's data in localStorage. If not, initialize it.
        if (!localStorage.getItem(DB_NAME)) {
            localStorage.setItem(DB_NAME, JSON.stringify(initialData));
        }
    }
}

export function getDB() {
    return JSON.parse(localStorage.getItem(DB_NAME));
}

export function saveDB(db) {
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