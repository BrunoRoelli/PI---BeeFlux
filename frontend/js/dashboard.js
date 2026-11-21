// ==========================================================
// BEEFLUX - FRONT-END DA PÁGINA INICIAL (DASHBOARD)
// ==========================================================

const API_BASE_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    // Quando a página abre, dispara a busca de tudo no banco de dados!
    carregarResumoFinanceiro();
    carregarResumoPedidos();
    carregarResumoReceitas();
    carregarResumoClientes();
    carregarProximasEncomendas();
});

// 1. Carrega Faturamento do Mês
async function carregarResumoFinanceiro() {
    const elFaturamento = document.getElementById('dash-faturamento');
    if(!elFaturamento) return;
    elFaturamento.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:1rem;"></i>';

    const hoje = new Date();
    // Pega o primeiro e o último dia do mês atual
    const de = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

    try {
        const res = await fetch(`${API_BASE_URL}/financeiro/resumo?de=${de}&ate=${ate}`);
        if (!res.ok) throw new Error('Erro');
        const dados = await res.json();
        
        elFaturamento.textContent = `R$ ${Number(dados.total_entradas || 0).toFixed(2)}`;
    } catch (e) {
        elFaturamento.textContent = 'Erro de API';
    }
}

// 2. Carrega Total de Pedidos Feitos Hoje
async function carregarResumoPedidos() {
    const elPedidos = document.getElementById('dash-pedidos');
    if(!elPedidos) return;
    elPedidos.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:1rem;"></i>';

    try {
        const res = await fetch(`${API_BASE_URL}/pedidos`);
        if (!res.ok) throw new Error('Erro');
        const lista = await res.json();
        
        const hojeIso = new Date().toISOString().split('T')[0];
        // Conta só os pedidos de hoje
        const pedidosHoje = lista.filter(p => p.data_pedido && p.data_pedido.startsWith(hojeIso));
        
        elPedidos.textContent = pedidosHoje.length;
    } catch (e) {
        elPedidos.textContent = '-';
    }
}

// 3. Carrega Total de Receitas Cadastradas
async function carregarResumoReceitas() {
    const elReceitas = document.getElementById('dash-receitas');
    if(!elReceitas) return;
    elReceitas.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:1rem;"></i>';

    try {
        const res = await fetch(`${API_BASE_URL}/receitas`);
        if (!res.ok) throw new Error('Erro');
        const lista = await res.json();
        elReceitas.textContent = lista.length;
    } catch (e) {
        elReceitas.textContent = '-';
    }
}

// 4. Carrega Total de Clientes Ativos
async function carregarResumoClientes() {
    const elClientes = document.getElementById('dash-clientes');
    if(!elClientes) return;
    elClientes.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:1rem;"></i>';

    try {
        const res = await fetch(`${API_BASE_URL}/contatos/clientes`);
        if (!res.ok) throw new Error('Erro');
        const lista = await res.json();
        // Filtra só os clientes marcados como ativos
        const ativos = lista.filter(c => c.ativo !== 0 && c.ativo !== false);
        elClientes.textContent = ativos.length;
    } catch (e) {
        elClientes.textContent = '-';
    }
}

// 5. Carrega Próximas Encomendas do Dia (Tabela)
async function carregarProximasEncomendas() {
    const tbody = document.getElementById('tabela-encomendas-body');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Buscando encomendas de hoje...</td></tr>';

    try {
        const res = await fetch(`${API_BASE_URL}/pedidos`);
        if (!res.ok) throw new Error('Falha na API');
        const lista = await res.json();
        
        const hojeIso = new Date().toISOString().split('T')[0];
        
        // Filtra pedidos AGENDADOS para HOJE que ainda NÃO terminaram
        const encomendasHoje = lista.filter(p => 
            p.tipo_pedido === 'AGENDADO' && 
            p.data_pedido && p.data_pedido.startsWith(hojeIso) &&
            !['CONCLUIDO', 'CANCELADO'].includes(p.status_pedido)
        );

        if (encomendasHoje.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b;">Nenhuma encomenda agendada pendente para hoje. 🍰</td></tr>';
            return;
        }

        // Ordena por horário (do mais cedo para o mais tarde)
        encomendasHoje.sort((a, b) => new Date(a.data_pedido) - new Date(b.data_pedido));

        // Limita a tabela para mostrar no máximo as 5 próximas encomendas (para não explodir a tela)
        const top5 = encomendasHoje.slice(0, 5);

        tbody.innerHTML = top5.map(enc => {
            // Mapeamento visual das cores do Status
            let badgeClass = 'badge info'; 
            if (enc.status_pedido === 'PENDENTE') badgeClass = 'badge warning';
            if (enc.status_pedido === 'EM_PREPARACAO') badgeClass = 'badge primary';
            if (enc.status_pedido === 'PRONTO') badgeClass = 'badge success';
            
            const hora = new Date(enc.data_pedido).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            return `
                <tr>
                    <td><strong>${enc.nome_cliente || 'Cliente não id.'}</strong></td>
                    <td>Pedido #${enc.id_pedido} - Total: R$ ${Number(enc.valor_total).toFixed(2)}</td>
                    <td>${hora}</td>
                    <td><span class="${badgeClass}">${enc.status_pedido.replace('_', ' ')}</span></td>
                </tr>
            `;
        }).join('');
        
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#e11d48;"><i class="fa-solid fa-triangle-exclamation"></i> Falha ao carregar encomendas reais.</td></tr>';
    }
}

// ==========================================================
// 6. BOTÕES DE ACESSO RÁPIDO
// ==========================================================
function abrirCadastroContato() {
    window.location.href = "html/contatos.html?abrirModal=true"; 
}
function abrirEstoque() {
    window.location.href = "html/estoque.html?abrirModal=true";
}
function abrirFinanceiro() {
    window.location.href = "html/financeiro.html?abrirModal=true";
}
function abrirReceitas() {
    window.location.href = "html/receitas.html?abrirModal=true";
}
function abrirNovoPedido() {
    window.location.href = "html/pedidos.html?abrirModal=true";
}