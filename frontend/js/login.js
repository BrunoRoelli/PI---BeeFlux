
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const emailInput = document.getElementById("email");
    const senhaInput = document.getElementById("senha");
    const erroMensagem = document.getElementById("erro-mensagem");
    const botaoEntrar = loginForm.querySelector('button[type="submit"]');

    function mostrarMensagem(mensagem) {
        erroMensagem.textContent = mensagem;
        erroMensagem.classList.remove("hidden");
    }

    loginForm.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const email = emailInput.value.trim();
        const senha = senhaInput.value;

        erroMensagem.classList.add("hidden");

        if (!email || !senha) {
            mostrarMensagem("Por favor, preencha todos os campos.");
            return;
        }

        botaoEntrar.disabled = true;
        botaoEntrar.textContent = "Entrando...";

        try {
            const resposta = await fetch(
                "http://localhost:3000/api/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email, senha })
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                mostrarMensagem(
                    dados.mensagem || "Não foi possível realizar o login."
                );
                return;
            }

            // Salva somente informações básicas para a interface.
            localStorage.setItem("beeflux_usuario_logado", "true");
            localStorage.setItem(
                "beeflux_nome_usuario",
                dados.usuario.nome
            );

            window.location.href = "../index.html";
        } catch (erro) {
            mostrarMensagem(
                "Não foi possível conectar ao servidor. Verifique se a API está funcionando."
            );
            console.error("Erro ao realizar login:", erro);
        } finally {
            botaoEntrar.disabled = false;
            botaoEntrar.innerHTML =
                '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
        }
    });
});
