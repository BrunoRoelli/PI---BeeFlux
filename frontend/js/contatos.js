//definindo valores para teste
let clientesData = [
    {
        id: 1,
        nome: "Ana Souza",
        telefone: "(11) 98765-4321",
        aniversario: "1994-05-12",
        observacoes: "Alérgica a lactose, prefere recheios de Ninho.",
        totalGasto: "R$ 380,00",
        historico: [
            { produto: "Bolo de Chocolate c/ Morango", data: "28/05/2026", valor: "R$ 95,00" },
            { produto: "Caixa 12 Brigadeiros Gourmet", data: "14/04/2026", valor: "R$ 45,00" }
        ]
    },
    {
        id: 2,
        nome: "Carlos Lima",
        telefone: "(11) 91234-5678",
        aniversario: "1988-11-20",
        observacoes: "Prefere entrega no período da manhã.",
        totalGasto: "R$ 150,00",
        historico: [
            { produto: "Caixa 12 Brigadeiros Gourmet", data: "10/05/2026", valor: "R$ 45,00" }
        ]
    }
];

let fornecedoresData = [
    {
        id: 1,
        nome: "Distribuidora Doces & Cia",
        telefone: "(11) 93333-4444",
        produtoConsumido: "Leite Condensado e Chocolate",
        observacoes: "Entrega toda terça-feira. Pedido mínimo de R$ 300.",
        totalGasto: "R$ 1.250,00",
        historico: [
            { produto: "Caixa Leite Condensado (24un)", data: "01/06/2026", valor: "R$ 180,00" },
            { produto: "Chocolate Nobre 2kg", data: "15/05/2026", valor: "R$ 110,00" }
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
    const clientForm = document.getElementById("client-form");
    const contactTypeSelect = document.getElementById("contact-type");
    const dynamicFieldContainer = document.getElementById("dynamic-field-container");
    const clientNameInput = document.getElementById("client-name");
    const labelClientName = document.getElementById("label-client-name");
    const stockProductsDatalist = document.getElementById("stock-products-datalist");

    const historyModal = document.getElementById("history-modal");
    const closeHistoryModal = document.getElementById("close-history-modal");
    
    const historyClientName = document.getElementById("history-client-name");
    const historyClientPhone = document.getElementById("history-client-phone");
    const historyClientEmail = document.getElementById("history-client-email");
    const historyClientNotes = document.getElementById("history-client-notes");
    const historyOrdersBody = document.getElementById("history-orders-body");
    const historyBadge = document.getElementById("history-badge");
    const historySectionTitle = document.getElementById("history-section-title");

    let currentFilter = "todos";

    // Carregar produtos do estoque para o datalist de autopreenchimento (se houver no localStorage do estoque)
    function carregarProdutosEstoqueParaDatalist() {
        if (!stockProductsDatalist) return;
        stockProductsDatalist.innerHTML = "";
        const estoque = JSON.parse(localStorage.getItem("beeflux_estoque")) || [
            { nome: "Leite Condensado" },
            { nome: "Cacau em Pó 50%" },
            { nome: "Manteiga Extra" }
        ];
        
        estoque.forEach(item => {
            const option = document.createElement("option");
            option.value = item.nome;
            stockProductsDatalist.appendChild(option);
        });
    }

    // Verificar se veio do index.html para abrir o modal automaticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("abrirModal") === "true") {
        clientModal.classList.add("active");
    }

    // Alternar campos do modal conforme seleção (Cliente vs Fornecedor)
    contactTypeSelect.addEventListener("change", (e) => {
        const type = e.target.value;
        if (type === "cliente") {
            if (labelClientName) labelClientName.textContent = "Nome Completo";
            if (clientNameInput) clientNameInput.placeholder = "Ex: Mariana Silva";

            dynamicFieldContainer.innerHTML = `
                <label for="client-birthday">Data de Nascimento</label>
                <input type="date" id="client-birthday" required>
            `;
            document.getElementById("modal-title").textContent = "Cadastrar Novo Cliente";
            document.getElementById("save-btn-text").textContent = "Salvar Cliente";
            document.getElementById("client-notes").placeholder="Ex: Intolerante a lactose";
        } else {
            if (labelClientName) labelClientName.textContent = "Nome do Fornecedor";
            if (clientNameInput) clientNameInput.placeholder = "Ex: Distribuidora Doces & Cia";
            document.getElementById("client-notes").placeholder="Ex: Entregam 2 dias após o pedido"

            dynamicFieldContainer.innerHTML = `
                <label for="client-product">Produto Consumido / Fornecido</label>
                <input type="text" id="client-product" list="stock-products-datalist" required placeholder="Ex: Embalagens, Leite Condensado">
            `;
            document.getElementById("modal-title").textContent = "Cadastrar Novo Fornecedor";
            document.getElementById("save-btn-text").textContent = "Salvar Fornecedor";

            carregarProdutosEstoqueParaDatalist();
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

        // Renderizar Clientes
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
                        <td>
                        <i class="fa-brands fa-whatsapp text-success"></i> ${formatarTelefone(client.telefone)}</td>

                        <td>${aniversarioFormatado}</td>
                        <td><strong>${client.totalGasto}</strong></td>
                        <td>
                            <button class="action-icon-btn history-btn" title="Ver Histórico e Observações" data-type="cliente" data-id="${client.id}">
                                <i class="fa-regular fa-circle-user"></i>
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

        // Renderizar Fornecedores
        if (sectionSuppliers.style.display !== "none") {
            if (filteredSuppliers.length === 0) {
                supplierTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum fornecedor encontrado.</td></tr>`;
            } else {
                filteredSuppliers.forEach(supplier => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><span class="info-name">${supplier.nome}</span></td>
                        <td><i class="fa-brands fa-whatsapp text-success"></i>  ${formatarTelefone(supplier.telefone)}</td>
                        <td>${supplier.produtoConsumido}</td>
                        <td><strong>${supplier.totalGasto}</strong></td>
                        <td>
                            <button class="action-icon-btn history-btn" title="Ver Histórico e Observações" data-type="fornecedor" data-id="${supplier.id}">
                                <i class="fa-regular fa-circle-user"></i>
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
    
    function formatarTelefone(telefone) {
        if (!telefone) return "Sem telefone";

        // Remove tudo o que não for número (limpa parênteses, traços, espaços)
        const apenasNumeros = String(telefone).replace(/\D/g, "");

        // Celular com 11 dígitos: 15222223333 -> (15) 22222-3333
        if (apenasNumeros.length === 11) {
            return apenasNumeros.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
        }
        
        // Telefone Fixo com 10 dígitos: 1255554444 -> (12) 5555-4444
        if (apenasNumeros.length === 10) {
            return apenasNumeros.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
        }

        // Caso o dado já venha formatado de outra forma ou incompleto, retorna o original
        return telefone; 
    }


    // Eventos dos botões de filtro
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

    function attachEventListeners() {
        document.querySelectorAll(".history-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.currentTarget.getAttribute("data-id"));
                const type = e.currentTarget.getAttribute("data-type");
                openHistoryModal(id, type);
            });
        });

        document.querySelectorAll(".whatsapp-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const phone = e.currentTarget.getAttribute("data-phone").replace(/\D/g, "");
                alert(`Abrindo conversa no WhatsApp para o número: ${phone}`);
            });
        });
    }

    function openHistoryModal(id, type) {
        let contact = type === "cliente" 
            ? clientesData.find(c => c.id === id) 
            : fornecedoresData.find(f => f.id === id);

        if (!contact) return;

        historyClientName.textContent = contact.nome;
        historyClientPhone.innerHTML = `<i class="fa-brands fa-whatsapp text-success"></i>${formatarTelefone(contact.telefone)}`;
        historyClientEmail.innerHTML = `<i class="fa-regular fa-envelope" style="color: rgb(218, 26, 26);"></i> ${contact.email || 'Sem e-mail cadastrado'}`;
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

    openNewClientModalBtn.addEventListener("click", () => clientModal.classList.add("active"));
    closeModalBtn.addEventListener("click", () => clientModal.classList.remove("active"));
    closeHistoryModal.addEventListener("click", () => historyModal.classList.remove("active"));

    window.addEventListener("click", (e) => {
        if (e.target === clientModal) clientModal.classList.remove("active");
        if (e.target === historyModal) historyModal.classList.remove("active");
    });

    // Salvar Novo Contato (em memória, igual ao script original)
    clientForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const type = contactTypeSelect.value;
        const nome = document.getElementById("client-name").value;
        const telefone = document.getElementById("client-phone").value;
        const email = document.getElementById("client-email").value;
        const observacoes = document.getElementById("client-notes").value;

        if (type === "cliente") {
            const aniversario = document.getElementById("client-birthday").value;
            clientesData.push({
                id: clientesData.length + 1,
                nome,
                telefone,
                email,
                aniversario,
                observacoes,
                totalGasto: "R$ 0,00",
                historico: []
            });
            alert("Cliente cadastrado com sucesso!");
        } 
        else {
            const produtoConsumido = document.getElementById("client-product").value;
            fornecedoresData.push({
                id: fornecedoresData.length + 1,
                nome,
                telefone,
                email,
                produtoConsumido,
                observacoes,
                totalGasto: "R$ 0,00",
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

    searchContactInput.addEventListener("input", (e) => {
        renderContacts(e.target.value);
    });

    // Inicialização
    carregarProdutosEstoqueParaDatalist();
    renderContacts();
});