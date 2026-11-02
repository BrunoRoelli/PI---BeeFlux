// ==========================================================
// BEEFLUX - FRONT-END DO MÓDULO DE PEDIDOS COM AGENDA EM TEMPO REAL
// Integrado com o backend na porta 3000 (/api/pedidos)
// ==========================================================

const API_PEDIDOS_URL = 'http://localhost:3000/api/pedidos';
const API_ESTOQUE_URL = 'http://localhost:3000/api/estoque';

let listaPedidos = [];
let listaProdutosDisponiveis = [];
let itensRascunho = [];

// Estado da Agenda Integrada
let modoAgenda = 'mes'; // 'mes' ou 'semana'
let dataReferenciaAgenda = new Date();

document.addEventListener('DOMContentLoaded', () => {
    carregarPedidos();
    carregarProdutos();
    carregarClientes();

    // Sincronização em tempo real (atualiza a lista e a agenda a cada 10 segundos)
    setInterval(() => {
        carregarPedidosSilencioso();
    }, 10000);
});

async function carregarPedidos() {
    const tbody = document.getElementById('tabela-pedidos-body');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px;">Carregando pedidos...</td></tr>';

    try {
        const res = await fetch(API_PEDIDOS_URL);
        if (!res.ok) throw new Error('Falha ao buscar pedidos da API.');
        listaPedidos = await res.json();
        renderizarTabela(listaPedidos);
        atualizarMetricas(listaPedidos);
        renderizarAgenda();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--pink-escuro); padding: 24px;">Não foi possível conectar à API de pedidos. (${e.message})</td></tr>`;
        renderizarAgenda();
    }
}

// Atualização de background sem piscar a tela
async function carregarPedidosSilencioso() {
    try {
        const res = await fetch(API_PEDIDOS_URL);
        if (!res.ok) return;
        listaPedidos = await res.json();
        filtrarPedidos();
        atualizarMetricas(listaPedidos);
        renderizarAgenda();
    } catch {
        // Falhas silenciosas de rede mantêm o estado atual
    }
}

