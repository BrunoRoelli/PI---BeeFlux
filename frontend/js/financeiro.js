// ==========================================================
// BEEFLUX - FRONT-END DO MÓDULO FINANCEIRO
// API: http://localhost:3000/api/financeiro
// ==========================================================

const API_FINANCEIRO_URL = 'http://localhost:3000/api/financeiro';

let chartBarra = null;
let chartPizza = null;

document.addEventListener('DOMContentLoaded', () => {
    // Define datas padrão (Mês Atual)
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

    const inputDe = document.getElementById('dash-data-de');
    const inputAte = document.getElementById('dash-data-ate');

    if (inputDe) inputDe.value = primeiroDia;
    if (inputAte) inputAte.value = ultimoDia;

    carregarResumoDashboard();
    carregarMovimentacoes();
    carregarDespesas();
    carregarRetiradas();
});

function alternarAba(nomeAba) {
    document.querySelectorAll('.aba-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.conteudo-aba').forEach(sec => sec.classList.remove('ativo'));

    const btn = document.querySelector(`.aba-btn[data-aba="${nomeAba}"]`);
    const sec = document.getElementById(`aba-${nomeAba}`);

    if (btn) btn.classList.add('active');
    if (sec) sec.classList.add('ativo');

    if (nomeAba === 'dashboard') carregarResumoDashboard();
    if (nomeAba === 'movimentacoes') carregarMovimentacoes();
    if (nomeAba === 'despesas') carregarDespesas();
    if (nomeAba === 'retiradas') carregarRetiradas();
}

// ==========================================================
// 1. VISÃO GERAL / DASHBOARD
// ==========================================================
async function carregarResumoDashboard() {
    const de = document.getElementById('dash-data-de').value;
    const ate = document.getElementById('dash-data-ate').value;

    let url = `${API_FINANCEIRO_URL}/resumo`;
    const params = new URLSearchParams();
    if (de) params.append('de', de);
    if (ate) params.append('ate', ate);
    if (params.toString()) url += `?${params.toString()}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Falha ao carregar dados do resumo.');
        const dados = await res.json();

        document.getElementById('val-entradas').textContent = `R$ ${Number(dados.total_entradas || 0).toFixed(2)}`;
        document.getElementById('val-saidas').textContent = `R$ ${Number(dados.total_saidas || 0).toFixed(2)}`;
        document.getElementById('val-saldo').textContent = `R$ ${Number(dados.saldo_periodo || 0).toFixed(2)}`;
        document.getElementById('val-pendentes').textContent = `R$ ${Number(dados.despesas_pendentes || 0).toFixed(2)}`;

        renderizarGraficos(dados.total_entradas, dados.total_saidas);
    } catch (e) {
        console.error(e);
    }
}

function limparFiltroDashboard() {
    document.getElementById('dash-data-de').value = '';
    document.getElementById('dash-data-ate').value = '';
    carregarResumoDashboard();
}

function renderizarGraficos(entradas, saidas) {
    const ctxBarra = document.getElementById('grafico-financeiro');
    const ctxPizza = document.getElementById('grafico-pizza');

    if (!ctxBarra || !ctxPizza) return;

    if (chartBarra) chartBarra.destroy();
    if (chartPizza) chartPizza.destroy();

    chartBarra = new Chart(ctxBarra, {
        type: 'bar',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                label: 'Valor (R$)',
                data: [entradas, saidas],
                backgroundColor: ['#16a34a', '#e11d48'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    chartPizza = new Chart(ctxPizza, {
        type: 'doughnut',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                data: [entradas, saidas],
                backgroundColor: ['#16a34a', '#e11d48']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// ==========================================================
// 2. MOVIMENTAÇÕES
// ==========================================================
async function carregarMovimentacoes() {
    const de = document.getElementById('filtro-mov-de').value;
    const ate = document.getElementById('filtro-mov-ate').value;
    const tipo = document.getElementById('filtro-mov-tipo').value;

    let url = `${API_FINANCEIRO_URL}/movimentacoes`;
    const params = new URLSearchParams();
    if (de) params.append('de', de);
    if (ate) params.append('ate', ate);
    if (tipo) params.append('tipo', tipo);
    if (params.toString()) url += `?${params.toString()}`;

    const tbody = document.getElementById('tabela-movimentacoes-body');
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Erro ao buscar movimentações.');
        const lista = await res.json();

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma movimentação encontrada.</td></tr>';
            return;
        }

        tbody.innerHTML = lista.map(m => `
            <tr>
                <td>${new Date(m.data_mov).toLocaleString('pt-BR')}</td>
                <td><span class="badge-status ${m.tipo === 'ENTRADA' ? 'badge-tipo-entrada' : 'badge-tipo-saida'}">${m.tipo}</span></td>
                <td>${m.categoria}</td>
                <td>${m.origem}</td>
                <td><strong>R$ ${Number(m.valor).toFixed(2)}</strong></td>
                <td>${m.id_pedido ? `#${m.id_pedido}` : '-'}</td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">${e.message}</td></tr>`;
    }
}

