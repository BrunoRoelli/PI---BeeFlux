
document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("inventory-table-body");
    const totalItemsCount = document.getElementById("total-items-count");
    const lowStockCount = document.getElementById("low-stock-count");
    const searchItemInput = document.getElementById("search-item");
    const filterTags = document.querySelectorAll(".filter-tags #tag");

    // Modal
    const itemModal = document.getElementById("item-modal");
    const openNewItemModalBtn = document.getElementById("open-new-item-modal");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const cancelModalBtn = document.getElementById("cancel-modal-btn");
    const itemForm = document.getElementById("item-form");

    let currentFilter = "all";

    function renderInventory(filter = "all", search = "") {
        tableBody.innerHTML = "";

        const filtered = estoqueData.filter(item => {
            const matchesFilter = filter === "all" || item.categoria === filter;
            const matchesSearch = item.nome.toLowerCase().includes(search.toLowerCase());
            return matchesFilter && matchesSearch;
        });

        // Atualizar métricas
        totalItemsCount.textContent = estoqueData.length;
        const countLow = estoqueData.filter(i => i.quantidade <= i.minimo).length;
        lowStockCount.textContent = countLow;

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 25px;">Nenhum item encontrado.</td></tr>`;
            return;
        }

        filtered.forEach(item => {
            const isLow = item.quantidade <= item.minimo;
            const badgeClass = isLow ? "danger" : "success";
            const badgeText = isLow ? "Estoque Baixo" : "Normal";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span class="item-name">${item.nome}</span></td>
                <td style="text-transform: capitalize;">${item.categoria}</td>
                <td><strong>${item.quantidade}</strong> ${item.unidade}</td>
                <td>${item.minimo} ${item.unidade}</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                <td>
                    <button class="action-icon-btn add-qty-btn" title="Adicionar quantidade" data-id="${item.id}">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button class="action-icon-btn remove-qty-btn" title="Dar baixa (remover)" data-id="${item.id}">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Eventos dos botões rápidos da tabela
        document.querySelectorAll(".add-qty-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                alterarQuantidade(id, 1);
            });
        });

        document.querySelectorAll(".remove-qty-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                alterarQuantidade(id, -1);
            });
        });
    }

    // Alterar quantidade rapidamente
    function alterarQuantidade(id, delta) {
        const item = estoqueData.find(i => i.id === id);
        if (item) {
            item.quantidade = Math.max(0, parseFloat((item.quantidade + delta).toFixed(1)));
            renderInventory(currentFilter, searchItemInput.value);
        }
    }

    // Controlar Modal
    openNewItemModalBtn.addEventListener("click", () => itemModal.classList.add("active"));
    closeModalBtn.addEventListener("click", () => itemModal.classList.remove("active"));
    cancelModalBtn.addEventListener("click", () => itemModal.classList.remove("active"));
    window.addEventListener("click", (e) => {
        if (e.target === itemModal) itemModal.classList.remove("active");
    });

    // Salvar novo item
    itemForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const newItem = {
            id: estoqueData.length + 1,
            nome: document.getElementById("item-name").value,
            categoria: document.getElementById("item-category").value,
            quantidade: parseFloat(document.getElementById("item-qty").value),
            minimo: parseFloat(document.getElementById("item-min").value),
            unidade: document.getElementById("item-unit").value
        };

        estoqueData.push(newItem);
        renderInventory(currentFilter, searchItemInput.value);

        itemForm.reset();
        itemModal.classList.remove("active");
        alert("Insumo cadastrado com sucesso!");
    });

    // Filtros por tags
    filterTags.forEach(tag => {
        tag.addEventListener("click", () => {
            filterTags.forEach(t => t.classList.remove("active"));
            tag.classList.add("active");
            currentFilter = tag.getAttribute("data-filter");
            renderInventory(currentFilter, searchItemInput.value);
        });
    });

    // Pesquisa
    searchItemInput.addEventListener("input", (e) => {
        renderInventory(currentFilter, e.target.value);
    });

    // Inicialização
    renderInventory();
});