function renderizarTabela(pedidos) {
    const tbody = document.getElementById('tabela-pedidos-body');
    if (!pedidos || pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px;">Nenhum pedido encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = pedidos.map(p => {
        const clienteNome = p.nome_cliente || (p.tipo_pedido === 'IMEDIATO' ? 'Balcão (Não identificado)' : 'Sem cadastro');
        const dataFormatada = p.data_hora_agendada 
            ? new Date(p.data_hora_agendada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
            : new Date(p.data_pedido).toLocaleDateString('pt-BR');

        return `
            <tr>
                <td><strong>${p.numero_exibicao || '#' + p.id_pedido}</strong></td>
                <td>${clienteNome}</td>
                <td>
                    <span>${p.tipo_pedido}</span> 
                    ${p.tipo_atendimento ? `(${p.tipo_atendimento})` : ''}
                </td>
                <td>${dataFormatada}</td>
                <td><strong>R$ ${Number(p.valor_total).toFixed(2)}</strong></td>
                <td>
                    <span class="badge-status ${p.status_financeiro === 'PAGO' ? 'badge-fin-pago' : 'badge-fin-pendente'}">
                        ${p.status_financeiro || 'PENDENTE'}
                    </span>
                </td>
                <td>
                    <span class="badge-status badge-${p.status_pedido.toLowerCase().replace('_', '-')}">
                        ${p.status_pedido.replace('_', ' ')}
                    </span>
                </td>
                <td style="text-align: right;">
                    <button class="btn-acao-tabela" onclick="abrirDetalhesPedido(${p.id_pedido})">
                        <i class="fa-solid fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function atualizarMetricas(pedidos) {
    const pendentes = pedidos.filter(p => p.status_pedido === 'PENDENTE').length;
    const preparacao = pedidos.filter(p => p.status_pedido === 'EM_PREPARACAO').length;
    const prontos = pedidos.filter(p => p.status_pedido === 'PRONTO').length;
    const faturamento = pedidos.filter(p => p.status_pedido !== 'CANCELADO')
                               .reduce((acc, p) => acc + Number(p.valor_total), 0);

    document.getElementById('total-pendentes').textContent = pendentes;
    document.getElementById('total-em-preparacao').textContent = preparacao;
    document.getElementById('total-prontos').textContent = prontos;
    document.getElementById('total-faturamento').textContent = `R$ ${faturamento.toFixed(2)}`;
}

function filtrarPedidos() {
    const termo = document.getElementById('filtro-busca').value.toLowerCase();
    const tipo = document.getElementById('filtro-tipo').value;
    const status = document.getElementById('filtro-status').value;

    const filtrados = listaPedidos.filter(p => {
        const matchTermo = (p.nome_cliente && p.nome_cliente.toLowerCase().includes(termo)) ||
                           (p.numero_exibicao && p.numero_exibicao.toLowerCase().includes(termo)) ||
                           String(p.id_pedido).includes(termo);
        const matchTipo = !tipo || p.tipo_pedido === tipo;
        const matchStatus = !status || p.status_pedido === status;

        return matchTermo && matchTipo && matchStatus;
    });

    renderizarTabela(filtrados);
}

// ==========================================================
// AGENDA PERSONALIZADA DO BEEFLUX (TEMPO REAL)
// ==========================================================
function alternarVisualizacaoAgenda(modo) {
    modoAgenda = modo;
    document.getElementById('btn-view-mes').classList.toggle('active', modo === 'mes');
    document.getElementById('btn-view-semana').classList.toggle('active', modo === 'semana');
    renderizarAgenda();
}

function navegarPeriodoAgenda(direcao) {
    if (modoAgenda === 'mes') {
        dataReferenciaAgenda.setMonth(dataReferenciaAgenda.getMonth() + direcao);
    } else {
        dataReferenciaAgenda.setDate(dataReferenciaAgenda.getDate() + (direcao * 7));
    }
    renderizarAgenda();
}

function renderizarAgenda() {
    const container = document.getElementById('container-grade-agenda');
    const titulo = document.getElementById('agenda-titulo-data');

    // Filtra apenas pedidos agendados com data válida
    const pedidosAgendados = listaPedidos.filter(p => p.tipo_pedido === 'AGENDADO' && p.data_hora_agendada);

    if (modoAgenda === 'mes') {
        renderizarMes(container, titulo, pedidosAgendados);
    } else {
        renderizarSemana(container, titulo, pedidosAgendados);
    }
}

function renderizarMes(container, tituloEl, pedidos) {
    const ano = dataReferenciaAgenda.getFullYear();
    const mes = dataReferenciaAgenda.getMonth();

    const nomeMes = dataReferenciaAgenda.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    tituloEl.textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);

    const diaSemanaInicio = primeiroDia.getDay(); // 0 = Domingo
    const totalDiasMes = ultimoDia.getDate();

    let html = `
        <div class="calendario-mensal">
            <div class="cal-cabecalho-dia">Dom</div>
            <div class="cal-cabecalho-dia">Seg</div>
            <div class="cal-cabecalho-dia">Ter</div>
            <div class="cal-cabecalho-dia">Qua</div>
            <div class="cal-cabecalho-dia">Qui</div>
            <div class="cal-cabecalho-dia">Sex</div>
            <div class="cal-cabecalho-dia">Sáb</div>
    `;

    // Células do mês anterior para completar a semana
    const ultimoDiaMesAnterior = new Date(ano, mes, 0).getDate();
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
        const diaNum = ultimoDiaMesAnterior - i;
        html += `<div class="cal-dia-celula outro-mes"><span class="cal-dia-numero">${diaNum}</span></div>`;
    }

    const hoje = new Date();
    const ehMesAtual = hoje.getFullYear() === ano && hoje.getMonth() === mes;

    // Células do mês atual
    for (let dia = 1; dia <= totalDiasMes; dia++) {
        const ehHoje = ehMesAtual && hoje.getDate() === dia;
        const dataFormatadaStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

        // Busca pedidos para este dia
        const pedidosDoDia = pedidos.filter(p => {
            const dataPed = p.data_hora_agendada.split('T')[0].split(' ')[0];
            return dataPed === dataFormatadaStr;
        });

        // Ordena por horário
        pedidosDoDia.sort((a, b) => new Date(a.data_hora_agendada) - new Date(b.data_hora_agendada));

        html += `
            <div class="cal-dia-celula ${ehHoje ? 'hoje' : ''}">
                <span class="cal-dia-numero">${dia}</span>
                <div style="display:flex; flex-direction:column; gap:3px; overflow-y:auto; max-height:85px;">
                    ${pedidosDoDia.map(p => criarChipEvento(p)).join('')}
                </div>
            </div>
        `;
    }

    // Dias do próximo mês para fechar a grade (múltiplo de 7)
    const celulasTotais = diaSemanaInicio + totalDiasMes;
    const resto = (7 - (celulasTotais % 7)) % 7;
    for (let prox = 1; prox <= resto; prox++) {
        html += `<div class="cal-dia-celula outro-mes"><span class="cal-dia-numero">${prox}</span></div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

function renderizarSemana(container, tituloEl, pedidos) {
    const dataAtual = new Date(dataReferenciaAgenda);
    const diaSemana = dataAtual.getDay();
    
    // Início da semana (Domingo)
    const inicioSemana = new Date(dataAtual);
    inicioSemana.setDate(dataAtual.getDate() - diaSemana);

    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);

    const formatadorDataCurta = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
    tituloEl.textContent = `${formatadorDataCurta(inicioSemana)} - ${formatadorDataCurta(fimSemana)} de ${fimSemana.getFullYear()}`;

    const hoje = new Date();
    const nomesDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    let html = `<div class="calendario-semanal">`;

    for (let i = 0; i < 7; i++) {
        const diaLoop = new Date(inicioSemana);
        diaLoop.setDate(inicioSemana.getDate() + i);

        const ehHoje = diaLoop.toDateString() === hoje.toDateString();
        const dataFormatadaStr = diaLoop.toISOString().split('T')[0];

        const pedidosDoDia = pedidos.filter(p => {
            const dataPed = p.data_hora_agendada.split('T')[0].split(' ')[0];
            return dataPed === dataFormatadaStr;
        });

        pedidosDoDia.sort((a, b) => new Date(a.data_hora_agendada) - new Date(b.data_hora_agendada));

        html += `
            <div class="coluna-semanal ${ehHoje ? 'hoje' : ''}">
                <div class="coluna-semanal-topo">
                    <strong>${nomesDias[i]}</strong>
                    <span>${diaLoop.getDate()} de ${diaLoop.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; flex:1; overflow-y:auto;">
                    ${pedidosDoDia.length === 0 ? '<span style="font-size:0.75rem; color:#aaa; text-align:center; margin-top:10px;">Sem encomendas</span>' : ''}
                    ${pedidosDoDia.map(p => criarChipEvento(p, true)).join('')}
                </div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

function criarChipEvento(p, detalhado = false) {
    const hora = new Date(p.data_hora_agendada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const cliente = p.nome_cliente || 'Balcão';
    const statusClass = `chip-${p.status_pedido.toLowerCase().replace('_', '-')}`;
    const iconeAtendimento = p.tipo_atendimento === 'ENTREGA' ? '<i class="fa-solid fa-motorcycle"></i>' : '<i class="fa-solid fa-bag-shopping"></i>';

    return `
        <div class="evento-pedido-chip ${statusClass}" onclick="abrirDetalhesPedido(${p.id_pedido})" title="Clique para abrir detalhes">
            <span class="evento-hora">${iconeAtendimento} ${hora} - ${p.numero_exibicao || '#' + p.id_pedido}</span>
            <span class="evento-cliente">${cliente}</span>
            ${detalhado ? `<span style="font-size:0.7rem; font-weight:700;">R$ ${Number(p.valor_total).toFixed(2)} (${p.status_pedido})</span>` : ''}
        </div>
    `;
}

// ==========================================
// MODAL DE DETALHES DO PEDIDO
// ==========================================
async function abrirDetalhesPedido(idPedido) {
    try {
        const res = await fetch(`${API_PEDIDOS_URL}/${idPedido}`);
        if (!res.ok) throw new Error('Não foi possível carregar os detalhes do pedido.');
        const p = await res.json();

        document.getElementById('modal-ped-numero').textContent = p.numero_exibicao || `Pedido #${p.id_pedido}`;
        document.getElementById('modal-ped-data').textContent = `Criado em: ${new Date(p.data_pedido).toLocaleString('pt-BR')}`;
        document.getElementById('modal-ped-cliente').textContent = p.nome_cliente || 'Balcão';
        document.getElementById('modal-ped-telefone').textContent = p.telefone_cliente || 'Não informado';
        document.getElementById('modal-ped-atendimento').textContent = p.agendamento ? `${p.tipo_pedido} (${p.agendamento.tipo_atendimento})` : p.tipo_pedido;
        document.getElementById('modal-ped-financeiro').textContent = p.status_financeiro;
        document.getElementById('modal-ped-taxa').textContent = `R$ ${Number(p.taxa_entrega).toFixed(2)}`;
        document.getElementById('modal-ped-total').textContent = `R$ ${Number(p.valor_total).toFixed(2)}`;

        const enderecoBloco = document.getElementById('modal-ped-endereco-bloco');
        if (p.agendamento && p.agendamento.endereco_entrega) {
            enderecoBloco.style.display = 'block';
            document.getElementById('modal-ped-endereco').textContent = p.agendamento.endereco_entrega;
        } else {
            enderecoBloco.style.display = 'none';
        }

        const tbodyItens = document.getElementById('modal-ped-itens-body');
        tbodyItens.innerHTML = p.itens.map(it => `
            <tr>
                <td>${it.nome_produto} (${it.tipo_produto})</td>
                <td>${it.quantidade} ${it.unidade_medida}</td>
                <td>R$ ${Number(it.preco_unitario).toFixed(2)}</td>
                <td><strong>R$ ${Number(it.subtotal).toFixed(2)}</strong></td>
            </tr>
        `).join('');

        const acoesDiv = document.getElementById('modal-acoes-status');
        acoesDiv.innerHTML = '';

        if (p.status_pedido === 'PENDENTE') {
            acoesDiv.innerHTML = `
                <button class="botao-primario" onclick="atualizarStatus(${p.id_pedido}, 'CONFIRMADO')"><i class="fa-solid fa-check"></i> Confirmar Pedido</button>
                <button class="btn-secondary" style="color: #be123c;" onclick="cancelarPedido(${p.id_pedido})"><i class="fa-solid fa-ban"></i> Cancelar</button>
            `;
        } else if (p.status_pedido === 'CONFIRMADO') {
            acoesDiv.innerHTML = `
                <button class="botao-primario" onclick="atualizarStatus(${p.id_pedido}, 'EM_PREPARACAO')"><i class="fa-solid fa-utensils"></i> Iniciar Produção</button>
                <button class="btn-secondary" style="color: #be123c;" onclick="cancelarPedido(${p.id_pedido})"><i class="fa-solid fa-ban"></i> Cancelar</button>
            `;
        } else if (p.status_pedido === 'EM_PREPARACAO') {
            acoesDiv.innerHTML = `
                <button class="botao-primario" onclick="atualizarStatus(${p.id_pedido}, 'PRONTO')"><i class="fa-solid fa-box"></i> Marcar como Pronto</button>
            `;
        } else if (p.status_pedido === 'PRONTO') {
            acoesDiv.innerHTML = `
                <button class="botao-primario" onclick="atualizarStatus(${p.id_pedido}, 'CONCLUIDO')"><i class="fa-solid fa-circle-check"></i> Concluir Entrega</button>
            `;
        }

        document.getElementById('modal-detalhes-pedido').style.display = 'flex';
    } catch (e) {
        alert(e.message);
    }
}

function fecharModalDetalhes() {
    document.getElementById('modal-detalhes-pedido').style.display = 'none';
}

async function atualizarStatus(idPedido, novoStatus) {
    if (!confirm(`Deseja alterar o status do pedido para ${novoStatus}?`)) return;

    try {
        const idUser = Number(localStorage.getItem('beeflux_usuario_id')) || 1;
        const res = await fetch(`${API_PEDIDOS_URL}/${idPedido}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_pedido: novoStatus, id_user: idUser })
        });
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.mensagem || 'Erro ao atualizar status.');

        fecharModalDetalhes();
        carregarPedidos();
    } catch (e) {
        alert(e.message);
    }
}

async function cancelarPedido(idPedido) {
    const motivo = prompt('Informe o motivo do cancelamento:');
    if (motivo === null) return;

    try {
        const idUser = Number(localStorage.getItem('beeflux_usuario_id')) || 1;
        const res = await fetch(`${API_PEDIDOS_URL}/${idPedido}/cancelar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo, id_user: idUser })
        });
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.mensagem || 'Erro ao cancelar pedido.');

        fecharModalDetalhes();
        carregarPedidos();
    } catch (e) {
        alert(e.message);
    }
}

