// ==========================================================
// BEEFLUX - FRONT-END DO MÓDULO FINANCEIRO
// INTEGRAÇÃO COMPLETA: REQUISITOS ATENDIDOS
// ==========================================================

const API_FINANCEIRO_URL = 'http://localhost:3000/api/financeiro';

let chartBarra = null;
let chartPizza = null;
let despesasAtuais = [];
let retiradasAtuais = [];

// ==========================================================
// UTILITÁRIOS: TOAST NOTIFICATIONS E LOADERS
// ==========================================================
function mostrarNotificacao(mensagem, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return alert(mensagem);
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    
    let icon = 'fa-circle-check';
    if (tipo === 'error') icon = 'fa-circle-xmark';
    if (tipo === 'info') icon = 'fa-circle-info';
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${mensagem}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getEstadoCarregamento(colSpan) {
    return `<tr><td colspan="${colSpan}"><div class="loader-container"><div class="loader"></div><p>Carregando dados...</p></div></td></tr>`;
}

function getEstadoVazio(colSpan, mensagem, icone = 'fa-folder-open') {
    return `<tr><td colspan="${colSpan}"><div class="empty-state"><i class="fa-solid ${icone}"></i><p>${mensagem}</p></div></td></tr>`;
}

// ==========================================================
// INICIALIZAÇÃO E NAVEGAÇÃO
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Configura datas iniciais padrão para filtros
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

    const inputDe = document.getElementById('dash-data-de');
    const inputAte = document.getElementById('dash-data-ate');
    if (inputDe) inputDe.value = primeiroDia;
    if (inputAte) inputAte.value = ultimoDia;

    // Configura data padrão no modal de retirada
    const inputRetiradaData = document.getElementById('retirada-data');
    if (inputRetiradaData) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        inputRetiradaData.value = now.toISOString().slice(0, 16);
    }

    // Carrega aba inicial
    carregarResumoDashboard();
});

function alternarAba(nomeAba) {
    document.querySelectorAll('.aba-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.conteudo-aba').forEach(sec => sec.classList.remove('ativo'));

    const btn = document.querySelector(`.aba-btn[data-aba="${nomeAba}"]`);
    const sec = document.getElementById(`aba-${nomeAba}`);

    if (btn) btn.classList.add('active');
    if (sec) sec.classList.add('ativo');

    // Executa a consulta real na API sempre que a aba for focada
    if (nomeAba === 'dashboard') carregarResumoDashboard();
    if (nomeAba === 'movimentacoes') carregarMovimentacoes();
    if (nomeAba === 'despesas') carregarDespesas();
    if (nomeAba === 'retiradas') carregarRetiradas();
}

