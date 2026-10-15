let estoqueData = [
    { id: 1, nome: "Leite Condensado", categoria: "ingrediente", quantidade: 6, minimo: 10, unidade: "latas" },
    { id: 2, nome: "Cacau em Pó 50%", categoria: "ingrediente", quantidade: 2.5, minimo: 1.0, unidade: "kg" },
    { id: 3, nome: "Caixas para Bolo Redondo", categoria: "embalagem", quantidade: 4, minimo: 15, unidade: "un" },
    { id: 4, nome: "Manteiga Extra", categoria: "ingrediente", quantidade: 3, minimo: 2, unidade: "kg" },
    { id: 5, nome: "Fita de Cetim Rosa", categoria: "embalagem", quantidade: 2, minimo: 1, unidade: "rolos" }
];

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