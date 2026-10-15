export interface CadastroUsuario {
    nome: string;
    email: string;
    senha: string;
    confirmarSenha: string;
}

export function validarCadastro(dados: CadastroUsuario): string | null {
    if (dados.nome.trim() === "") {
        return "O nome é obrigatório.";
    }

    if (dados.email.trim() === "") {
        return "O e-mail é obrigatório.";
    }

    if (dados.senha.length < 6) {
        return "A senha deve ter pelo menos 6 caracteres.";
    }

    if (dados.senha !== dados.confirmarSenha) {
        return "As senhas não coincidem.";
    }

    return null;
}