// ==========================================================
// 1. DASHBOARD
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
        if (!res.ok) throw new Error('Falha ao carregar indicadores financeiros.');
        const dados = await res.json();

        document.getElementById('val-entradas').textContent = `R$ ${Number(dados.total_entradas || 0).toFixed(2)}`;
        document.getElementById('val-saidas').textContent = `R$ ${Number(dados.total_saidas || 0).toFixed(2)}`;
        document.getElementById('val-saldo').textContent = `R$ ${Number(dados.saldo_periodo || 0).toFixed(2)}`;
        document.getElementById('val-pendentes').textContent = `R$ ${Number(dados.despesas_pendentes || 0).toFixed(2)}`;

        renderizarGraficos(dados.total_entradas, dados.total_saidas);
    } catch (e) {
        mostrarNotificacao(e.message, 'error');
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

    const temDados = (entradas > 0 || saidas > 0);

    chartBarra = new Chart(ctxBarra, {
        type: 'bar',
        data: {
            labels: ['Entradas Confirmadas', 'Saídas Registradas'],
            datasets: [{
                label: 'Valor (R$)',
                data: temDados ? [entradas, saidas] : [0, 0],
                backgroundColor: ['#16a34a', '#e11d48'],
                borderRadius: 6
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    chartPizza = new Chart(ctxPizza, {
        type: 'doughnut',
        data: {
            labels: temDados ? ['Entradas', 'Saídas'] : ['Sem Movimentação'],
            datasets: [{
                data: temDados ? [entradas, saidas] : [1],
                backgroundColor: temDados ? ['#16a34a', '#e11d48'] : ['#e2e8f0']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// ==========================================================
// 2. MOVIMENTAÇÕES (FLUXO GERAL)
// ==========================================================
async function carregarMovimentacoes() {
    const tbody = document.getElementById('tabela-movimentacoes-body');
    tbody.innerHTML = getEstadoCarregamento(6);

    const de = document.getElementById('filtro-mov-de').value;
    const ate = document.getElementById('filtro-mov-ate').value;
    const tipo = document.getElementById('filtro-mov-tipo').value;

    let url = `${API_FINANCEIRO_URL}/movimentacoes`;
    const params = new URLSearchParams();
    if (de) params.append('de', de);
    if (ate) params.append('ate', ate);
    if (tipo) params.append('tipo', tipo);
    if (params.toString()) url += `?${params.toString()}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Erro ao buscar fluxo de caixa.');
        const lista = await res.json();

        if (lista.length === 0) {
            tbody.innerHTML = getEstadoVazio(6, 'Nenhuma movimentação encontrada para o período/filtro.', 'fa-money-bill-transfer');
            return;
        }

        tbody.innerHTML = lista.map(m => {
            const origemNome = m.origem === 'PAGAMENTO' ? 'Venda (Pedido)' : 
                               m.origem === 'PAGAMENTO_COMPRA' ? 'Compra (Estoque)' : 
                               m.origem === 'DESPESA' ? 'Despesa Operacional' : 
                               m.origem === 'RETIRADA' ? 'Retirada Proprietário' : m.origem;
                               
            const refTexto = m.id_pedido ? `Ped #${m.id_pedido}` : `Reg #${m.id_referencia}`;

            return `
            <tr>
                <td>${new Date(m.data_mov).toLocaleString('pt-BR')}</td>
                <td><span class="badge-status ${m.tipo === 'ENTRADA' ? 'badge-tipo-entrada' : 'badge-tipo-saida'}">${m.tipo}</span></td>
                <td>${m.categoria}</td>
                <td>${origemNome}</td>
                <td><strong>R$ ${Number(m.valor).toFixed(2)}</strong></td>
                <td>${refTexto}</td>
            </tr>
        `}).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;"><i class="fa-solid fa-triangle-exclamation"></i> ${e.message}</td></tr>`;
    }
}

// ==========================================================
// 3. DESPESAS OPERACIONAIS
// ==========================================================
async function carregarDespesas() {
    const tbody = document.getElementById('tabela-despesas-body');
    tbody.innerHTML = getEstadoCarregamento(7);

    const status = document.getElementById('filtro-despesa-status').value;
    let url = `${API_FINANCEIRO_URL}/despesas`;
    if (status) url += `?status=${status}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Erro ao buscar despesas operacionais.');
        const lista = await res.json();
        despesasAtuais = lista;

        if (lista.length === 0) {
            tbody.innerHTML = getEstadoVazio(7, 'Nenhuma despesa localizada com este filtro.', 'fa-file-invoice-dollar');
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
                    <button class="btn-acao-tabela" onclick="imprimirTemplateDespesa(${d.id_despesa})" title="Imprimir Comprovante"><i class="fa-solid fa-print"></i></button>
                    ${d.status_pagamento === 'PENDENTE' ? `
                        <button class="btn-acao-tabela" onclick="marcarComoPaga(${d.id_despesa})" title="Pagar Despesa"><i class="fa-solid fa-check" style="color: green;"></i></button>
                        <button class="btn-acao-tabela" onclick="abrirModalEditarDespesa(${d.id_despesa})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-acao-tabela" onclick="excluirDespesa(${d.id_despesa})" title="Excluir"><i class="fa-solid fa-trash" style="color: red;"></i></button>
                    ` : '<span style="font-size:0.8rem; color:#888; margin-left:8px;">Travado (Pago)</span>'}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;"><i class="fa-solid fa-triangle-exclamation"></i> ${e.message}</td></tr>`;
    }
}

function abrirModalNovaDespesa() {
    document.getElementById('form-despesa').reset();
    document.getElementById('despesa-id').value = '';
    document.getElementById('modal-despesa-titulo').textContent = 'Cadastrar Nova Despesa';
    document.getElementById('despesa-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-despesa').classList.add('active');
}

function abrirModalEditarDespesa(idDespesa) {
    const d = despesasAtuais.find(x => x.id_despesa === idDespesa);
    if (!d) return mostrarNotificacao('Despesa não encontrada na memória.', 'error');
    if (d.status_pagamento === 'PAGO') return mostrarNotificacao('Despesas pagas não podem ser editadas.', 'error');

    document.getElementById('despesa-id').value = d.id_despesa;
    document.getElementById('despesa-descricao').value = d.descricao_despesa;
    document.getElementById('despesa-categoria').value = d.categoria_despesa;
    document.getElementById('despesa-valor').value = d.valor_despesa;
    document.getElementById('despesa-data').value = d.data_despesa;
    document.getElementById('despesa-vencimento').value = d.data_vencimento || '';
    document.getElementById('despesa-observacao').value = d.observacao || '';
    document.getElementById('modal-despesa-titulo').textContent = 'Editar Despesa Pendente';
    document.getElementById('modal-despesa').classList.add('active');
}

function fecharModalDespesa() {
    document.getElementById('modal-despesa').classList.remove('active');
}

async function salvarDespesa(e) {
    e.preventDefault();
    const btnSalvar = document.getElementById('btn-salvar-despesa');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

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
        if (!res.ok) throw new Error(dados.mensagem || 'Erro ao comunicar com a API.');

        mostrarNotificacao(id ? 'Despesa atualizada com sucesso!' : 'Nova despesa registrada!', 'success');
        fecharModalDespesa();
        carregarDespesas();
        carregarResumoDashboard();
    } catch (err) {
        mostrarNotificacao(err.message, 'error');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = '<i class="fa-solid fa-check"></i> Salvar';
    }
}

async function marcarComoPaga(id) {
    if (!confirm('CONFIRMAÇÃO:\nDeseja marcar esta despesa como PAGA?\nEsta ação lançará o valor no fluxo de caixa real e bloqueará a despesa contra edições.')) return;
    
    try {
        const res = await fetch(`${API_FINANCEIRO_URL}/despesas/${id}/pagar`, { method: 'PATCH' });
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.mensagem || 'Erro ao efetivar pagamento.');
        
        mostrarNotificacao('Despesa confirmada como PAGA. Saldo atualizado.', 'success');
        carregarDespesas(); 
        carregarResumoDashboard();
    } catch (err) { 
        mostrarNotificacao(err.message, 'error'); 
    }
}

async function excluirDespesa(id) {
    if (!confirm('Deseja realmente EXCLUIR permanentemente esta despesa pendente?')) return;
    
    try {
        const res = await fetch(`${API_FINANCEIRO_URL}/despesas/${id}`, { method: 'DELETE' });
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.mensagem || 'Erro ao excluir.');
        
        mostrarNotificacao('Despesa excluída com sucesso.', 'info');
        carregarDespesas();
        carregarResumoDashboard();
    } catch (err) { 
        mostrarNotificacao(err.message, 'error'); 
    }
}

// ==========================================================
// 4. RETIRADAS DO PROPRIETÁRIO
// ==========================================================
async function carregarRetiradas() {
    const tbody = document.getElementById('tabela-retiradas-body');
    tbody.innerHTML = getEstadoCarregamento(6);

    try {
        const res = await fetch(`${API_FINANCEIRO_URL}/retiradas`);
        if (!res.ok) throw new Error('Erro ao buscar histórico de retiradas.');
        const lista = await res.json();
        retiradasAtuais = lista;

        if (lista.length === 0) {
            tbody.innerHTML = getEstadoVazio(6, 'Nenhuma retirada financeira registrada.', 'fa-hand-holding-dollar');
            return;
        }

        tbody.innerHTML = lista.map(r => `
            <tr>
                <td>#${r.id_retirada}</td>
                <td>${r.nome_user || 'Usuário Desconhecido'}</td>
                <td>${r.descricao_retirada || 'Sangria / Retirada'}</td>
                <td>${new Date(r.data_retirada).toLocaleString('pt-BR')}</td>
                <td><strong style="color: #be123c;">- R$ ${Number(r.valor_retirada).toFixed(2)}</strong></td>
                <td style="text-align: right;">
                    <button class="btn-acao-tabela" onclick="imprimirTemplateRetirada(${r.id_retirada})" title="Imprimir Comprovante"><i class="fa-solid fa-print"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;"><i class="fa-solid fa-triangle-exclamation"></i> ${e.message}</td></tr>`;
    }
}

function abrirModalNovaRetirada() {
    document.getElementById('form-retirada').reset();
    document.getElementById('modal-retirada').classList.add('active');
}

function fecharModalRetirada() {
    document.getElementById('modal-retirada').classList.remove('active');
}

async function salvarRetirada(e) {
    e.preventDefault();
    
    const idUser = localStorage.getItem('beeflux_usuario_id');
    if (!idUser || idUser === 'null') {
        mostrarNotificacao('ERRO DE AUTENTICAÇÃO: Usuário não identificado. Faça login no sistema.', 'error');
        return;
    }

    const btnSalvar = document.getElementById('btn-salvar-retirada');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';

    const payload = {
        id_user: Number(idUser),
        valor_retirada: Number(document.getElementById('retirada-valor').value),
        data_retirada: document.getElementById('retirada-data').value,
        descricao_retirada: document.getElementById('retirada-descricao').value || null
    };

    try {
        const res = await fetch(`${API_FINANCEIRO_URL}/retiradas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const dados = await res.json();
        if (!res.ok) throw new Error(dados.mensagem || 'Falha ao processar retirada.');

        mostrarNotificacao('Retirada registrada com sucesso. O saldo foi atualizado.', 'success');
        fecharModalRetirada();
        carregarRetiradas();
        carregarResumoDashboard();
    } catch (err) {
        mostrarNotificacao(err.message, 'error');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Retirada';
    }
}

// ==========================================================
// 5. TEMPLATES DE COMPROVANTES (IMPRESSÃO)
// ==========================================================
function imprimirTemplateDespesa(id) {
    const d = despesasAtuais.find(x => x.id_despesa === id);
    if (!d) return mostrarNotificacao('Dados do comprovante não encontrados.', 'error');
    
    const janela = window.open('', '_blank', 'width=600,height=600');
    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8"><title>Comprovante de Despesa</title>
            <style>
                body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #111; max-width: 400px; margin: 0 auto; }
                .cupom { border: 1px dashed #555; padding: 20px; }
                .header { text-align: center; border-bottom: 1px dashed #555; padding-bottom: 10px; margin-bottom: 15px; }
                .header h2 { margin: 0 0 5px 0; font-size: 1.5em; }
                .header h3 { margin: 0; font-size: 1.1em; font-weight: normal; }
                .info { margin-bottom: 8px; font-size: 0.95em; line-height: 1.4; }
                .total { font-size: 1.2em; font-weight: bold; margin-top: 15px; border-top: 1px dashed #555; padding-top: 15px; text-align: right; }
                .rodape { text-align: center; font-size: 0.8em; margin-top: 20px; color: #666; }
                @media print { body { -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <div class="cupom">
                <div class="header"><h2>BEEFLUX</h2><h3>Comprovante de Despesa</h3></div>
                <div class="info"><strong>ID Registro:</strong> #${d.id_despesa}</div>
                <div class="info"><strong>Descrição:</strong> ${d.descricao_despesa}</div>
                <div class="info"><strong>Categoria:</strong> ${d.categoria_despesa}</div>
                <div class="info"><strong>Data Registro:</strong> ${new Date(d.data_despesa + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                <div class="info"><strong>Vencimento:</strong> ${d.data_vencimento ? new Date(d.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</div>
                <div class="info"><strong>Status:</strong> ${d.status_pagamento}</div>
                ${d.observacao ? `<div class="info"><strong>Obs:</strong> ${d.observacao}</div>` : ''}
                <div class="total">VALOR TOTAL: R$ ${Number(d.valor_despesa).toFixed(2)}</div>
                <div class="rodape">Gerado em ${new Date().toLocaleString('pt-BR')} via BeeFlux</div>
            </div>
            <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
    `);
    janela.document.close();
}

function imprimirTemplateRetirada(id) {
    const r = retiradasAtuais.find(x => x.id_retirada === id);
    if (!r) return mostrarNotificacao('Dados do comprovante não encontrados.', 'error');
    
    const janela = window.open('', '_blank', 'width=600,height=600');
    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8"><title>Comprovante de Retirada</title>
            <style>
                body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #111; max-width: 400px; margin: 0 auto; }
                .cupom { border: 1px dashed #555; padding: 20px; }
                .header { text-align: center; border-bottom: 1px dashed #555; padding-bottom: 10px; margin-bottom: 15px; }
                .header h2 { margin: 0 0 5px 0; font-size: 1.5em; }
                .header h3 { margin: 0; font-size: 1.1em; font-weight: normal; }
                .info { margin-bottom: 8px; font-size: 0.95em; line-height: 1.4; }
                .total { font-size: 1.2em; font-weight: bold; margin-top: 15px; border-top: 1px dashed #555; padding-top: 15px; text-align: right; }
                .rodape { text-align: center; font-size: 0.8em; margin-top: 20px; color: #666; }
                .assinatura { margin-top: 40px; border-top: 1px solid #111; width: 80%; text-align: center; padding-top: 5px; margin-left: auto; margin-right: auto; font-size: 0.9em;}
            </style>
        </head>
        <body>
            <div class="cupom">
                <div class="header"><h2>BEEFLUX</h2><h3>Comprovante de Retirada</h3></div>
                <div class="info"><strong>ID Registro:</strong> #${r.id_retirada}</div>
                <div class="info"><strong>Usuário:</strong> ${r.nome_user || 'Admin'}</div>
                <div class="info"><strong>Data/Hora:</strong> ${new Date(r.data_retirada).toLocaleString('pt-BR')}</div>
                <div class="info"><strong>Motivo/Desc:</strong> ${r.descricao_retirada || 'Retirada/Sangria de Caixa'}</div>
                <div class="total">VALOR RETIRADO: R$ ${Number(r.valor_retirada).toFixed(2)}</div>
                <div class="assinatura">Assinatura do Responsável</div>
                <div class="rodape">Gerado em ${new Date().toLocaleString('pt-BR')} via BeeFlux</div>
            </div>
            <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
    `);
    janela.document.close();
}
