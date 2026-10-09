document.addEventListener("DOMContentLoaded", () => {
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const erroMensagem = document.getElementById("erro-mensagem");

loginForm.addEventListener("submit", (evento) => {
    // Impede o comportamento padrão de recarregar a página bruscamente do form
    evento.preventDefault();

    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();

    // Validação básica de preenchimento
    if (email === "" || senha === "") {
        mostrarErro("Por favor, preencha todos os campos.");
        return;
    }

    // Simulando um login bem-sucedido para fins de Front-End:
    // Vamos fingir que o email 'confeiteira@beeflux.com' com senha '123456' é válido,
    // ou aceitar qualquer email de teste e extrair o nome antes do '@'.
    if (senha.length < 6) {
        mostrarErro("A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    // Simula o nome da usuária com base no e-mail digitado (ex: ana.silva@... vira "Ana Silva")
    let nomeUsuario = email.split("@")[0];
    nomeUsuario = nomeUsuario.charAt(0).toUpperCase() + nomeUsuario.slice(1);
    // Salvando os dados na sessão do navegador para a página principal (index.html) ler
    localStorage.setItem("beeflux_usuario_logado", "true");
    localStorage.setItem("beeflux_nome_usuario", nomeUsuario);
    // Feedback visual de sucesso e redirecionamento
    erroMensagem.classList.add("hidden");
    // Redireciona para a página principal do seu sistema
    window.location.href = "../index.html"; 
        });

        function mostrarErro(mensagem) {
            erroMensagem.textContent = mensagem;
            erroMensagem.classList.remove("hidden");
            // Animação leve de alerta ou foco
            senhaInput.focus();
        }
});
// SIMULAÇÃO DE CONEXÃO COM O BACK-END / AUTENTICAÇÃO:
// Aqui é onde você faria um fetch() para o seu backend futuramente, ex:
/*
fetch('https://sua-api.com/login', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ email, senha })
})
.then(response => response.json())
.then(data => { ... })
*/

// Simulando um login bem-sucedido para fins de Front-End:
// Vamos fingir que o email 'confeiteira@beeflux.com' com senha '123456' é válido,
// ou aceitar qualquer email de teste e extrair o nome antes do '@'.