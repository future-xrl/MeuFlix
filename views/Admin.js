import { renderDashboardPage } from 'views/admin/Dashboard';
import { renderGenerateTestPage } from 'views/admin/GenerateTest';
import { renderMyTestsPage } from 'views/admin/MyTests';
import { renderManageClientsPage } from 'views/admin/ManageClients';
import { renderAddMoviePage } from 'views/admin/AddMovie';
import { renderAddSeriesPage } from 'views/admin/AddSeries';
import { renderAddAnimePage } from 'views/admin/AddAnime';
import { renderBackupPage } from 'views/admin/Backup';
import { renderDebugPage } from 'views/admin/Debug';

export function renderAdminPanel(container, path) {
    const subpage = path.split('/')[2] || 'painel';
    switch (subpage) {
        case 'painel':
            renderDashboardPage(container);
            break;
        case 'gerar-teste':
            renderGenerateTestPage(container);
            break;
        case 'meus-testes':
            renderMyTestsPage(container);
            break;
        case 'gerenciar-clientes':
            renderManageClientsPage(container);
            break;
        case 'adicionar-filme':
            renderAddMoviePage(container);
            break;
        case 'adicionar-serie':
            renderAddSeriesPage(container);
            break;
        case 'adicionar-anime':
            renderAddAnimePage(container);
            break;
        case 'backup':
            renderBackupPage(container);
            break;
        case 'debug':
            renderDebugPage(container);
            break;
        default:
            renderDashboardPage(container);
    }
}

