document.addEventListener("DOMContentLoaded", () => {
    const cadastroForm = document.getElementById("cadastro-form");
    const nomeInput = document.getElementById("nome");
    const emailInput = document.getElementById("email");
    const senhaInput = document.getElementById("senha");
    const confirmaSenhaInput = document.getElementById("confirma-senha");
    const erroMensagem = document.getElementById("erro-mensagem");

    cadastroForm.addEventListener("submit", (evento) => {
        evento.preventDefault();

        const nome = nomeInput.value.trim();
        const email = emailInput.value.trim();
        const senha = senhaInput.value.trim();
        const confirmaSenha = confirmaSenhaInput.value.trim();

        // Validações básicas
        if (!nome || !email || !senha || !confirmaSenha) {
            mostrarErro("Por favor, preencha todos os campos.");
            return;
        }

        if (senha.length < 6) {
            mostrarErro("A senha precisa ter pelo menos 6 caracteres.");
            return;
        }

        if (senha !== confirmaSenha) {
            mostrarErro("As senhas não coincidem. Tente novamente.");
            return;
        }

        // Simulação de salvamento e login automático
        // (Aqui futuramente você faria o fetch POST para sua API de cadastro)
        localStorage.setItem("beeflux_usuario_logado", "true");
        localStorage.setItem("beeflux_nome_usuario", nome);

        erroMensagem.classList.add("hidden");
        
        alert("Conta criada com sucesso! Bem-vinda ao BeeFlux.");
        
        // Redireciona para a página principal
        window.location.href = "../index.html";
    });

    function mostrarErro(mensagem) {
        erroMensagem.textContent = mensagem;
        erroMensagem.classList.remove("hidden");
        senhaInput.focus();
    }
});