document.addEventListener("DOMContentLoaded", () => {
    // 1. Recuperação ou inicialização com dados fictícios caso o banco/localStorage esteja vazio
    let estoqueData = JSON.parse(localStorage.getItem("beeflux_estoque")) || [
        { id: 1, nome: "Leite Condensado", categoria: "ingrediente", quantidade: 6, minimo: 10, unidade: "latas" },
        { id: 2, nome: "Cacau em Pó 50%", categoria: "ingrediente", quantidade: 2.5, minimo: 1.0, unidade: "kg" },
        { id: 3, nome: "Caixas para Bolo Redondo", categoria: "embalagem", quantidade: 4, minimo: 15, unidade: "un" },
        { id: 4, nome: "Manteiga Extra", categoria: "ingrediente", quantidade: 3, minimo: 2, unidade: "kg" },
        { id: 5, nome: "Fita de Cetim Rosa", categoria: "embalagem", quantidade: 2, minimo: 1, unidade: "rolos" }
    ];

    const tableBody = document.getElementById("inventory-table-body");
    const totalItemsCount = document.getElementById("total-items-count");
    const lowStockCount = document.getElementById("low-stock-count");
    const searchItemInput = document.getElementById("search-item");
    const filterTags = document.querySelectorAll(".filter-tags #tag");

    // Modal de Cadastro
    const itemModal = document.getElementById("item-modal");
    const openNewItemModalBtn = document.getElementById("open-new-item-modal");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const itemForm = document.getElementById("item-form");

    // Modal de Edição Rápida de Quantidade
    const editQtyModal = document.getElementById("edit-qty-modal");
    const closeEditModalBtn = document.getElementById("close-edit-modal-btn");
    const editQtyForm = document.getElementById("edit-qty-form");
    const editModalItemName = document.getElementById("edit-modal-item-name");
    const editItemUnitLabel = document.getElementById("edit-item-unit-label");
    const editItemIdInput = document.getElementById("edit-item-id");
    const editItemQtyInput = document.getElementById("edit-item-qty");

    // Controle de unidade personalizada ("Outro")
    const unitSelect = document.getElementById("item-unit-select");
    const customUnitGroup = document.getElementById("custom-unit-group");
    const customUnitInput = document.getElementById("item-custom-unit");

    if (unitSelect) {
        unitSelect.addEventListener("change", (e) => {
            if (e.target.value === "outro") {
                customUnitGroup.style.display = "flex";
                customUnitInput.required = true;
                customUnitInput.focus();
            } else {
                customUnitGroup.style.display = "none";
                customUnitInput.required = false;
                customUnitInput.value = "";
            }
        });
    }

    let currentFilter = "all";

    function salvarEstoque() {
        localStorage.setItem("beeflux_estoque", JSON.stringify(estoqueData));
    }

    function obterPasso(unidade) {
        if (!unidade) return 1;
        const u = unidade.toLowerCase().trim();
        if (u === "kg" || u === "litros" || u === "l") return 0.5;
        if (u === "g" || u === "ml") return 50;
        return 1;
    }

    function renderInventory(filter = "all", search = "") {
        tableBody.innerHTML = "";

        const filtered = estoqueData.filter(item => {
            const matchesFilter = filter === "all" || item.categoria === filter;
            const matchesSearch = item.nome.toLowerCase().includes(search.toLowerCase());
            return matchesFilter && matchesSearch;
        });

        totalItemsCount.textContent = estoqueData.length;
        const countLow = estoqueData.filter(i => i.quantidade < i.minimo).length;
        lowStockCount.textContent = countLow;

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 25px;">Nenhum item encontrado.</td></tr>`;
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
                    
                    <!-- Clicar neste texto abre o modal elegante para alterar ex: 100 unidades de uma vez -->
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
                    <button class="action-icon-btn delete-item-btn" title="Excluir Item" data-id="${item.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Eventos dos botões de ajuste rápido [-] e [+]
        document.querySelectorAll(".add-qty-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                const item = estoqueData.find(i => i.id === id);
                if (item) {
                    const passo = obterPasso(item.unidade);
                    item.quantidade = parseFloat((item.quantidade + passo).toFixed(2));
                    salvarEstoque();
                    renderInventory(currentFilter, searchItemInput.value);
                }
            });
        });

        document.querySelectorAll(".remove-qty-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                const item = estoqueData.find(i => i.id === id);
                if (item) {
                    const passo = obterPasso(item.unidade);
                    item.quantidade = Math.max(0, parseFloat((item.quantidade - passo).toFixed(2)));
                    salvarEstoque();
                    renderInventory(currentFilter, searchItemInput.value);
                }
            });
        });

        // Evento para abrir o Modal de Edição Direta ao clicar no número da quantidade
        document.querySelectorAll(".edit-qty-direct").forEach(span => {
            span.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                const item = estoqueData.find(i => i.id === id);
                if (!item) return;

                // Preenche o modal com os dados do item selecionado
                editItemIdInput.value = item.id;
                editModalItemName.textContent = item.nome;
                editItemUnitLabel.textContent = item.unidade;
                editItemQtyInput.value = item.quantidade;

                // Abre o modal de edição
                editQtyModal.classList.add("active");
                editItemQtyInput.focus();
            });
        });

        // Evento de exclusão de item
        document.querySelectorAll(".delete-item-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                if (confirm("Deseja realmente excluir este item do estoque?")) {
                    estoqueData = estoqueData.filter(i => i.id !== id);
                    salvarEstoque();
                    renderInventory(currentFilter, searchItemInput.value);
                }
            });
        });
    }

    // Submissão do Modal de Edição Rápida de Quantidade
    if (editQtyForm) {
        editQtyForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const id = parseInt(editItemIdInput.value);
            const novaQuantidade = parseFloat(editItemQtyInput.value);

            const item = estoqueData.find(i => i.id === id);
            if (item && !isNaN(novaQuantidade) && novaQuantidade >= 0) {
                item.quantidade = novaQuantidade;
                salvarEstoque();
                renderInventory(currentFilter, searchItemInput.value);
                editQtyModal.classList.remove("active");
            }
        });
    }

    // Controle de Fechamento do Modal de Edição
    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener("click", () => editQtyModal.classList.remove("active"));
    }

    // Controle de Abertura/Fechamento do Modal de Cadastro de Novo Item
    if (openNewItemModalBtn) {
        openNewItemModalBtn.addEventListener("click", () => itemModal.classList.add("active"));
    }
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", () => itemModal.classList.remove("active"));
    }

    // Fechar modais ao clicar fora do card
    window.addEventListener("click", (e) => {
        if (e.target === itemModal) itemModal.classList.remove("active");
        if (e.target === editQtyModal) editQtyModal.classList.remove("active");
    });

    // Salvar Novo Item via Formulário
    if (itemForm) {
        itemForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const unidadeMedida = unitSelect.value === "outro" 
                ? customUnitInput.value 
                : unitSelect.value;

            const newItem = {
                id: estoqueData.length > 0 ? Math.max(...estoqueData.map(i => i.id)) + 1 : 1,
                nome: document.getElementById("item-name").value,
                categoria: document.getElementById("item-category").value,
                quantidade: parseFloat(document.getElementById("item-qty").value),
                minimo: parseFloat(document.getElementById("item-min").value),
                unidade: unidadeMedida
            };

            estoqueData.push(newItem);
            salvarEstoque();
            renderInventory(currentFilter, searchItemInput.value);

            itemForm.reset();
            customUnitGroup.style.display = "none";
            itemModal.classList.remove("active");
            alert("Insumo cadastrado com sucesso!");
        });
    }

    // Filtros por tags
    filterTags.forEach(tag => {
        tag.addEventListener("click", () => {
            filterTags.forEach(t => {
                t.classList.remove("active", "botao-primario");
                t.classList.add("btn-secondary");
            });
            tag.classList.add("active", "botao-primario");
            tag.classList.remove("btn-secondary");

            currentFilter = tag.getAttribute("data-filter");
            renderInventory(currentFilter, searchItemInput.value);
        });
    });

    // Pesquisa em tempo real
    if (searchItemInput) {
        searchItemInput.addEventListener("input", (e) => {
            renderInventory(currentFilter, e.target.value);
        });
    }

    // Inicialização da página
    renderInventory();
});