// ==========================================
// CRIAÇÃO DE NOVO PEDIDO
// ==========================================
function abrirModalNovoPedido() {
    itensRascunho = [];
    atualizarListaRascunho();
    document.getElementById('form-novo-pedido').reset();
    alternarCamposAgendamento();
    document.getElementById('modal-novo-pedido').style.display = 'flex';
}

function fecharModalNovoPedido() {
    document.getElementById('modal-novo-pedido').style.display = 'none';
}

function alternarCamposAgendamento() {
    const tipo = document.getElementById('novo-tipo').value;
    const bloco = document.getElementById('bloco-agendamento');
    bloco.style.display = tipo === 'AGENDADO' ? 'block' : 'none';
    alternarCampoEndereco();
}

function alternarCampoEndereco() {
    const tipo = document.getElementById('novo-tipo').value;
    const atend = document.getElementById('novo-atendimento').value;
    const grupoEnd = document.getElementById('grupo-endereco');
    const grupoTaxa = document.getElementById('grupo-taxa');

    if (tipo === 'AGENDADO' && atend === 'ENTREGA') {
        grupoEnd.style.display = 'block';
        grupoTaxa.style.display = 'block';
    } else {
        grupoEnd.style.display = 'none';
        grupoTaxa.style.display = 'none';
    }
}

