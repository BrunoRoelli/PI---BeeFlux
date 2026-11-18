document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "http://localhost:3000/api";

    const STATUS = {
        ATIVA: { texto: "Ativa", classe: "ativa" },
        EM_DESENVOLVIMENTO: { texto: "Em desenvolvimento", classe: "desenvolvimento" },
        INATIVA: { texto: "Inativa", classe: "inativa" }
    };

    // Dados em memória
    let receitas = [];
    let produtosFeitos = [];
    let ingredientesDisponiveis = [];
    let idEmEdicao = null;

    // Elementos da página
    const tbody = document.getElementById("recipes-table-body");
    const buscaInput = document.getElementById("search-recipe");
    const filtroStatus = document.getElementById("status-filter");
    const msgPagina = document.getElementById("page-msg");
    const btnNova = document.getElementById("btn-nova-receita");

    // Modal de cadastro / edição
    const modalReceita = document.getElementById("modal-receita");
    const form = document.getElementById("recipe-form");
    const tituloModal = document.getElementById("recipe-modal-title");
    const selectProduto = document.getElementById("recipe-product");
    const dicaProduto = document.getElementById("recipe-product-hint");
    const containerIng = document.getElementById("ingredientes-container");
    const btnAddIng = document.getElementById("btn-add-ingrediente");
    const msgForm = document.getElementById("recipe-form-msg");
    const btnSalvar = document.getElementById("btn-salvar-receita");

    // Modal de detalhes
    const modalDetalhes = document.getElementById("modal-detalhes");

    // ---------- Utilitários ----------
    const esc = (v) =>
        String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const num = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    const moeda = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    async function api(endpoint, opcoes = {}) {
        let resposta;
        try {
            resposta = await fetch(`${API_BASE}${endpoint}`, {
                headers: { "Content-Type": "application/json" },
                ...opcoes
            });
        } catch {
            throw new Error("Não foi possível conectar ao servidor. Verifique se a API está rodando.");
        }
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.mensagem || `Erro ${resposta.status} ao falar com a API.`);
        return dados;
    }

    let timerMsg;
    function avisar(texto, erro = false) {
        msgPagina.textContent = texto;
        msgPagina.className = `msg ${erro ? "msg-erro" : "msg-ok"}`;
        msgPagina.hidden = false;
        clearTimeout(timerMsg);
        timerMsg = setTimeout(() => (msgPagina.hidden = true), 5000);
    }

    function mostrarErroForm(texto) {
        msgForm.textContent = texto;
        msgForm.hidden = false;
        msgForm.scrollIntoView({ block: "nearest" });
    }

    const abrir = (modal) => modal.classList.add("active");
    const fechar = (modal) => modal.classList.remove("active");

    // ---------- Carregamento ----------
    async function carregarReceitas() {
        try {
            receitas = await api("/receitas");
            renderizarTabela();
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="linha-vazia">${esc(e.message)}</td></tr>`;
        }
    }

    async function carregarProdutos() {
        try {
            const [feitos, ingredientes] = await Promise.all([
                api("/estoque?tipo=FEITO"),
                api("/estoque?tipo=INGREDIENTE")
            ]);
            produtosFeitos = feitos;
            ingredientesDisponiveis = ingredientes;
        } catch (e) {
            avisar(e.message, true);
        }
    }

    // ---------- Tabela ----------
    function renderizarTabela() {
        const termo = buscaInput.value.trim().toLowerCase();
        const status = filtroStatus.value;

        const lista = receitas.filter(
            (r) =>
                r.nome_produto.toLowerCase().includes(termo) &&
                (status === "todas" || r.status_receita === status)
        );

        if (!lista.length) {
            const vazio = receitas.length
                ? "Nenhuma receita encontrada com esses filtros."
                : 'Nenhuma receita cadastrada ainda. Clique em "Nova Receita" para começar.';
            tbody.innerHTML = `<tr><td colspan="5" class="linha-vazia">${vazio}</td></tr>`;
            return;
        }

        tbody.innerHTML = lista
            .map((r) => {
                const st = STATUS[r.status_receita] || STATUS.INATIVA;
                const inativa = r.status_receita === "INATIVA";
                const nome = esc(r.nome_produto);
                return `
                <tr>
                    <td><strong class="item-name">${nome}</strong></td>
                    <td>${num(r.rendimento_receita)} ${esc(r.unidade_produto || "")}</td>
                    <td>${num(r.tempo_preparo_minutos)} min</td>
                    <td><span class="badge ${st.classe}">${st.texto}</span></td>
                    <td>
                        <button type="button" class="action-icon-btn" data-acao="ver" data-id="${r.id_produto_feito}" title="Ver detalhes" aria-label="Ver detalhes da receita ${nome}"><i class="fa-solid fa-eye"></i></button>
                        <button type="button" class="action-icon-btn" data-acao="editar" data-id="${r.id_produto_feito}" title="Editar" aria-label="Editar receita ${nome}"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="action-icon-btn" data-acao="${inativa ? "ativar" : "inativar"}" data-id="${r.id_produto_feito}" title="${inativa ? "Ativar" : "Inativar"}" aria-label="${inativa ? "Ativar" : "Inativar"} receita ${nome}"><i class="fa-solid ${inativa ? "fa-check" : "fa-ban"}"></i></button>
                    </td>
                </tr>`;
            })
            .join("");
    }

    tbody.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-acao]");
        if (!btn) return;
        const id = Number(btn.dataset.id);
        const acao = btn.dataset.acao;
        if (acao === "ver") abrirDetalhes(id);
        else if (acao === "editar") abrirFormulario(id);
        else mudarStatus(id, acao === "ativar" ? "ATIVA" : "INATIVA");
    });

    buscaInput.addEventListener("input", renderizarTabela);
    filtroStatus.addEventListener("change", renderizarTabela);

    async function mudarStatus(id, novoStatus) {
        const r = receitas.find((x) => x.id_produto_feito === id);
        const verbo = novoStatus === "ATIVA" ? "ativar" : "inativar";
        if (!confirm(`Deseja ${verbo} a receita "${r ? r.nome_produto : id}"?`)) return;
        try {
            await api(`/receitas/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: novoStatus }) });
            avisar(`Receita ${novoStatus === "ATIVA" ? "ativada" : "inativada"} com sucesso.`);
            await carregarReceitas();
        } catch (e) {
            avisar(e.message, true);
        }
    }

    // ---------- Detalhes ----------
    async function abrirDetalhes(id) {
        try {
            const r = await api(`/receitas/${id}`);
            const st = STATUS[r.status_receita] || STATUS.INATIVA;

            const badge = document.getElementById("det-status");
            badge.textContent = st.texto;
            badge.className = `badge ${st.classe}`;
            document.getElementById("detail-modal-title").textContent = r.nome_produto;
            document.getElementById("det-rendimento").textContent = `${num(r.rendimento_receita)} ${r.unidade_produto || ""}`;
            document.getElementById("det-tempo").textContent = `${num(r.tempo_preparo_minutos)} min`;
            document.getElementById("det-margem").textContent = `${num(r.margem_lucro)}%`;
            document.getElementById("det-instrucoes").textContent = r.instrucoes || "—";
            document.getElementById("det-ingredientes").innerHTML = r.ingredientes
                .map((i) => `<tr><td>${esc(i.nome_produto)}</td><td>${num(i.quantidade)} ${esc(i.unidade_medida)}</td></tr>`)
                .join("");

            // Custos (calculados pelo backend a partir das compras registradas)
            const campos = ["det-custo-total", "det-custo-unitario", "det-preco"].map((x) => document.getElementById(x));
            const aviso = document.getElementById("det-aviso-custo");
            campos.forEach((c) => (c.textContent = "—"));
            aviso.hidden = true;
            try {
                const c = await api(`/receitas/${id}/preco-sugerido`, { method: "POST", body: JSON.stringify({}) });
                campos[0].textContent = moeda(c.custo_total);
                campos[1].textContent = moeda(c.custo_unitario);
                campos[2].textContent = moeda(c.preco_sugerido);
                if (c.ingredientes_sem_custo.length) {
                    const nomes = r.ingredientes
                        .filter((i) => c.ingredientes_sem_custo.includes(i.id_ingrediente))
                        .map((i) => i.nome_produto)
                        .join(", ");
                    aviso.textContent = `Sem custo de compra registrado para: ${nomes}. O valor pode estar abaixo do real.`;
                    aviso.hidden = false;
                }
            } catch {
                aviso.textContent = "Não foi possível calcular os custos agora.";
                aviso.hidden = false;
            }

            abrir(modalDetalhes);
        } catch (e) {
            avisar(e.message, true);
        }
    }

    // ---------- Formulário ----------
    const opcoesIngredientes = () =>
        '<option value="" selected disabled>Selecione...</option>' +
        ingredientesDisponiveis
            .map((i) => `<option value="${i.id_produto}">${esc(i.nome_produto)} (${esc(i.unidade_medida)})</option>`)
            .join("");

    function adicionarLinhaIngrediente(valor = {}) {
        const linha = document.createElement("div");
        linha.className = "ingrediente-linha";
        linha.innerHTML = `
            <div class="input-group">
                <label>Ingrediente</label>
                <select class="ing-select" aria-label="Ingrediente" required>${opcoesIngredientes()}</select>
            </div>
            <div class="input-group">
                <label>Quantidade</label>
                <input type="number" class="ing-qtd" aria-label="Quantidade" min="0.001" step="0.001" placeholder="Ex: 2" required>
            </div>
            <button type="button" class="action-icon-btn ing-remover" title="Remover ingrediente" aria-label="Remover ingrediente"><i class="fa-solid fa-trash"></i></button>`;
        if (valor.id_ingrediente) linha.querySelector(".ing-select").value = String(valor.id_ingrediente);
        if (valor.quantidade) linha.querySelector(".ing-qtd").value = valor.quantidade;
        containerIng.appendChild(linha);
    }

    containerIng.addEventListener("click", (e) => {
        const btn = e.target.closest(".ing-remover");
        if (!btn) return;
        const linhas = containerIng.querySelectorAll(".ingrediente-linha");
        if (linhas.length > 1) btn.closest(".ingrediente-linha").remove();
        else {
            // Mantém ao menos uma linha: apenas limpa
            linhas[0].querySelector(".ing-select").value = "";
            linhas[0].querySelector(".ing-qtd").value = "";
        }
    });

    btnAddIng.addEventListener("click", () => adicionarLinhaIngrediente());

    async function abrirFormulario(id = null) {
        idEmEdicao = id;
        form.reset();
        msgForm.hidden = true;
        containerIng.innerHTML = "";

        // Atualiza as listas (podem ter mudado no Estoque)
        await carregarProdutos();

        if (!ingredientesDisponiveis.length) {
            avisar('Cadastre ingredientes na tela de Estoque (tipo "Ingredientes") antes de criar uma receita.', true);
            return;
        }

        if (id === null) {
            tituloModal.textContent = "Cadastrar Receita";
            const comReceita = new Set(receitas.map((r) => r.id_produto_feito));
            const livres = produtosFeitos.filter((p) => !comReceita.has(p.id_produto));
            if (!livres.length) {
                avisar('Não há produtos "Feito" sem receita. Cadastre um produto do tipo "Feito (Produzido)" no Estoque.', true);
                return;
            }
            selectProduto.innerHTML =
                '<option value="" disabled selected>Selecione o produto...</option>' +
                livres.map((p) => `<option value="${p.id_produto}">${esc(p.nome_produto)} (${esc(p.unidade_medida)})</option>`).join("");
            selectProduto.disabled = false;
            dicaProduto.hidden = false;
            adicionarLinhaIngrediente();
        } else {
            try {
                const r = await api(`/receitas/${id}`);
                tituloModal.textContent = "Editar Receita";
                selectProduto.innerHTML = `<option value="${r.id_produto_feito}" selected>${esc(r.nome_produto)} (${esc(r.unidade_produto)})</option>`;
                selectProduto.disabled = true; // o produto não muda numa edição
                dicaProduto.hidden = true;
                form.elements.rendimento_receita.value = r.rendimento_receita;
                form.elements.tempo_preparo_minutos.value = r.tempo_preparo_minutos;
                form.elements.custos_fixos.value = r.custos_fixos;
                form.elements.custo_mao_obra.value = r.custo_mao_obra;
                form.elements.margem_lucro.value = r.margem_lucro;
                form.elements.instrucoes.value = r.instrucoes || "";
                r.ingredientes.forEach((i) => adicionarLinhaIngrediente(i));
            } catch (e) {
                avisar(e.message, true);
                return;
            }
        }
        abrir(modalReceita);
    }

    btnNova.addEventListener("click", () => abrirFormulario(null));

    function montarCorpo() {
        const f = form.elements;
        const ingredientes = [];
        const vistos = new Set();

        for (const linha of containerIng.querySelectorAll(".ingrediente-linha")) {
            const idIng = Number(linha.querySelector(".ing-select").value);
            const qtd = Number(linha.querySelector(".ing-qtd").value);
            if (!idIng || !(qtd > 0)) {
                mostrarErroForm("Preencha o ingrediente e a quantidade (maior que zero) em todas as linhas.");
                return null;
            }
            if (vistos.has(idIng)) {
                mostrarErroForm("Há ingredientes repetidos na receita. Use cada ingrediente uma única vez.");
                return null;
            }
            vistos.add(idIng);
            ingredientes.push({ id_ingrediente: idIng, quantidade: qtd });
        }

        return {
            id_produto_feito: Number(idEmEdicao ?? f.id_produto_feito.value),
            rendimento_receita: Number(f.rendimento_receita.value),
            tempo_preparo_minutos: Number(f.tempo_preparo_minutos.value),
            instrucoes: f.instrucoes.value.trim(),
            custos_fixos: Number(f.custos_fixos.value),
            custo_mao_obra: Number(f.custo_mao_obra.value),
            margem_lucro: Number(f.margem_lucro.value),
            ingredientes
        };
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        msgForm.hidden = true;
        const corpo = montarCorpo();
        if (!corpo) return;

        btnSalvar.disabled = true;
        try {
            const editando = idEmEdicao !== null;
            const resp = await api(editando ? `/receitas/${idEmEdicao}` : "/receitas", {
                method: editando ? "PUT" : "POST",
                body: JSON.stringify(corpo)
            });
            fechar(modalReceita);
            avisar(resp.mensagem || "Receita salva com sucesso.");
            await carregarReceitas();
        } catch (err) {
            mostrarErroForm(err.message);
        } finally {
            btnSalvar.disabled = false;
        }
    });

    // ---------- Fechar modais ----------
    document.querySelectorAll("[data-fechar]").forEach((el) =>
        el.addEventListener("click", (e) => {
            e.preventDefault();
            fechar(el.closest(".modal-overlay"));
        })
    );
    document.querySelectorAll(".modal-overlay").forEach((overlay) =>
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) fechar(overlay);
        })
    );
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") document.querySelectorAll(".modal-overlay.active").forEach(fechar);
    });

    // ---------- Início ----------
    carregarReceitas();
    carregarProdutos();
});
