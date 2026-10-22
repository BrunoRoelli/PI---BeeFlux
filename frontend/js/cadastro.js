
document.addEventListener("DOMContentLoaded", () => {
    const cadastroForm = document.getElementById("cadastro-form");
    const nomeInput = document.getElementById("nome");
    const emailInput = document.getElementById("email");
    const senhaInput = document.getElementById("senha");
    const confirmaSenhaInput = document.getElementById("confirma-senha");
    const erroMensagem = document.getElementById("erro-mensagem");
    const botaoCadastro = cadastroForm.querySelector(
        'button[type="submit"]'
    );

    cadastroForm.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const nome = nomeInput.value.trim();
        const email = emailInput.value.trim();
        // Não removemos espaços da senha automaticamente.
        const senha = senhaInput.value;
        const confirmaSenha = confirmaSenhaInput.value;

        esconderMensagem();

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

        botaoCadastro.disabled = true;
        botaoCadastro.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando...';

        try {
            const resposta = await fetch(
                "http://localhost:3000/api/auth/cadastro",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        nome,
                        email,
                        senha
                    })
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                mostrarErro(
                    dados.mensagem || "Não foi possível realizar o cadastro."
                );
                return;
            }

            alert("Conta criada com sucesso! Bem-vinda ao BeeFlux.");

            window.location.href = "login.html";
        } catch (erro) {
            console.error("Erro ao cadastrar:", erro);

            mostrarErro(
                "Não foi possível conectar ao servidor. Verifique se a API está funcionando."
            );
        } finally {
            botaoCadastro.disabled = false;
            botaoCadastro.innerHTML =
                '<i class="fa-solid fa-user-plus"></i> Cadastrar';
        }
    });

    function mostrarErro(mensagem) {
        erroMensagem.textContent = mensagem;
        erroMensagem.classList.remove("hidden");
    }

    function esconderMensagem() {
        erroMensagem.textContent = "";
        erroMensagem.classList.add("hidden");
    }
});