async function carregarProdutos() {
    try {
        const res = await fetch(API_ESTOQUE_URL);
        if (!res.ok) return;
        const produtos = await res.json();
        listaProdutosDisponiveis = produtos.filter(p => p.tipo_produto !== 'INGREDIENTE');

        const select = document.getElementById('novo-produto');
        select.innerHTML = listaProdutosDisponiveis.map(p => `
            <option value="${p.id_produto}">${p.nome_produto} (${p.tipo_produto})</option>
        `).join('');
    } catch (e) {
        console.error('Erro ao carregar produtos para o pedido:', e);
    }
}

async function carregarClientes() {
    try {
        const select = document.getElementById('novo-cliente');
        select.innerHTML = '<option value="">Balcão (Sem cadastro)</option>';
        const res = await fetch('http://localhost:3000/api/clientes');
        if (res.ok) {
            const clientes = await res.json();
            clientes.forEach(c => {
                select.innerHTML += `<option value="${c.id_cliente}">${c.nome_cliente} - ${c.telefone_cliente}</option>`;
            });
        }
    } catch {}
}

function adicionarItemRascunho() {
    const select = document.getElementById('novo-produto');
    const qtdInput = document.getElementById('novo-qtd');
    const idProd = Number(select.value);
    const qtd = Number(qtdInput.value);

    if (!idProd || qtd <= 0) return alert('Selecione um produto e uma quantidade válida.');

    const prod = listaProdutosDisponiveis.find(p => p.id_produto === idProd);
    if (!prod) return;

    itensRascunho.push({
        id_produto: idProd,
        nome: prod.nome_produto,
        quantidade: qtd
    });

    atualizarListaRascunho();
    qtdInput.value = 1;
}

