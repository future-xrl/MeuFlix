import { getDB } from 'db';
import { renderLayout } from 'views/admin/Layout';

export function renderDashboardPage(container) {
    const db = getDB();
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const activeClients = db.users.clients.filter(c => c.status === 'ativo' && new Date(c.expiresAt) > now).length;
    const expiringSoon = db.users.clients.filter(c => {
        const expiresAt = new Date(c.expiresAt);
        return expiresAt > now && expiresAt <= sevenDaysFromNow;
    }).length;
    const expiredClients = db.users.clients.filter(c => new Date(c.expiresAt) < now).length;

    const content = `
        <div class="dashboard-grid">
            <div class="dashboard-card">
                <div class="count">${activeClients}</div>
                <div class="title">Total de Clientes Ativos</div>
            </div>
            <div class="dashboard-card">
                <div class="count">${expiringSoon}</div>
                <div class="title">Clientes Vencendo em 7 dias</div>
            </div>
            <div class="dashboard-card">
                <div class="count">${expiredClients}</div>
                <div class="title">Clientes que Já Venceram</div>
            </div>
             <div class="dashboard-card">
                <div class="count">0</div>
                <div class="title">Clientes Online (Simulado)</div>
            </div>
        </div>
    `;
    renderLayout(container, content, 'Painel');
}