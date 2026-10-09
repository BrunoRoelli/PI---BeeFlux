//definindo valores para teste
let clientesData = [
    {
        id: 1,
        nome: "Ana Souza",
        telefone: "(11) 98765-4321",
        aniversario: "1994-05-12",
        observacoes: "Alérgica a lactose, prefere recheios de Ninho.",
        totalGasto: "R\$ 380,00",
        historico: [
            { produto: "Bolo de Chocolate c/ Morango", data: "28/05/2026", valor: "R\$ 95,00" },
            { produto: "Caixa 12 Brigadeiros Gourmet", data: "14/04/2026", valor: "R\$ 45,00" }
        ]
    },
    {
        id: 2,
        nome: "Carlos Lima",
        telefone: "(11) 91234-5678",
        aniversario: "1988-11-20",
        observacoes: "Prefere entrega no período da manhã.",
        totalGasto: "R\$ 150,00",
        historico: [
            { produto: "Caixa 12 Brigadeiros Gourmet", data: "10/05/2026", valor: "R\$ 45,00" }
        ]
    }
];
let fornecedoresData = [
    {
        id: 1,
        nome: "Distribuidora Doces & Cia",
        telefone: "(11) 93333-4444",
        produtoConsumido: "Leite Condensado e Chocolate",
        observacoes: "Entrega toda terça-feira. Pedido mínimo de R\$ 300.",
        totalGasto: "R\$ 1.250,00",
        historico: [
            { produto: "Caixa Leite Condensado (24un)", data: "01/06/2026", valor: "R\$ 180,00" },
            { produto: "Chocolate Nobre 2kg", data: "15/05/2026", valor: "R\$ 110,00" }
        ]
    }
];

