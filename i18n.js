/* @tweakable [Default language for the application] */
const DEFAULT_LANGUAGE = 'pt-BR';

/** @tweakable [Translation strings for different languages] */
const translations = {
    'pt-BR': {
        'dashboard': 'Painel',
        'settings': 'Configurações',
        'generate_test': 'Gerar Teste',
        'my_tests': 'Meus Testes',
        'manage_clients': 'Gerenciar Clientes',
        'add_movie': 'Adicionar Filme',
        'add_series': 'Adicionar Série',
        'add_animes': 'Adicionar Animes',
        'backup_restore': 'Backup/Restaurar',
        'debug': 'Debug',
        'config': 'Config',
        'change_language': 'Mudar Linguagem',
        'language_changed_success': 'Linguagem alterada com sucesso!',
        'publish': 'Publicar',
        'logout': 'Sair',
        // Client specific
        'movies': 'Filmes',
        'series': 'Séries',
        'animes': 'Animes',
        'favorites': 'Favoritos',
        'history': 'Histórico',
        'user_settings': 'Configurações do Usuário',
        'profile': 'Perfil',
    },
    'en': {
        'dashboard': 'Dashboard',
        'settings': 'Settings',
        'generate_test': 'Generate Test',
        'my_tests': 'My Tests',
        'manage_clients': 'Manage Clients',
        'add_movie': 'Add Movie',
        'add_series': 'Add Series',
        'add_animes': 'Add Animes',
        'backup_restore': 'Backup/Restore',
        'debug': 'Debug',
        'config': 'Config',
        'change_language': 'Change Language',
        'language_changed_success': 'Language changed successfully!',
        'publish': 'Publish',
        'logout': 'Logout',
        // Client specific
        'movies': 'Movies',
        'series': 'Series',
        'animes': 'Animes',
        'favorites': 'Favorites',
        'history': 'History',
        'user_settings': 'User Settings',
        'profile': 'Profile',
    },
    'zh-CN': {
        'dashboard': '仪表板',
        'settings': '设置',
        'generate_test': '生成测试',
        'my_tests': '我的测试',
        'manage_clients': '管理客户',
        'add_movie': '添加电影',
        'add_series': '添加系列',
        'add_animes': '添加动漫',
        'backup_restore': '备份/恢复',
        'debug': '调试',
        'config': '配置',
        'change_language': '改变语言',
        'language_changed_success': '语言更改成功！',
        'publish': '发布',
        'logout': '登出',
        // Client specific
        'movies': '电影',
        'series': '系列',
        'animes': '动漫',
        'favorites': '收藏夹',
        'history': '历史',
        'user_settings': '用户设置',
        'profile': '个人资料',
    },
    'es': {
        'dashboard': 'Panel',
        'settings': 'Configuraciones',
        'generate_test': 'Generar Prueba',
        'my_tests': 'Mis Pruebas',
        'manage_clients': 'Administrar Clientes',
        'add_movie': 'Añadir Película',
        'add_series': 'Añadir Serie',
        'add_animes': 'Añadir Animes',
        'backup_restore': 'Copia/Restaurar',
        'debug': 'Depurar',
        'config': 'Config',
        'change_language': 'Cambiar Idioma',
        'language_changed_success': '¡Idioma cambiado con éxito!',
        'publish': 'Publicar',
        'logout': 'Cerrar sesión',
        // Client specific
        'movies': 'Películas',
        'series': 'Series',
        'animes': 'Animes',
        'favorites': 'Favoritos',
        'history': 'Historial',
        'user_settings': 'Configuraciones de Usuario',
        'profile': 'Perfil',
    },
    'pt-PT': {
        'dashboard': 'Painel',
        'settings': 'Configurações',
        'generate_test': 'Gerar Teste',
        'my_tests': 'Meus Testes',
        'manage_clients': 'Gerir Clientes',
        'add_movie': 'Adicionar Filme',
        'add_series': 'Adicionar Série',
        'add_animes': 'Adicionar Animes',
        'backup_restore': 'Cópia/Restaurar',
        'debug': 'Depuração',
        'config': 'Config',
        'change_language': 'Mudar Idioma',
        'language_changed_success': 'Idioma alterado com sucesso!',
        'publish': 'Publicar',
        'logout': 'Sair',
        // Client specific
        'movies': 'Filmes',
        'series': 'Séries',
        'animes': 'Animes',
        'favorites': 'Favoritos',
        'history': 'Histórico',
        'user_settings': 'Definições de Utilizador',
        'profile': 'Perfil',
    },
};

let currentLanguage = localStorage.getItem('language') || localStorage.getItem('clientLanguage') || DEFAULT_LANGUAGE;

export function setLanguage(lang) {
    currentLanguage = lang;
    // Differentiate between admin and client language settings
    if (window.location.hash.includes('/admin')) {
        localStorage.setItem('language', lang);
    } else {
        localStorage.setItem('clientLanguage', lang);
    }
}

export function getLanguage() {
    // Prioritize client language if on client pages
    if (window.location.hash.includes('/cliente')) {
        return localStorage.getItem('clientLanguage') || DEFAULT_LANGUAGE;
    }
    return localStorage.getItem('language') || DEFAULT_LANGUAGE;
}

export function t(key) {
    const lang = getLanguage();
    return translations[lang]?.[key] || translations[DEFAULT_LANGUAGE]?.[key] || key;
}