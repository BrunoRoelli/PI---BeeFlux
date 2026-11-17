document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "http://localhost:3000/api";

    let clientesData = [];
    let fornecedoresData = [];

    // Estado de edição (não depende de input hidden no HTML)
    let editingContactId = null;
    let editingOriginalType = null; // 'cliente' ou 'fornecedor'

    // Tabelas cliente e fornecedor
    const clientsTableBody = document.getElementById("clients-table-body");
    const supplierTableBody = document.getElementById("supplier-table-body");

    // Total cliente e fornecedor
    const totalClientsCount = document.getElementById("total-clients-count");
    const totalSuppliersCount = document.getElementById("total-suppliers-count");

    // Pesquisa contato e botões de filtro
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

    const modalTitleElem = document.getElementById("modal-title");
    const modalDescElem = clientModal.querySelector(".modal-header p");
    const saveBtnTextElem = document.getElementById("save-btn-text");

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

    // --- FUNÇÃO DE COMUNICAÇÃO COM A API ---
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
            throw new Error(data?.mensagem || data?.erro || `Erro HTTP ${response.status}`);
        }
        return data;
    }

    function formatarMoeda(valor) {
        const num = Number(valor || 0);
        return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function formatarData(dataStr) {
        if (!dataStr) return "-";
        const iso = String(dataStr).split("T")[0];
        const partes = iso.split("-");
        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        return dataStr;
    }

    // Carregar Clientes e Fornecedores ativos do MySQL
    async function carregarContatosDoBanco() {
        try {
            const [clientesApi, fornecedoresApi] = await Promise.all([
                apiRequest("/clientes?status=ativos"),
                apiRequest("/fornecedores?status=ativos")
            ]);

            clientesData = (clientesApi || []).map(c => ({
                id: Number(c.id_cliente),
                nome: c.nome_cliente || "",
                telefone: c.telefone_cliente || "",
                email: c.email_cliente || "",
                aniversario: "",
                observacoes: c.observacao || "",
                totalGasto: formatarMoeda(c.total_pedidos ?? 0)
            }));

            fornecedoresData = (fornecedoresApi || []).map(f => ({
                id: Number(f.id_fornecedor),
                nome: f.nome_fornecedor || "",
                telefone: f.telefone_fornecedor || "",
                email: f.email_fornecedor || "",
                produtoConsumido: f.produtos_fornecidos || "-",
                observacoes: f.complemento || "",
                totalGasto: formatarMoeda(f.total_comprado ?? 0)
            }));

            renderContacts(searchContactInput.value);
        } catch (err) {
            console.error("Erro ao carregar contatos:", err);
            alert(`Não foi possível carregar os contatos do banco: ${err.message}`);
        }
    }

    // Carregar produtos reais do estoque no MySQL para o datalist
    async function carregarProdutosEstoqueParaDatalist() {
        if (!stockProductsDatalist) return;
        stockProductsDatalist.innerHTML = "";
        try {
            const produtos = await apiRequest("/estoque");
            (produtos || []).forEach(item => {
                const option = document.createElement("option");
                option.value = item.nome_produto || item.nome;
                stockProductsDatalist.appendChild(option);
            });
        } catch {
            // Ignora caso não haja produtos
        }
    }

    // Verificar se veio do index.html para abrir o modal automaticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("abrirModal") === "true") {
        clientModal.classList.add("active");
    }

    // Alternar campos do modal conforme seleção (Cliente vs Fornecedor)
    contactTypeSelect.addEventListener("change", (e) => {
        const type = e.target.value;
        const isEditing = editingContactId !== null;

        if (type === "cliente") {
            if (labelClientName) labelClientName.textContent = "Nome Completo";
            if (clientNameInput) clientNameInput.placeholder = "Ex: Mariana Silva";

            dynamicFieldContainer.innerHTML = `
                <label for="client-birthday">Data de Nascimento</label>
                <input type="date" id="client-birthday">
            `;
            if (!isEditing) {
                if (modalTitleElem) modalTitleElem.textContent = "Cadastrar Novo Cliente";
                if (saveBtnTextElem) saveBtnTextElem.textContent = "Salvar Cliente";
            }
            const notesEl = document.getElementById("client-notes");
            if (notesEl) notesEl.placeholder = "Ex: Intolerante a lactose";
        } else {
            if (labelClientName) labelClientName.textContent = "Nome do Fornecedor";
            if (clientNameInput) clientNameInput.placeholder = "Ex: Distribuidora Doces & Cia";
            const notesEl = document.getElementById("client-notes");
            if (notesEl) notesEl.placeholder = "Ex: Entregam 2 dias após o pedido";

            dynamicFieldContainer.innerHTML = `
                <label for="client-product">Produto Consumido / Fornecido</label>
                <input type="text" id="client-product" list="stock-products-datalist" placeholder="Ex: Embalagens, Leite Condensado">
            `;
            if (!isEditing) {
                if (modalTitleElem) modalTitleElem.textContent = "Cadastrar Novo Fornecedor";
                if (saveBtnTextElem) saveBtnTextElem.textContent = "Salvar Fornecedor";
            }

            carregarProdutosEstoqueParaDatalist();
        }
    });

    function formatarTelefone(telefone) {
        if (!telefone) return "Sem telefone";
        const apenasNumeros = String(telefone).replace(/\D/g, "");

        if (apenasNumeros.length === 11) {
            return apenasNumeros.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
        }
        if (apenasNumeros.length === 10) {
            return apenasNumeros.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
        }
        return telefone;
    }

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
                        <td><i class="fa-brands fa-whatsapp text-success"></i> ${formatarTelefone(client.telefone)}</td>
                        <td>${aniversarioFormatado}</td>
                        <td><strong>${client.totalGasto}</strong></td>
                        <td>
                            <button type="button" class="action-icon-btn edit-contact-btn" title="Editar Cliente" data-type="cliente" data-id="${client.id}">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button type="button" class="action-icon-btn history-btn" title="Ver Histórico e Observações" data-type="cliente" data-id="${client.id}">
                                <i class="fa-regular fa-circle-user"></i>
                            </button>
                            <button type="button" class="action-icon-btn delete-contact-btn" title="Excluir Cliente" data-type="cliente" data-id="${client.id}">
                                <i class="fa-solid fa-trash"></i>
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
                        <td><i class="fa-brands fa-whatsapp text-success"></i> ${formatarTelefone(supplier.telefone)}</td>
                        <td>${supplier.produtoConsumido}</td>
                        <td><strong>${supplier.totalGasto}</strong></td>
                        <td>
                            <button type="button" class="action-icon-btn edit-contact-btn" title="Editar Fornecedor" data-type="fornecedor" data-id="${supplier.id}">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button type="button" class="action-icon-btn history-btn" title="Ver Histórico e Observações" data-type="fornecedor" data-id="${supplier.id}">
                                <i class="fa-regular fa-circle-user"></i>
                            </button>
                            <button type="button" class="action-icon-btn delete-contact-btn" title="Excluir Fornecedor" data-type="fornecedor" data-id="${supplier.id}">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    `;
                    supplierTableBody.appendChild(tr);
                });
            }
        }

        attachEventListeners();
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
        // 1. EDITAR CONTATO
        document.querySelectorAll(".edit-contact-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = Number(e.currentTarget.getAttribute("data-id"));
                const type = e.currentTarget.getAttribute("data-type");

                editingContactId = id;
                editingOriginalType = type;

                contactTypeSelect.value = type;
                contactTypeSelect.dispatchEvent(new Event("change"));

                if (type === "cliente") {
                    const client = clientesData.find(c => c.id === id);
                    if (!client) return;
                    document.getElementById("client-name").value = client.nome;
                    document.getElementById("client-phone").value = client.telefone;
                    const emailInput = document.getElementById("client-email");
                    if (emailInput) emailInput.value = client.email || "";
                    const bdayInput = document.getElementById("client-birthday");
                    if (bdayInput) bdayInput.value = client.aniversario || "";
                    document.getElementById("client-notes").value = client.observacoes || "";

                    if (modalTitleElem) modalTitleElem.textContent = "Editar Cliente";
                    if (saveBtnTextElem) saveBtnTextElem.textContent = "Salvar Alterações";
                } else {
                    const supplier = fornecedoresData.find(f => f.id === id);
                    if (!supplier) return;
                    document.getElementById("client-name").value = supplier.nome;
                    document.getElementById("client-phone").value = supplier.telefone;
                    const emailInput = document.getElementById("client-email");
                    if (emailInput) emailInput.value = supplier.email || "";
                    const prodInput = document.getElementById("client-product");
                    if (prodInput) prodInput.value = supplier.produtoConsumido !== "-" ? supplier.produtoConsumido : "";
                    document.getElementById("client-notes").value = supplier.observacoes || "";

                    if (modalTitleElem) modalTitleElem.textContent = "Editar Fornecedor";
                    if (saveBtnTextElem) saveBtnTextElem.textContent = "Salvar Alterações";
                }

                if (modalDescElem) modalDescElem.textContent = "Modifique as informações ou altere o tipo (Cliente/Fornecedor).";
                clientModal.classList.add("active");
            });
        });

        // 2. VER HISTÓRICO
        document.querySelectorAll(".history-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = Number(e.currentTarget.getAttribute("data-id"));
                const type = e.currentTarget.getAttribute("data-type");
                await openHistoryModal(id, type);
            });
        });

        // 3. EXCLUIR / DESATIVAR CONTATO
        document.querySelectorAll(".delete-contact-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = Number(e.currentTarget.getAttribute("data-id"));
                const type = e.currentTarget.getAttribute("data-type");
                const tipoTexto = type === "cliente" ? "este cliente" : "este fornecedor";

                if (!confirm(`Deseja realmente excluir ${tipoTexto}?`)) return;

                try {
                    const rota = type === "cliente" ? `/clientes/${id}/status` : `/fornecedores/${id}/status`;
                    await apiRequest(rota, {
                        method: "PATCH",
                        body: JSON.stringify({ ativo: false })
                    });

                    await carregarContatosDoBanco();
                    alert(`${type === "cliente" ? "Cliente" : "Fornecedor"} excluído com sucesso!`);
                } catch (err) {
                    alert(`Erro ao excluir: ${err.message}`);
                }
            });
        });
    }

    async function openHistoryModal(id, type) {
        const contact = type === "cliente"
            ? clientesData.find(c => c.id === id)
            : fornecedoresData.find(f => f.id === id);

        if (!contact) return;

        historyClientName.textContent = contact.nome;
        historyClientPhone.innerHTML = `<i class="fa-brands fa-whatsapp text-success"></i> ${formatarTelefone(contact.telefone)}`;
        if (historyClientEmail) {
            historyClientEmail.innerHTML = `<i class="fa-regular fa-envelope" style="color: rgb(218, 26, 26);"></i> ${contact.email || "Sem e-mail cadastrado"}`;
        }
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

        historyOrdersBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Carregando histórico...</td></tr>`;
        historyModal.classList.add("active");

        try {
            const rota = type === "cliente" ? `/clientes/${id}/historico` : `/fornecedores/${id}/historico`;
            const historicoApi = await apiRequest(rota);

            historyOrdersBody.innerHTML = "";
            if (Array.isArray(historicoApi) && historicoApi.length > 0) {
                historicoApi.forEach(order => {
                    const tr = document.createElement("tr");
                    const descricao = order.itens || `Registro #${order.id_pedido || order.id_compra || ""}`;
                    const data = formatarData(order.data_pedido || order.data_compra);
                    const valor = formatarMoeda(order.valor_total ?? 0);

                    tr.innerHTML = `
                        <td>${descricao}</td>
                        <td>${data}</td>
                        <td><strong>${valor}</strong></td>
                    `;
                    historyOrdersBody.appendChild(tr);
                });
            } else {
                historyOrdersBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Nenhum registro encontrado.</td></tr>`;
            }
        } catch {
            historyOrdersBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Nenhum registro encontrado.</td></tr>`;
        }
    }

    // Botão para Novo Contato (reseta o estado de edição)
    openNewClientModalBtn.addEventListener("click", () => {
        editingContactId = null;
        editingOriginalType = null;
        clientForm.reset();
        contactTypeSelect.value = "cliente";
        contactTypeSelect.dispatchEvent(new Event("change"));
        if (modalTitleElem) modalTitleElem.textContent = "Cadastrar Novo Cliente";
        if (modalDescElem) modalDescElem.textContent = "Adicione as informações de clientes ou fornecedores.";
        if (saveBtnTextElem) saveBtnTextElem.textContent = "Salvar Cliente";
        clientModal.classList.add("active");
    });

    closeModalBtn.addEventListener("click", () => clientModal.classList.remove("active"));
    closeHistoryModal.addEventListener("click", () => historyModal.classList.remove("active"));

    window.addEventListener("click", (e) => {
        if (e.target === clientModal) clientModal.classList.remove("active");
        if (e.target === historyModal) historyModal.classList.remove("active");
    });

    // Submissão do Formulário (Criação, Edição e Conversão Cliente <-> Fornecedor)
    clientForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const type = contactTypeSelect.value;
        const nome = document.getElementById("client-name").value.trim();
        const telefone = document.getElementById("client-phone").value.trim();
        const emailInput = document.getElementById("client-email");
        const email = emailInput && emailInput.value.trim() !== "" ? emailInput.value.trim() : null;
        const observacaoInput = document.getElementById("client-notes").value.trim();
        const observacao = observacaoInput !== "" ? observacaoInput : null;

        try {
            // CASO 1: Estava editando e TROCOU o tipo (Cliente -> Fornecedor ou Fornecedor -> Cliente)
            if (editingContactId !== null && editingOriginalType !== null && editingOriginalType !== type) {
                if (type === "fornecedor") {
                    // Cria como fornecedor
                    await apiRequest("/fornecedores", {
                        method: "POST",
                        body: JSON.stringify({
                            nome,
                            telefone: telefone || null,
                            email,
                            complemento: observacao
                        })
                    });
                    // Desativa o cliente antigo
                    await apiRequest(`/clientes/${editingContactId}/status`, {
                        method: "PATCH",
                        body: JSON.stringify({ ativo: false })
                    });
                    alert("Contato convertido de Cliente para Fornecedor com sucesso!");
                } else {
                    // Cria como cliente
                    await apiRequest("/clientes", {
                        method: "POST",
                        body: JSON.stringify({
                            nome,
                            telefone,
                            email,
                            observacao
                        })
                    });
                    // Desativa o fornecedor antigo
                    await apiRequest(`/fornecedores/${editingContactId}/status`, {
                        method: "PATCH",
                        body: JSON.stringify({ ativo: false })
                    });
                    alert("Contato convertido de Fornecedor para Cliente com sucesso!");
                }
            }
            // CASO 2: Edição normal no mesmo tipo
            else if (editingContactId !== null) {
                if (type === "cliente") {
                    await apiRequest(`/clientes/${editingContactId}`, {
                        method: "PUT",
                        body: JSON.stringify({ nome, telefone, email, observacao })
                    });
                    alert("Cliente atualizado no banco de dados com sucesso!");
                } else {
                    await apiRequest(`/fornecedores/${editingContactId}`, {
                        method: "PUT",
                        body: JSON.stringify({
                            nome,
                            telefone: telefone || null,
                            email,
                            complemento: observacao
                        })
                    });
                    alert("Fornecedor atualizado no banco de dados com sucesso!");
                }
            }
            // CASO 3: Novo cadastro
            else {
                if (type === "cliente") {
                    await apiRequest("/clientes", {
                        method: "POST",
                        body: JSON.stringify({ nome, telefone, email, observacao })
                    });
                    alert("Cliente cadastrado no banco de dados com sucesso!");
                } else {
                    await apiRequest("/fornecedores", {
                        method: "POST",
                        body: JSON.stringify({
                            nome,
                            telefone: telefone || null,
                            email,
                            complemento: observacao
                        })
                    });
                    alert("Fornecedor cadastrado no banco de dados com sucesso!");
                }
            }

            editingContactId = null;
            editingOriginalType = null;
            await carregarContatosDoBanco();
            clientForm.reset();
            contactTypeSelect.value = "cliente";
            contactTypeSelect.dispatchEvent(new Event("change"));
            clientModal.classList.remove("active");
        } catch (err) {
            alert(`Erro ao salvar contato: ${err.message}`);
        }
    });

    searchContactInput.addEventListener("input", (e) => {
        renderContacts(e.target.value);
    });

    // Inicialização
    carregarProdutosEstoqueParaDatalist();
    carregarContatosDoBanco();
});