document.addEventListener("DOMContentLoaded", () => {
    //tabelas cliente e fornecedor
    const clientsTableBody = document.getElementById("clients-table-body");
    const supplierTableBody = document.getElementById("supplier-table-body");
    //total cliente e fornecedor
    const totalClientsCount = document.getElementById("total-clients-count");
    const totalSuppliersCount = document.getElementById("total-suppliers-count");
    //pesquisa contato e botoes de filtro
    const searchContactInput = document.getElementById("search-contact");
    const sectionClients = document.getElementById("section-clients");
    const sectionSuppliers = document.getElementById("section-suppliers");
    const filterButtons = document.querySelectorAll(".filter-btn");

    // Modais e Formulários
    const clientModal = document.getElementById("contact-modal");
    const openNewClientModalBtn = document.getElementById("open-new-client-modal");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const cancelModalBtn = document.getElementById("cancel-modal-btn");
    const clientForm = document.getElementById("client-form");
    const contactTypeSelect = document.getElementById("contact-type");
    const dynamicFieldContainer = document.getElementById("dynamic-field-container");

    const historyModal = document.getElementById("history-modal");
    const closeHistoryModal = document.getElementById("close-history-modal");
    const closeHistoryBtn = document.getElementById("close-history-btn");
    
    const historyClientName = document.getElementById("history-client-name");
    const historyClientPhone = document.getElementById("history-client-phone");
    const historyClientNotes = document.getElementById("history-client-notes"); // Campo de obs no modal
    const historyOrdersBody = document.getElementById("history-orders-body");
    const historyBadge = document.getElementById("history-badge");
    const historySectionTitle = document.getElementById("history-section-title");
    //variavel filtro de exibição 
    let currentFilter = "todos";

    // Verificar se veio do index.html para abrir o modal automaticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("abrirModal") === "true") {
        clientModal.classList.add("active");
    }

    // Alternar campos do modal conforme seleção (Cliente vs Fornecedor)
    contactTypeSelect.addEventListener("change", (e) => {
        const type = e.target.value;
        //se cliente, aparece data de aniversario
        if (type === "cliente") {
            dynamicFieldContainer.innerHTML = `
                <label for="client-birthday">Data de Aniversário</label>
                <input type="date" id="client-birthday" required>
            `;
            document.getElementById("modal-title").textContent = "Cadastrar Novo Cliente";
            document.getElementById("save-btn-text").textContent = "Salvar Cliente";
        }
        //se fornecedor, aparece produto consumido/ fornecido
        else {
            dynamicFieldContainer.innerHTML = `
                <label for="client-product">Produto Consumido / Fornecido</label>
                <input type="text" id="client-product" required placeholder="Ex: Embalagens, Leite Condensado">
            `;
            document.getElementById("modal-title").textContent = "Cadastrar Novo Fornecedor";
            document.getElementById("save-btn-text").textContent = "Salvar Fornecedor";
        }
    });
    // Função para renderizar as tabelas aplicando busca e o filtro de botões
    function renderContacts(search = "") {
        clientsTableBody.innerHTML = "";
        supplierTableBody.innerHTML = "";

        const searchLower = search.toLowerCase();

        const filteredClients = clientesData.filter(c => 
            c.nome.toLowerCase().includes(searchLower) || c.telefone.includes(search)
        );

        const filteredSuppliers = fornecedoresData.filter(f => 
            f.nome.toLowerCase().includes(searchLower) || f.telefone.includes(search)
        );

        totalClientsCount.textContent = clientesData.length;
        totalSuppliersCount.textContent = fornecedoresData.length;

        // Gerenciar visibilidade das seções com base no botão de filtro ativo
        if (currentFilter === "todos") {
            sectionClients.style.display = "block";
            sectionSuppliers.style.display = "block";
        } else if (currentFilter === "clientes") {
            sectionClients.style.display = "block";
            sectionSuppliers.style.display = "none";
        } else if (currentFilter === "fornecedores") {
            sectionClients.style.display = "none";
            sectionSuppliers.style.display = "block";
        }
        // Renderizar Clientes (se a seção estiver visível)
        if (sectionClients.style.display !== "none") {
            if (filteredClients.length === 0) {
                clientsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum cliente encontrado.</td></tr>`;
            } else {
                filteredClients.forEach(client => {
                    let aniversarioFormatado = "-";
                    if (client.aniversario) {
                        const partes = client.aniversario.split("-");
                        if (partes.length === 3) aniversarioFormatado = `${partes[2]}/${partes[1]}`;
                    }

                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><span class="info-name">${client.nome}</span></td>
                        <td><i class="fa-brands fa-whatsapp text-success"></i> ${client.telefone}</td>
                        <td>${aniversarioFormatado}</td>
                        <td><strong>${client.totalGasto}</strong></td>
                        <td>
                            <button class="action-icon-btn history-btn" title="Ver Histórico e Observações" data-type="cliente" data-id="${client.id}">
                                <i class="fa-solid fa-clock-rotate-left"></i>
                            </button>
                            <button class="action-icon-btn whatsapp-btn" title="WhatsApp" data-phone="${client.telefone}">
                                <i class="fa-brands fa-whatsapp"></i>
                            </button>
                        </td>
                    `;
                    clientsTableBody.appendChild(tr);
                });
            }
        }
        // Renderizar Fornecedores (se a seção estiver visível)
        if (sectionSuppliers.style.display !== "none") {
            if (filteredSuppliers.length === 0) {
                supplierTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum fornecedor encontrado.</td></tr>`;
            } else {
                filteredSuppliers.forEach(supplier => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><span class="info-name">${supplier.nome}</span></td>
                        <td><i class="fa-brands fa-whatsapp text-success"></i> ${supplier.telefone}</td>
                        <td>${supplier.produtoConsumido}</td>
                        <td><strong>${supplier.totalGasto}</strong></td>
                        <td>
                            <button class="action-icon-btn history-btn" title="Ver Histórico e Observações" data-type="fornecedor" data-id="${supplier.id}">
                                <i class="fa-solid fa-clock-rotate-left"></i>
                            </button>
                            <button class="action-icon-btn whatsapp-btn" title="WhatsApp" data-phone="${supplier.telefone}">
                                <i class="fa-brands fa-whatsapp"></i>
                            </button>
                        </td>
                    `;
                    supplierTableBody.appendChild(tr);
                });
            }
        }
        attachEventListeners();
    }
    // Eventos dos botões de filtro (Todos, Só Clientes, Só Fornecedores)
    filterButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            filterButtons.forEach(b => {
                b.classList.remove("active", "botao-primario");
                b.classList.add("btn-secondary");
            });

            e.currentTarget.classList.add("active", "botao-primario");
            e.currentTarget.classList.remove("btn-secondary");

            currentFilter = e.currentTarget.getAttribute("data-filter");
            renderContacts(searchContactInput.value);
        });
    });
    //botoes na tabela
    function attachEventListeners() {
        //botao para saber mais detalhes do contato
        document.querySelectorAll(".history-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                const type = e.currentTarget.getAttribute("data-type");
                openHistoryModal(id, type);
            });
        });
        //botao para entrar em contato
        document.querySelectorAll(".whatsapp-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const phone = e.currentTarget.getAttribute("data-phone").replace(/\D/g, "");
                alert(`Abrindo conversa no WhatsApp para o número: ${phone}`);
            });
        });
    }

    // Abrir Modal de Histórico e exibir Observações
    function openHistoryModal(id, type) {
        let contact = type === "cliente" 
            ? clientesData.find(c => c.id === id) 
            : fornecedoresData.find(f => f.id === id);

        if (!contact) return;

        historyClientName.textContent = contact.nome;
        historyClientPhone.innerHTML = `<i class="fa-brands fa-whatsapp text-success"></i> ${contact.telefone}`;
        
        // Exibe a observação cadastrada ou um traço se estiver vazia
        historyClientNotes.textContent = contact.observacoes && contact.observacoes.trim() !== "" 
            ? contact.observacoes 
            : "Nenhuma observação cadastrada.";

        if (type === "cliente") {
            historyBadge.textContent = "Histórico de Compras";
            historySectionTitle.textContent = "Últimos Pedidos Realizados";
        } else {
            historyBadge.textContent = "Histórico de Fornecimento";
            historySectionTitle.textContent = "Últimas Compras/Insumos Adquiridos";
        }

        historyOrdersBody.innerHTML = "";
        if (contact.historico && contact.historico.length > 0) {
            contact.historico.forEach(order => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${order.produto}</td>
                    <td>${order.data}</td>
                    <td><strong>${order.valor}</strong></td>
                `;
                historyOrdersBody.appendChild(tr);
            });
        } else {
            historyOrdersBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Nenhum registro encontrado.</td></tr>`;
        }

        historyModal.classList.add("active");
    }
    // Controle de Abertura/Fechamento de Modais
    openNewClientModalBtn.addEventListener("click", () => clientModal.classList.add("active"));
    closeModalBtn.addEventListener("click", () => clientModal.classList.remove("active"));
    cancelModalBtn.addEventListener("click", () => clientModal.classList.remove("active"));
    closeHistoryModal.addEventListener("click", () => historyModal.classList.remove("active"));
    closeHistoryBtn.addEventListener("click", () => historyModal.classList.remove("active"));

    window.addEventListener("click", (e) => {
        if (e.target === clientModal) clientModal.classList.remove("active");
        if (e.target === historyModal) historyModal.classList.remove("active");
    });
    // Salvar Novo Contato (Salvando corretamente as observações)
    clientForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const type = contactTypeSelect.value;
        const nome = document.getElementById("client-name").value;
        const telefone = document.getElementById("client-phone").value;
        const observacoes = document.getElementById("client-notes").value;

        if (type === "cliente") {
            const aniversario = document.getElementById("client-birthday").value;
            clientesData.push({
                id: clientesData.length + 1,
                nome,
                telefone,
                aniversario,
                observacoes,
                totalGasto: "R\$ 0,00",
                historico: []
            });
            alert("Cliente cadastrado com sucesso!");
        } else {
            const produtoConsumido = document.getElementById("client-product").value;
            fornecedoresData.push({
                id: fornecedoresData.length + 1,
                nome,
                telefone,
                produtoConsumido,
                observacoes,
                totalGasto: "R\$ 0,00",
                historico: []
            });
            alert("Fornecedor cadastrado com sucesso!");
        }

        renderContacts();
        clientForm.reset();
        contactTypeSelect.value = "cliente";
        contactTypeSelect.dispatchEvent(new Event("change"));
        clientModal.classList.remove("active");
    });
    // Pesquisa em tempo real
    searchContactInput.addEventListener("input", (e) => {
        renderContacts(e.target.value);
    });
    // Inicialização
    renderContacts();
});