function atualizarListaRascunho() {
    const ul = document.getElementById('lista-rascunho-itens');
    if (itensRascunho.length === 0) {
        ul.innerHTML = '<li style="color: #888;">Nenhum produto adicionado ainda.</li>';
        return;
    }

    ul.innerHTML = itensRascunho.map((it, idx) => `
        <li style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #eee;">
            <span>${it.nome} x <strong>${it.quantidade}</strong></span>
            <button type="button" style="background: none; border: none; color: #be123c; cursor: pointer;" onclick="removerItemRascunho(${idx})">
                <i class="fa-solid fa-trash"></i>
            </button>
        </li>
    `).join('');
}

function removerItemRascunho(idx) {
    itensRascunho.splice(idx, 1);
    atualizarListaRascunho();
}

async function salvarNovoPedido(e) {
    e.preventDefault();
    if (itensRascunho.length === 0) {
        return alert('Adicione pelo menos um produto ao pedido.');
    }

    const tipo = document.getElementById('novo-tipo').value;
    const clienteVal = document.getElementById('novo-cliente').value;
    const idCliente = clienteVal ? Number(clienteVal) : null;
    const observacao = document.getElementById('novo-observacao').value;
    const idUser = Number(localStorage.getItem('beeflux_usuario_id')) || 1;

    let agendamento = null;
    let taxaEntrega = 0;

    if (tipo === 'AGENDADO') {
        if (!idCliente) {
            return alert('Pedidos do tipo AGENDADO exigem um cliente selecionado.');
        }

        const dataHora = document.getElementById('novo-datahora').value;
        if (!dataHora) {
            return alert('Informe a data e horário do agendamento.');
        }

        const atend = document.getElementById('novo-atendimento').value;
        const endereco = document.getElementById('novo-endereco').value;

        if (atend === 'ENTREGA' && (!endereco || endereco.trim() === '')) {
            return alert('Informe o endereço de entrega.');
        }

        taxaEntrega = atend === 'ENTREGA' ? Number(document.getElementById('novo-taxa').value) || 0 : 0;

        agendamento = {
            tipo_atendimento: atend,
            data_hora_agendada: dataHora.replace('T', ' ') + ':00',
            endereco_entrega: atend === 'ENTREGA' ? endereco : null
        };
    }

    const payload = {
        id_cliente: idCliente,
        tipo_pedido: tipo,
        observacao: observacao || null,
        taxa_entrega: taxaEntrega,
        itens: itensRascunho.map(it => ({ id_produto: it.id_produto, quantidade: it.quantidade })),
        agendamento: agendamento,
        id_user: idUser
    };

    try {
        const res = await fetch(API_PEDIDOS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const dados = await res.json();
        if (!res.ok) throw new Error(dados.mensagem || 'Erro ao criar pedido.');

        alert(`Pedido #${dados.id_pedido} criado com sucesso!`);
        fecharModalNovoPedido();
        carregarPedidos();
    } catch (err) {
        alert(err.message);
    }
}
