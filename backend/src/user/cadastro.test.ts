import { describe, expect, test } from "vitest";
import { validarCadastro } from "./cadastro";
import { CadastroUsuario } from "./cadastro";

describe("Testes da função validarCadastro", () => {
    const usuarioBaseValido: CadastroUsuario = {
        nome: "Lucas Silva",
        email: "lucas@email.com",
        senha: "123456",
        confirmarSenha: "123456",
    };

    test("Deve retornar null quando todos os dados forem válidos", () => {
        const resultado = validarCadastro(usuarioBaseValido);

        expect(resultado).toBeNull();
    });

    test("Deve retornar erro se o nome estiver vazio", () => {
        const dados = {
            ...usuarioBaseValido,
            nome: "",
        };

        const resultado = validarCadastro(dados);

        expect(resultado).toBe("O nome é obrigatório.");
    });

    test("Deve retornar erro se o nome contiver apenas espaços", () => {
        const dados = {
            ...usuarioBaseValido,
            nome: "   ",
        };

        const resultado = validarCadastro(dados);

        expect(resultado).toBe("O nome é obrigatório.");
    });

    test("Deve retornar erro se o e-mail estiver vazio", () => {
        const dados = {
            ...usuarioBaseValido,
            email: "",
        };

        const resultado = validarCadastro(dados);

        expect(resultado).toBe("O e-mail é obrigatório.");
    });

    test("Deve retornar erro se o e-mail contiver apenas espaços", () => {
        const dados = {
            ...usuarioBaseValido,
            email: "   ",
        };

        const resultado = validarCadastro(dados);

        expect(resultado).toBe("O e-mail é obrigatório.");
    });

    test("Deve retornar erro se a senha tiver menos de 6 caracteres", () => {
        const dados = {
            ...usuarioBaseValido,
            senha: "123",
            confirmarSenha: "123",
        };

        const resultado = validarCadastro(dados);

        expect(resultado).toBe(
            "A senha deve ter pelo menos 6 caracteres."
        );
    });

    test("Deve retornar erro se as senhas não forem iguais", () => {
        const dados = {
            ...usuarioBaseValido,
            confirmarSenha: "outrasenhadiferente",
        };

        const resultado = validarCadastro(dados);

        expect(resultado).toBe("As senhas não coincidem.");
    });
});