// ==========================================================
// 3. DESPESAS
// ==========================================================
async function carregarDespesas() {
    const status = document.getElementById('filtro-despesa-status').value;
    let url = `${API_FINANCEIRO_URL}/despesas`;
    if (status) url += `?status=${status}`;

    const tbody = document.getElementById('tabela-despesas-body');
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Erro ao buscar despesas.');
        const lista = await res.json();

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhuma despesa cadastrada.</td></tr>';
            return;
        }

        tbody.innerHTML = lista.map(d => `
            <tr>
                <td><strong>${d.descricao_despesa}</strong></td>
                <td>${d.categoria_despesa}</td>
                <td>R$ ${Number(d.valor_despesa).toFixed(2)}</td>
                <td>${new Date(d.data_despesa + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${d.data_vencimento ? new Date(d.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                <td><span class="badge-status ${d.status_pagamento === 'PAGO' ? 'badge-status-pago' : 'badge-status-pendente'}">${d.status_pagamento}</span></td>
                <td style="text-align: right;">
                    ${d.status_pagamento === 'PENDENTE' ? `
                        <button class="btn-acao-tabela" onclick="marcarComoPaga(${d.id_despesa})" title="Pagar"><i class="fa-solid fa-check"></i></button>
                        <button class="btn-acao-tabela" onclick="abrirModalEditarDespesa(${JSON.stringify(d).replace(/"/g, '&quot;')})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-acao-tabela" style="color:red;" onclick="excluirDespesa(${d.id_despesa})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                    ` : '<span style="font-size:0.8rem; color:#888;">Quitado</span>'}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">${e.message}</td></tr>`;
    }
}

function abrirModalNovaDespesa() {
    document.getElementById('form-despesa').reset();
    document.getElementById('despesa-id').value = '';
    document.getElementById('modal-despesa-titulo').textContent = 'Cadastrar Nova Despesa';
    document.getElementById('despesa-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-despesa').style.display = 'flex';
}

function abrirModalEditarDespesa(d) {
    document.getElementById('despesa-id').value = d.id_despesa;
    document.getElementById('despesa-descricao').value = d.descricao_despesa;
    document.getElementById('despesa-categoria').value = d.categoria_despesa;
    document.getElementById('despesa-valor').value = d.valor_despesa;
    document.getElementById('despesa-data').value = d.data_despesa;
    document.getElementById('despesa-vencimento').value = d.data_vencimento || '';
    document.getElementById('despesa-observacao').value = d.observacao || '';
    document.getElementById('modal-despesa-titulo').textContent = 'Editar Despesa';
    document.getElementById('modal-despesa').style.display = 'flex';
}

function fecharModalDespesa() {
    document.getElementById('modal-despesa').style.display = 'none';
}

async function salvarDespesa(e) {
    e.preventDefault();
    const id = document.getElementById('despesa-id').value;
    const payload = {
        descricao_despesa: document.getElementById('despesa-descricao').value,
        categoria_despesa: document.getElementById('despesa-categoria').value,
        valor_despesa: Number(document.getElementById('despesa-valor').value),
        data_despesa: document.getElementById('despesa-data').value,
        data_vencimento: document.getElementById('despesa-vencimento').value || null,
        observacao: document.getElementById('despesa-observacao').value || null
    };

    try {
        const url = id ? `${API_FINANCEIRO_URL}/despesas/${id}` : `${API_FINANCEIRO_URL}/despesas`;
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const dados = await res.json();
        if (!res.ok) throw new Error(dados.mensagem || 'Erro ao salvar despesa.');

        fecharModalDespesa();
        carregarDespesas();
        carregarResumoDashboard();
    } catch (err) {
        alert(err.message);
    }
}

async function marcarComoPaga(id) {
    if (!confirm('Deseja marcar esta despesa como PAGA?')) return;
    try {
        const res = await fetch(`${API_FINANCEIRO_URL}/despesas/${id}/pagar`, { method: 'PATCH' });
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.mensagem || 'Erro ao pagar despesa.');
        carregarDespesas();
        carregarResumoDashboard();
    } catch (err) { alert(err.message); }
}

async function excluirDespesa(id) {
    if (!confirm('Deseja realmente excluir esta despesa pendente?')) return;
    try {
        const res = await fetch(`${API_FINANCEIRO_URL}/despesas/${id}`, { method: 'DELETE' });
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.mensagem || 'Erro ao excluir despesa.');
        carregarDespesas();
        carregarResumoDashboard();
    } catch (err) { alert(err.message); }
}

// ==========================================================
// 4. RETIRADAS
// ==========================================================
async function carregarRetiradas() {
    const tbody = document.getElementById('tabela-retiradas-body');
    try {
        const res = await fetch(`${API_FINANCEIRO_URL}/retiradas`);
        if (!res.ok) throw new Error('Erro ao buscar retiradas.');
        const lista = await res.json();

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma retirada registrada.</td></tr>';
            return;
        }

        tbody.innerHTML = lista.map(r => `
            <tr>
                <td>#${r.id_retirada}</td>
                <td>${r.nome_user || 'Admin'}</td>
                <td>${r.descricao_retirada || 'Retirada'}</td>
                <td>${new Date(r.data_retirada).toLocaleString('pt-BR')}</td>
                <td><strong>R$ ${Number(r.valor_retirada).toFixed(2)}</strong></td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">${e.message}</td></tr>`;
    }
}

function abrirModalNovaRetirada() {
    document.getElementById('form-retirada').reset();
    document.getElementById('modal-retirada').style.display = 'flex';
}

function fecharModalRetirada() {
    document.getElementById('modal-retirada').style.display = 'none';
}

async function salvarRetirada(e) {
    e.preventDefault();
    const idUser = Number(localStorage.getItem('beeflux_usuario_id')) || 1;
    const payload = {
        id_user: idUser,
        valor_retirada: Number(document.getElementById('retirada-valor').value),
        descricao_retirada: document.getElementById('retirada-descricao').value || null
    };

    try {
        const res = await fetch(`${API_FINANCEIRO_URL}/retiradas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const dados = await res.json();
        if (!res.ok) throw new Error(dados.mensagem || 'Erro ao registrar retirada.');

        fecharModalRetirada();
        carregarRetiradas();
        carregarResumoDashboard();
    } catch (err) {
        alert(err.message);
    }
}
