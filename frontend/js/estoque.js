document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "http://localhost:3000/api";

    let estoqueData = [];
    let lotesData = [];
    let fornecedoresData = [];

    // Elementos do DOM
    const tableBody = document.getElementById("inventory-table-body");
    const expiringLotsBody = document.getElementById("expiring-lots-body");
    const totalItemsCount = document.getElementById("total-items-count");
    const lowStockCount = document.getElementById("low-stock-count");
    const searchItemInput = document.getElementById("search-item");
    const categoryFilterSelect = document.getElementById("category-filter");
    const productsDatalist = document.getElementById("products-datalist");

    // Modal Cadastrar Lote
    const batchModal = document.getElementById("batch-modal");
    const openBatchModalBtn = document.getElementById("open-new-batch-modal");
    const closeBatchModalBtn = document.getElementById("close-batch-modal-btn");
    const batchForm = document.getElementById("batch-form");
    const batchProductInput = document.getElementById("batch-product-input");
    const batchProductError = document.getElementById("batch-product-error");

    // Modal Informações do Insumo
    const infoModal = document.getElementById("info-modal");
    const closeInfoModalBtn = document.getElementById("close-info-modal-btn");
    const infoItemName = document.getElementById("info-item-name");
    const infoItemQty = document.getElementById("info-item-qty");
    const infoItemMin = document.getElementById("info-item-min");
    const infoItemSupplier = document.getElementById("info-item-supplier");
    const infoItemLotsBody = document.getElementById("info-item-lots-body");
    const infoAddBatchBtn = document.getElementById("info-add-batch-btn");
    const infoContactSupplierBtn = document.getElementById("info-contact-supplier-btn");

    // Modal Novo / Editar Insumo
    const itemModal = document.getElementById("item-modal");
    const openNewItemModalBtn = document.getElementById("open-new-item-modal");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const itemForm = document.getElementById("item-form");
    const itemSupplierSelect = document.getElementById("item-supplier-select");
    const unitSelect = document.getElementById("item-unit-select");
    const customUnitGroup = document.getElementById("custom-unit-group");
    const customUnitInput = document.getElementById("item-custom-unit");
    const editItemDbIdInput = document.getElementById("edit-item-db-id");
    const modalTitleElem = itemModal.querySelector(".modal-header h2");
    const modalDescElem = itemModal.querySelector(".modal-header p");

    // Modal de Edição Rápida de Quantidade Direta
    const editQtyModal = document.getElementById("edit-qty-modal");
    const closeEditModalBtn = document.getElementById("close-edit-modal-btn");
    const editQtyForm = document.getElementById("edit-qty-form");
    const editModalItemName = document.getElementById("edit-modal-item-name");
    const editItemUnitLabel = document.getElementById("edit-item-unit-label");
    const editItemIdInput = document.getElementById("edit-item-id");
    const editItemQtyInput = document.getElementById("edit-item-qty");

    // MODAL DINÂMICO: Baixa por Lote
    let baixaLoteModal = document.getElementById("baixa-lote-modal");
    if (!baixaLoteModal) {
        baixaLoteModal = document.createElement("div");
        baixaLoteModal.className = "modal-overlay";
        baixaLoteModal.id = "baixa-lote-modal";
        baixaLoteModal.innerHTML = `
            <div class="modal-card">
                <button class="close-modal" id="close-baixa-lote-btn"><i class="fa-solid fa-xmark"></i></button>
                <div class="modal-header">
                    <h2>Retirar Insumo por Lote</h2>
                    <p id="baixa-lote-item-name">Selecione o lote do qual deseja dar baixa.</p>
                </div>
                <form id="baixa-lote-form">
                    <input type="hidden" id="baixa-insumo-id">
                    <div class="input-group">
                        <label for="baixa-lote-select">Escolha o Lote (Validade)</label>
                        <select id="baixa-lote-select" required></select>
                    </div>
                    <div class="input-group">
                        <label for="baixa-qtd">Quantidade a Retirar</label>
                        <input type="number" id="baixa-qtd" step="any" min="0.1" required placeholder="Ex: 2">
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="botao-primario">Confirmar Retirada</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(baixaLoteModal);
    }

    const closeBaixaLoteBtn = document.getElementById("close-baixa-lote-btn");
    const baixaLoteForm = document.getElementById("baixa-lote-form");
    const baixaInsumoIdInput = document.getElementById("baixa-insumo-id");
    const baixaLoteSelect = document.getElementById("baixa-lote-select");
    const baixaQtdInput = document.getElementById("baixa-qtd");
    const baixaLoteItemName = document.getElementById("baixa-lote-item-name");

    let currentSelectedItemForModal = null;

    // --- FUNÇÕES DE COMUNICAÇÃO COM A API ---
    async function apiRequest(endpoint, options = {}) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            },
            ...options
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(data?.mensagem || `Erro HTTP ${response.status}`);
        }
        return data;
    }

    function mapearTipoParaApi(categoriaFront) {
        const c = (categoriaFront || "").toLowerCase().trim();
        if (c === "feito" || c === "produzido") return "FEITO";
        if (c === "revenda" || c === "embalagem") return "REVENDA";
        return "INGREDIENTE";
    }

    function mapearTipoParaFront(tipoApi) {
        const t = (tipoApi || "").toUpperCase();
        if (t === "FEITO") return "feito";
        if (t === "REVENDA") return "revenda";
        return "ingrediente";
    }

    async function carregarDadosDoBanco() {
        try {
            // 1. Busca todos os produtos do estoque no MySQL
            const produtosApi = await apiRequest("/estoque");

            estoqueData = produtosApi.map(p => ({
                id: p.id_produto,
                nome: p.nome_produto,
                categoria: mapearTipoParaFront(p.tipo_produto),
                tipoOriginal: p.tipo_produto,
                quantidade: Number(p.saldo_atual ?? 0),
                minimo: Number(p.estoque_minimo ?? 0),
                unidade: p.unidade_medida,
                fornecedorId: p.id_fornecedor || null
            }));

            // 2. Busca os lotes de cada produto
            const promessasLotes = estoqueData.map(item =>
                apiRequest(`/estoque/lotes/${item.id}`).catch(() => [])
            );
            const resultadosLotes = await Promise.all(promessasLotes);

            lotesData = resultadosLotes.flat().map(l => ({
                id: l.id_lote,
                insumoId: l.id_produto,
                codigoLote: l.codigo_lote || `Lote #${l.id_lote}`,
                dataAquisicao: l.data_entrada ? String(l.data_entrada).split("T")[0] : "",
                dataValidade: l.data_validade ? String(l.data_validade).split("T")[0] : null,
                quantidade: Number(l.quantidade_atual ?? l.quantidade ?? 0)
            }));

            // 3. Busca fornecedores (caso a rota exista)
            try {
                const fornecedoresApi = await apiRequest("/fornecedores");
                fornecedoresData = fornecedoresApi.map(f => ({
                    id: f.id_fornecedor || f.id,
                    nome: f.nome || f.nome_fornecedor,
                    telefone: f.telefone || ""
                }));
            } catch {
                fornecedoresData = [];
            }

            carregarDatalistProdutos();
            carregarSelectFornecedores();
            renderInventory();
            renderExpiringLots();
        } catch (err) {
            console.error("Erro ao carregar estoque da API:", err);
            alert(`Não foi possível carregar o estoque do banco de dados: ${err.message}`);
        }
    }

    function obterPasso(unidade) {
        if (!unidade) return 1;
        const u = unidade.toLowerCase().trim();
        if (u === "kg" || u === "litros" || u === "l") return 0.5;
        if (u === "g" || u === "ml") return 50;
        return 1;
    }

    function carregarDatalistProdutos() {
        productsDatalist.innerHTML = "";
        estoqueData.forEach(item => {
            const option = document.createElement("option");
            option.value = item.nome;
            productsDatalist.appendChild(option);
        });
    }

    function carregarSelectFornecedores() {
        if (!itemSupplierSelect) return;
        itemSupplierSelect.innerHTML = `<option value="">Não há fornecedor</option>`;
        fornecedoresData.forEach(f => {
            const opt = document.createElement("option");
            opt.value = f.id;
            opt.textContent = f.nome;
            itemSupplierSelect.appendChild(opt);
        });
    }

    function formatarData(dataISO) {
        if (!dataISO) return "-";
        const partes = dataISO.split("-");
        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        return dataISO;
    }

    // Renderizar Lotes Próximos ao Vencimento (Regra dos 5 Dias)
    function renderExpiringLots() {
        expiringLotsBody.innerHTML = "";
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let countExpiring = 0;

        lotesData.forEach(lote => {
            const insumo = estoqueData.find(i => i.id === lote.insumoId);
            if (!insumo || lote.quantidade <= 0 || !lote.dataValidade) return;

            const dataVal = new Date(lote.dataValidade + "T00:00:00");
            const diffTempo = dataVal.getTime() - hoje.getTime();
            const diffDias = Math.ceil(diffTempo / (1000 * 3600 * 24));

            if (diffDias <= 5) {
                countExpiring++;
                const tr = document.createElement("tr");

                let badgeHtml = "";
                if (diffDias < 0) {
                    badgeHtml = `<span class="badge danger">Vencido há ${Math.abs(diffDias)} dia(s)</span>`;
                } else if (diffDias === 0) {
                    badgeHtml = `<span class="badge danger">Vence Hoje!</span>`;
                } else {
                    badgeHtml = `<span class="badge warning" style="background:#fef3c7; color: var(--mediano);">Vence em ${diffDias} dia(s)</span>`;
                }

                tr.innerHTML = `
                    <td><strong class="item-name">${insumo.nome}</strong></td>
                    <td>${lote.codigoLote}</td>
                    <td>${formatarData(lote.dataValidade)}</td>
                    <td>${badgeHtml}</td>
                `;
                expiringLotsBody.appendChild(tr);
            }
        });

        if (countExpiring === 0) {
            expiringLotsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--cor-corpo-texto); padding: 15px;">Nenhum lote próximo ao vencimento (próximos 5 dias).</td></tr>`;
        }
    }

    // Renderizar Tabela Principal de Estoque
    function renderInventory() {
        tableBody.innerHTML = "";
        const search = searchItemInput.value.toLowerCase();
        const selectedCategory = categoryFilterSelect.value;

        const filtered = estoqueData.filter(item => {
            const matchesSearch = item.nome.toLowerCase().includes(search);
            const matchesCategory = (selectedCategory === "todos") || (item.categoria === selectedCategory);
            return matchesSearch && matchesCategory;
        });

        totalItemsCount.textContent = estoqueData.length;
        const countLow = estoqueData.filter(i => i.quantidade < i.minimo).length;
        lowStockCount.textContent = countLow;

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--cor-corpo-texto); padding: 25px;">Nenhum insumo encontrado.</td></tr>`;
            return;
        }

        filtered.forEach(item => {
            const isLow = item.quantidade < item.minimo;
            const badgeClass = isLow ? "danger" : "success";
            const badgeText = isLow ? "Estoque Baixo" : "Normal";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span class="item-name">${item.nome}</span></td>
                <td style="text-transform: capitalize;">${item.categoria}</td>
                <td style="white-space: nowrap;">
                    <button class="action-icon-btn remove-qty-btn" title="Diminuir quantidade" data-id="${item.id}">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                    
                    <strong class="edit-qty-direct" title="Clique para alterar a quantidade exata" data-id="${item.id}" style="margin: 0 8px; font-size: 0.95rem; cursor: pointer; text-decoration: underline dotted; color: var(--pink-escuro);">
                        ${item.quantidade} ${item.unidade}
                    </strong>
                    
                    <button class="action-icon-btn add-qty-btn" title="Aumentar quantidade" data-id="${item.id}">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </td>
                <td>${item.minimo} ${item.unidade}</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                <td>
                    <button class="action-icon-btn edit-item-btn" title="Editar Informações do Insumo" data-id="${item.id}">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="action-icon-btn info-item-btn" title="Ver Informações e Lotes" data-id="${item.id}">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="action-icon-btn delete-item-btn" title="Excluir Item" data-id="${item.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Evento: Botão Aumentar Quantidade [+] -> Cria entrada no primeiro lote ou abre modal de lote
        document.querySelectorAll(".add-qty-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                const item = estoqueData.find(i => i.id === id);
                if (!item) return;

                const lotesDoItem = lotesData.filter(l => l.insumoId === item.id);
                if (lotesDoItem.length === 0) {
                    batchProductInput.value = item.nome;
                    batchModal.classList.add("active");
                    return;
                }

                try {
                    const passo = obterPasso(item.unidade);
                    await apiRequest("/estoque/movimentacoes", {
                        method: "POST",
                        body: JSON.stringify({
                            id_lote: lotesDoItem[0].id,
                            tipo_movimentacao: "ENTRADA",
                            quantidade: passo,
                            motivo: "Ajuste rápido (+)"
                        })
                    });
                    await carregarDadosDoBanco();
                } catch (err) {
                    alert(err.message);
                }
            });
        });

        // Evento: Botão Diminuir Quantidade [-]
        document.querySelectorAll(".remove-qty-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                const item = estoqueData.find(i => i.id === id);
                if (!item) return;

                const lotesDisponiveis = lotesData.filter(l => l.insumoId === item.id && l.quantidade > 0);
                if (lotesDisponiveis.length === 0) {
                    alert("Não há lotes com saldo positivo cadastrados para este insumo. Cadastre um lote primeiro.");
                    return;
                }

                baixaInsumoIdInput.value = item.id;
                baixaLoteItemName.textContent = `Insumo: ${item.nome} (${item.unidade})`;
                baixaLoteSelect.innerHTML = "";

                lotesDisponiveis.forEach(lote => {
                    const opt = document.createElement("option");
                    opt.value = lote.id;
                    opt.textContent = `${lote.codigoLote} | Validade: ${formatarData(lote.dataValidade)} (Disponível: ${lote.quantidade})`;
                    baixaLoteSelect.appendChild(opt);
                });

                baixaQtdInput.value = obterPasso(item.unidade);
                baixaLoteModal.classList.add("active");
            });
        });

        // Evento: Abrir Modal de Edição de Insumo
        document.querySelectorAll(".edit-item-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                const item = estoqueData.find(i => i.id === id);
                if (!item) return;

                editItemDbIdInput.value = item.id;
                document.getElementById("item-name").value = item.nome;
                document.getElementById("item-category").value = item.categoria;
                document.getElementById("item-qty").value = item.quantidade;
                document.getElementById("item-min").value = item.minimo;

                if (item.fornecedorId) {
                    document.getElementById("item-supplier-select").value = item.fornecedorId;
                } else {
                    document.getElementById("item-supplier-select").value = "";
                }

                if (["un", "kg", "g", "litros", "ml", "cx", "pct"].includes(item.unidade)) {
                    unitSelect.value = item.unidade;
                    customUnitGroup.style.display = "none";
                    customUnitInput.required = false;
                } else {
                    unitSelect.value = "outro";
                    customUnitGroup.style.display = "flex";
                    customUnitInput.value = item.unidade;
                    customUnitInput.required = true;
                }

                modalTitleElem.textContent = "Editar Insumo";
                modalDescElem.textContent = "Modifique as informações do insumo selecionado.";
                itemModal.classList.add("active");
            });
        });

        // Evento: Abrir Modal de Edição de Quantidade Direta
        document.querySelectorAll(".edit-qty-direct").forEach(span => {
            span.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                const item = estoqueData.find(i => i.id === id);
                if (!item) return;

                editItemIdInput.value = item.id;
                editModalItemName.textContent = item.nome;
                editItemUnitLabel.textContent = item.unidade;
                editItemQtyInput.value = item.quantidade;

                editQtyModal.classList.add("active");
                editItemQtyInput.focus();
            });
        });

        // Evento: Mais Informações
        document.querySelectorAll(".info-item-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                openInfoModal(id);
            });
        });

        // Evento: Excluir Item (DELETE /api/estoque/produtos/:id)
        document.querySelectorAll(".delete-item-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                if (!confirm("Deseja realmente desativar/excluir este item do estoque?")) return;

                try {
                    await apiRequest(`/estoque/produtos/${id}`, { method: "DELETE" });
                    await carregarDadosDoBanco();
                } catch (err) {
                    alert(`Erro ao excluir: ${err.message}`);
                }
            });
        });
    }

    // Submissão da Retirada por Lote (POST /api/estoque/movimentacoes)
    if (baixaLoteForm) {
        baixaLoteForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const loteId = parseInt(baixaLoteSelect.value);
            const qtdRetirada = parseFloat(baixaQtdInput.value);
            const lote = lotesData.find(l => l.id === loteId);

            if (!lote) return;
            if (qtdRetirada > lote.quantidade) {
                alert(`A quantidade informada excede o saldo deste lote (${lote.quantidade}).`);
                return;
            }

            try {
                await apiRequest("/estoque/movimentacoes", {
                    method: "POST",
                    body: JSON.stringify({
                        id_lote: loteId,
                        tipo_movimentacao: "SAIDA",
                        quantidade: qtdRetirada,
                        motivo: "Retirada manual no estoque",
                        confirmar_vencido: true
                    })
                });

                baixaLoteModal.classList.remove("active");
                baixaLoteForm.reset();
                alert("Retirada registrada com sucesso no banco de dados!");
                await carregarDadosDoBanco();
            } catch (err) {
                alert(`Erro ao registrar retirada: ${err.message}`);
            }
        });
    }

    // Submissão do Modal de Edição Rápida de Quantidade Direta (AJUSTE)
    if (editQtyForm) {
        editQtyForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = parseInt(editItemIdInput.value);
            const novaQuantidade = parseFloat(editItemQtyInput.value);
            const item = estoqueData.find(i => i.id === id);

            if (!item || isNaN(novaQuantidade) || novaQuantidade < 0) return;

            const lotesDoItem = lotesData.filter(l => l.insumoId === id);
            try {
                if (lotesDoItem.length > 0) {
                    await apiRequest("/estoque/movimentacoes", {
                        method: "POST",
                        body: JSON.stringify({
                            id_lote: lotesDoItem[0].id,
                            tipo_movimentacao: "AJUSTE",
                            quantidade: novaQuantidade,
                            motivo: "Ajuste direto de saldo"
                        })
                    });
                } else if (novaQuantidade > 0) {
                    await apiRequest("/estoque/lotes", {
                        method: "POST",
                        body: JSON.stringify({
                            id_produto: id,
                            quantidade: novaQuantidade,
                            codigo_lote: `Lote Inicial`
                        })
                    });
                }

                editQtyModal.classList.remove("active");
                await carregarDadosDoBanco();
            } catch (err) {
                alert(`Erro ao ajustar quantidade: ${err.message}`);
            }
        });
    }

    // Abrir Modal de Detalhes do Insumo
    function openInfoModal(insumoId) {
        const item = estoqueData.find(i => i.id === insumoId);
        if (!item) return;

        currentSelectedItemForModal = item;

        infoItemName.textContent = item.nome;
        infoItemQty.textContent = `${item.quantidade} ${item.unidade}`;
        infoItemMin.textContent = `${item.minimo} ${item.unidade}`;

        const fornecedor = fornecedoresData.find(f => f.id === item.fornecedorId);
        infoItemSupplier.textContent = fornecedor ? fornecedor.nome : "Não há fornecedor";
        infoContactSupplierBtn.style.display = "flex";

        infoItemLotsBody.innerHTML = "";
        const lotesDoItem = lotesData.filter(l => l.insumoId === item.id);

        if (lotesDoItem.length === 0) {
            infoItemLotsBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Nenhum lote cadastrado para este produto.</td></tr>`;
        } else {
            lotesDoItem.forEach(lote => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${lote.codigoLote}</td>
                    <td>${formatarData(lote.dataValidade)}</td>
                    <td><strong>${lote.quantidade}</strong></td>
                `;
                infoItemLotsBody.appendChild(tr);
            });
        }

        infoModal.classList.add("active");
    }

    infoAddBatchBtn.addEventListener("click", () => {
        if (!currentSelectedItemForModal) return;
        infoModal.classList.remove("active");
        batchProductInput.value = currentSelectedItemForModal.nome;
        batchModal.classList.add("active");
    });

    infoContactSupplierBtn.addEventListener("click", () => {
        if (!currentSelectedItemForModal) return;
        const fornecedor = fornecedoresData.find(f => f.id === currentSelectedItemForModal.fornecedorId);

        if (fornecedor) {
            alert(`Abrindo contato do fornecedor: ${fornecedor.nome}\nTelefone: ${fornecedor.telefone}`);
        } else {
            alert("Aviso do Sistema: Este produto não possui um fornecedor vinculado cadastrado.");
        }
    });

    // Submissão do Modal de Cadastro de Lotes (POST /api/estoque/lotes)
    batchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nomeProduto = batchProductInput.value.trim();
        const insumoExistente = estoqueData.find(i => i.nome.toLowerCase() === nomeProduto.toLowerCase());

        if (!insumoExistente) {
            batchProductError.style.display = "block";
            return;
        }

        batchProductError.style.display = "none";

        const payloadLote = {
            id_produto: insumoExistente.id,
            quantidade: parseFloat(document.getElementById("batch-qty").value),
            codigo_lote: document.getElementById("batch-code").value || null,
            data_validade: document.getElementById("batch-expiration-date").value || null
        };

        try {
            await apiRequest("/estoque/lotes", {
                method: "POST",
                body: JSON.stringify(payloadLote)
            });

            batchForm.reset();
            batchModal.classList.remove("active");
            alert("Lote cadastrado no banco de dados com sucesso!");
            await carregarDadosDoBanco();
        } catch (err) {
            alert(`Erro ao cadastrar lote: ${err.message}`);
        }
    });

    // Submissão do Formulário de Insumo (POST /api/estoque/produtos ou PUT /api/estoque/produtos/:id)
    itemForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const unidadeMedida = unitSelect.value === "outro" ? customUnitInput.value : unitSelect.value;
        const editId = editItemDbIdInput.value;
        const nomeProduto = document.getElementById("item-name").value.trim();
        const categoriaFront = document.getElementById("item-category").value;
        const qtdInicial = parseFloat(document.getElementById("item-qty").value) || 0;
        const estoqueMinimo = parseFloat(document.getElementById("item-min").value) || 0;

        try {
            if (editId) {
                // Atualizar item existente (PUT /api/estoque/produtos/:id)
                await apiRequest(`/estoque/produtos/${editId}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        nome_produto: nomeProduto,
                        unidade_medida: unidadeMedida,
                        estoque_minimo: estoqueMinimo
                    })
                });
                alert("Insumo atualizado no banco de dados com sucesso!");
            } else {
                // Cadastrar novo item (POST /api/estoque/produtos)
                const criado = await apiRequest("/estoque/produtos", {
                    method: "POST",
                    body: JSON.stringify({
                        nome_produto: nomeProduto,
                        tipo_produto: mapearTipoParaApi(categoriaFront),
                        unidade_medida: unidadeMedida,
                        estoque_minimo: estoqueMinimo
                    })
                });

                // Se informou quantidade inicial > 0, cria um lote inicial para gerar saldo
                const novoId = criado?.id_produto || criado?.id;
                if (novoId && qtdInicial > 0) {
                    await apiRequest("/estoque/lotes", {
                        method: "POST",
                        body: JSON.stringify({
                            id_produto: novoId,
                            quantidade: qtdInicial,
                            codigo_lote: "Lote Inicial"
                        })
                    });
                }

                alert("Insumo cadastrado no banco de dados com sucesso!");
            }

            itemForm.reset();
            customUnitGroup.style.display = "none";
            itemModal.classList.remove("active");
            await carregarDadosDoBanco();
        } catch (err) {
            alert(`Erro ao salvar insumo: ${err.message}`);
        }
    });

    if (unitSelect) {
        unitSelect.addEventListener("change", (e) => {
            if (e.target.value === "outro") {
                customUnitGroup.style.display = "flex";
                customUnitInput.required = true;
            } else {
                customUnitGroup.style.display = "none";
                customUnitInput.required = false;
            }
        });
    }

    // Controles de Abertura/Fechamento de Modais
    openBatchModalBtn.addEventListener("click", () => {
        batchProductError.style.display = "none";
        batchForm.reset();
        batchModal.classList.add("active");
    });
    closeBatchModalBtn.addEventListener("click", () => batchModal.classList.remove("active"));

    openNewItemModalBtn.addEventListener("click", () => {
        editItemDbIdInput.value = "";
        itemForm.reset();
        customUnitGroup.style.display = "none";
        modalTitleElem.textContent = "Adicionar Novo Insumo";
        modalDescElem.textContent = "Cadastre um novo ingrediente, produto produzido ou embalagem no seu estoque.";
        itemModal.classList.add("active");
    });

    closeModalBtn.addEventListener("click", () => itemModal.classList.remove("active"));
    closeInfoModalBtn.addEventListener("click", () => infoModal.classList.remove("active"));
    closeEditModalBtn.addEventListener("click", () => editQtyModal.classList.remove("active"));
    if (closeBaixaLoteBtn) {
        closeBaixaLoteBtn.addEventListener("click", () => baixaLoteModal.classList.remove("active"));
    }

    window.addEventListener("click", (e) => {
        if (e.target === batchModal) batchModal.classList.remove("active");
        if (e.target === itemModal) itemModal.classList.remove("active");
        if (e.target === infoModal) infoModal.classList.remove("active");
        if (e.target === editQtyModal) editQtyModal.classList.remove("active");
        if (e.target === baixaLoteModal) baixaLoteModal.classList.remove("active");
    });

    searchItemInput.addEventListener("input", renderInventory);
    categoryFilterSelect.addEventListener("change", renderInventory);

    // Inicialização da Página buscando direto do MySQL
    carregarDadosDoBanco();
});