import { contatosRepository } from './contatos.repository';
import type { ClienteInput, FornecedorInput } from './contatos.types';

function validarNomeTelefone(input: { nome?: string; telefone?: string }, telefoneObrigatorio: boolean) {
  if (!input.nome?.trim()) throw new Error('O nome é obrigatório.');
  if (telefoneObrigatorio && !input.telefone?.trim()) throw new Error('O telefone é obrigatório.');
}

export const contatosService = {
  async listarClientes(busca?: string, status?: string) {
    return contatosRepository.listarClientes(busca, status);
  },
  async salvarCliente(input: ClienteInput, id?: number) {
    validarNomeTelefone(input, true);
    const telefone = input.telefone.replace(/\D/g, '');
    if (await contatosRepository.telefoneClienteEmUso(telefone, id)) {
      throw new Error('Este telefone já está cadastrado para outro cliente.');
    }
    if (id) {
      if (!(await contatosRepository.buscarClientePorId(id))) throw new Error('Cliente não encontrado.');
      await contatosRepository.atualizarCliente(id, { ...input, telefone });
      return id;
    }
    return contatosRepository.criarCliente({ ...input, telefone });
  },
  async statusCliente(id: number, ativo: boolean) {
    if (!(await contatosRepository.buscarClientePorId(id))) throw new Error('Cliente não encontrado.');
    await contatosRepository.alterarStatusCliente(id, ativo);
  },
  async historicoCliente(id: number) {
    if (!(await contatosRepository.buscarClientePorId(id))) throw new Error('Cliente não encontrado.');
    return contatosRepository.historicoCliente(id);
  },
  async listarFornecedores(busca?: string, status?: string) {
    return contatosRepository.listarFornecedores(busca, status);
  },
  async salvarFornecedor(input: FornecedorInput, id?: number) {
    validarNomeTelefone(input, false);
    if (id) {
      if (!(await contatosRepository.buscarFornecedorPorId(id))) throw new Error('Fornecedor não encontrado.');
      await contatosRepository.atualizarFornecedor(id, input);
      return id;
    }
    return contatosRepository.criarFornecedor(input);
  },
  async statusFornecedor(id: number, ativo: boolean) {
    if (!(await contatosRepository.buscarFornecedorPorId(id))) throw new Error('Fornecedor não encontrado.');
    await contatosRepository.alterarStatusFornecedor(id, ativo);
  },
  async historicoFornecedor(id: number) {
    if (!(await contatosRepository.buscarFornecedorPorId(id))) throw new Error('Fornecedor não encontrado.');
    return contatosRepository.historicoFornecedor(id);
  }
};