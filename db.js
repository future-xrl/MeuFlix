const DB_NAME = 'cinemaDB';

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

export function initDB() {
    if (!localStorage.getItem(DB_NAME)) {
        localStorage.setItem(DB_NAME, JSON.stringify(initialData));
    }
}

export function getDB() {
    return JSON.parse(localStorage.getItem(DB_NAME));
}

export function saveDB(db) {
    localStorage.setItem(DB_NAME, JSON.stringify(db));
}

export function exportDB() {
    const dbData = JSON.stringify(getDB(), null, 2);
    const blob = new Blob([dbData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup.json';
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
            initDB();
            return true;
        }
    }
    return false;
}

