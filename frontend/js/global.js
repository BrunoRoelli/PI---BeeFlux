//ativar menu sanduiche
const menuBtn = document.getElementById("menu-btn");
const mobileMenu = document.getElementById("mobile-menu");
menuBtn.addEventListener("click", () => {
mobileMenu.classList.toggle("active");
});
// ==========================================
// AUTENTICAÇÃO TELA DE LOGIN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. VERIFICA SE A USUÁRIA ESTÁ LOGADA
    const estaLogado = localStorage.getItem("beeflux_usuario_logado");
    if (!estaLogado) {
        irParaLogin();
        return;
    }
    // 2. RECUPERA DADOS DA USUÁRIA
    const nomeConfeiteira =localStorage.getItem("beeflux_nome_usuario") || "Confeiteira";
    // MOSTRA O NOME: Coloca o nome na tela
    const spanNome = document.getElementById("user-name");
    if (spanNome) {
        spanNome.textContent = nomeConfeiteira;
    }
    // MOSTRA A INICIAL DO NOME
    const userInitials = document.getElementById("user-initials");
    if (userInitials) {
        userInitials.textContent = nomeConfeiteira.charAt(0).toUpperCase();
    }
    // 4. BOTÃO SAIR
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {

            const confirmar = confirm(
                "Deseja realmente sair do sistema?"
            );

            if (!confirmar) {
                return;
            }

            // Remove os dados da sessão simulada
            localStorage.removeItem("beeflux_usuario_logado");
            localStorage.removeItem("beeflux_nome_usuario");

            // Volta para o login
            alert("Sessão encerrada com sucesso.");
            irParaLogin()
        });
    }
});
function irParaLogin() {
    const caminhoLogin = window.location.pathname.includes("/html/")
        ? "login.html"
        : "html/login.html";
    window.location.href = caminhoLogin;
}