// ==========================================
// ENVIO AUTOMÁTICO DO TOKEN PARA A API
// ==========================================
(function () {
    const API_BASE = "http://localhost:3000/api";
    const fetchOriginal = window.fetch.bind(window);

    window.fetch = async function (recurso, opcoes = {}) {
        const url = typeof recurso === "string" ? recurso : recurso.url;
        const ehApi = url.startsWith(API_BASE);
        const ehAuth = url.startsWith(API_BASE + "/auth/");
        const token = localStorage.getItem("beeflux_token");

        if (ehApi && !ehAuth && token) {
            const headers = new Headers(opcoes.headers || {});
            if (!headers.has("Authorization")) {
                headers.set("Authorization", "Bearer " + token);
            }
            opcoes = { ...opcoes, headers };
        }

        const resposta = await fetchOriginal(recurso, opcoes);

        // Token ausente, inválido ou expirado: volta para o login.
        if (ehApi && !ehAuth && resposta.status === 401) {
            limparSessao();
            irParaLogin();
        }

        return resposta;
    };
})();

function limparSessao() {
    localStorage.removeItem("beeflux_token");
    localStorage.removeItem("beeflux_usuario_logado");
    localStorage.removeItem("beeflux_nome_usuario");
    localStorage.removeItem("beeflux_usuario_id");
}

//ativar menu sanduiche
const menuBtn = document.getElementById("menu-btn");
const mobileMenu = document.getElementById("mobile-menu");
menuBtn.addEventListener("click", () => {
mobileMenu.classList.toggle("active");
});
// ==========================================
// AUTENTICAÇÃO TELA DE LOGIN
// ==========================================
function irParaLogin() {
    const caminhoLogin = window.location.pathname.includes("/html/")
        ? "login.html"
        : "html/login.html"
    window.location.href = caminhoLogin;
}
function realizarLogout() {
    if (!confirm("Deseja realmente sair do sistema?")) return;
    // Remove os dados da sessão simulada
    limparSessao();
    alert("Sessão encerrada com sucesso.");
    irParaLogin();
}
// ==========================================
// INICIALIZAÇÃO DA PÁGINA
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. VERIFICA SE A USUÁRIA ESTÁ LOGADA
    if (!localStorage.getItem("beeflux_usuario_logado") || !localStorage.getItem("beeflux_token")) {
        irParaLogin();
        return;
    }
    
    // 2. RECUPERA E EXIBE DADOS DA USUÁRIA
    const nomeConfeiteira = localStorage.getItem("beeflux_nome_usuario") || "Confeiteira";
    // MOSTRA O NOME: Coloca o nome na tela
    const spanNome = document.getElementById("user-name");
    if (spanNome) spanNome.textContent = nomeConfeiteira;
    // MOSTRA A INICIAL DO NOME
    const userInitials = document.getElementById("user-initials");
    if (userInitials) {userInitials.textContent = nomeConfeiteira.charAt(0).toUpperCase();}
    // 3. BOTÕES DE LOGOUT (Unificados para atender tanto o footer quanto o menu)
    const botoesLogout = document.querySelectorAll("#logout-btn, #dropdown-logout-btn");
    botoesLogout.forEach(btn => {
        btn.addEventListener("click", realizarLogout);
    });

    // 4. MENU DO AVATAR (DROPDOWN)
    const userMenuBtn = document.getElementById("user-menu-btn");
    const userDropdown = document.getElementById("user-dropdown");

    if (userMenuBtn && userDropdown) {
        // Abre/Fecha o menu ao clicar no avatar
        userMenuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle("hidden");
        });

        // Fecha o menu ao clicar em qualquer lugar fora dele
        window.addEventListener("click", () => {
            userDropdown.classList.add("hidden");
        });
    }
});