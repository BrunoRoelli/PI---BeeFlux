import * as repo from './custos.repository';
import type {
  AtualizarDespesaInput,
  CategoriaDespesa,
  CriarDespesaInput,
  CriarRetiradaInput,
  FiltroFinanceiro,
  StatusDespesa,
  TipoMovimentacaoFinanceira
} from './custos.types';

const CATEGORIAS: CategoriaDespesa[] = [
  'ALUGUEL', 'ENERGIA', 'AGUA', 'INTERNET', 'MANUTENCAO', 'EMBALAGEM', 'MAO_DE_OBRA', 'OUTRO'
];

function validarData(data: string, campo: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T00:00:00`))) {
    throw new Error(`${campo} deve estar no formato AAAA-MM-DD.`);
  }
}

function validarPeriodo(de?: string, ate?: string): void {
  if (de) validarData(de, 'Data inicial');
  if (ate) validarData(ate, 'Data final');
  if (de && ate && de > ate) throw new Error('A data inicial não pode ser maior que a data final.');
}

export async function consultarMovimentacoes(filtro: FiltroFinanceiro) {
  validarPeriodo(filtro.de, filtro.ate);
  if (filtro.tipo && !(['ENTRADA', 'SAIDA'] as TipoMovimentacaoFinanceira[]).includes(filtro.tipo)) {
    throw new Error('Tipo de movimentação inválido.');
  }
  return repo.listarMovimentacoes(filtro);
}

export async function consultarResumo(de?: string, ate?: string) {
  validarPeriodo(de, ate);
  return repo.obterResumo(de, ate);
}

export async function consultarDespesas(status?: StatusDespesa) {
  if (status && !(['PENDENTE', 'PAGO'] as StatusDespesa[]).includes(status)) {
    throw new Error('Status de despesa inválido.');
  }
  return repo.listarDespesas(status);
}

export async function cadastrarDespesa(dados: CriarDespesaInput) {
  const descricao = dados.descricao_despesa?.trim();
  if (!descricao) throw new Error('Informe a descrição da despesa.');
  if (!CATEGORIAS.includes(dados.categoria_despesa)) throw new Error('Categoria de despesa inválida.');
  if (!Number.isFinite(dados.valor_despesa) || dados.valor_despesa <= 0) {
    throw new Error('O valor da despesa deve ser maior que zero.');
  }
  validarData(dados.data_despesa, 'Data da despesa');
  if (dados.data_vencimento) validarData(dados.data_vencimento, 'Data de vencimento');
  if (dados.observacao && dados.observacao.length > 500) throw new Error('A observação deve ter no máximo 500 caracteres.');

  return repo.criarDespesa({ ...dados, descricao_despesa: descricao });
}

export async function editarDespesa(id: number, dados: AtualizarDespesaInput) {
  if (!Number.isInteger(id) || id <= 0) throw new Error('ID de despesa inválido.');
  
  if (dados.descricao_despesa !== undefined) {
    dados.descricao_despesa = dados.descricao_despesa.trim();
    if (!dados.descricao_despesa) throw new Error('A descrição da despesa não pode ser vazia.');
  }
  if (dados.categoria_despesa && !CATEGORIAS.includes(dados.categoria_despesa)) {
    throw new Error('Categoria de despesa inválida.');
  }
  if (dados.valor_despesa !== undefined && (!Number.isFinite(dados.valor_despesa) || dados.valor_despesa <= 0)) {
    throw new Error('O valor da despesa deve ser maior que zero.');
  }
  if (dados.data_despesa) validarData(dados.data_despesa, 'Data da despesa');
  if (dados.data_vencimento) validarData(dados.data_vencimento, 'Data de vencimento');

  const afetadas = await repo.atualizarDespesa(id, dados);
  if (!afetadas) throw new Error('Despesa não encontrada ou já está paga (apenas despesas pendentes podem ser editadas).');
  return { mensagem: 'Despesa atualizada com sucesso.' };
}

export async function removerDespesa(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error('ID de despesa inválido.');
  const afetadas = await repo.excluirDespesa(id);
  if (!afetadas) throw new Error('Despesa não encontrada ou já está paga (apenas despesas pendentes podem ser excluídas).');
  return { mensagem: 'Despesa excluída com sucesso.' };
}

export async function confirmarPagamentoDespesa(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error('ID de despesa inválido.');
  const afetadas = await repo.marcarDespesaComoPaga(id);
  if (!afetadas) throw new Error('Despesa não encontrada ou já está paga.');
  return { mensagem: 'Despesa marcada como paga com sucesso.' };
}

export async function cadastrarRetirada(dados: CriarRetiradaInput) {
  if (!Number.isInteger(dados.id_user) || dados.id_user <= 0) throw new Error('Usuário inválido.');
  if (!Number.isFinite(dados.valor_retirada) || dados.valor_retirada <= 0) {
    throw new Error('O valor da retirada deve ser maior que zero.');
  }
  if (dados.descricao_retirada && dados.descricao_retirada.length > 255) {
    throw new Error('A descrição deve ter no máximo 255 caracteres.');
  }
  return repo.criarRetirada(dados);
}

export async function consultarRetiradas() {
  return repo.listarRetiradas();
}
