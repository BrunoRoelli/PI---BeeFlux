
import { describe, it, expect } from "vitest";
import { cadastrarUsuario } from "../../modules/auth/auth.service";

describe("Cadastro de usuários", () => {
  it("deve cadastrar um usuário válido", () => {
    const usuario = cadastrarUsuario(
      "Ana",
      "ana@teste.com",
      "hash-ficticio"
    );

    expect(usuario.nome).toBe("Ana");
    expect(usuario.email).toBe("ana@teste.com");
    expect(usuario.senhaHash).toBe("hash-ficticio");
    expect(usuario.id).toBeTypeOf("number");
  });

  it("deve rejeitar um e-mail já cadastrado", () => {
    cadastrarUsuario(
      "Carlos",
      "duplicado@teste.com",
      "hash-ficticio"
    );

    expect(() => {
      cadastrarUsuario(
        "Maria",
        "duplicado@teste.com",
        "outro-hash"
      );
    }).toThrow("Este e-mail já está cadastrado.");
  });

  it("deve rejeitar um nome vazio", () => {
    expect(() => {
      cadastrarUsuario(
        "   ",
        "nome@teste.com",
        "hash-ficticio"
      );
    }).toThrow("O nome é obrigatório.");
  });

  it("deve rejeitar um e-mail inválido", () => {
    expect(() => {
      cadastrarUsuario(
        "Pedro",
        "email-invalido",
        "hash-ficticio"
      );
    }).toThrow("E-mail inválido.");
  });
});
