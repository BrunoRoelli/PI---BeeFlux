import type { SalvarCardapio, ItemCardapioVinculo, StatusDisponibilidade } from './cardapio.types';

export function inteiroPositivo(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
}

export function validarCabecalhoCardapio(d: unknown): asserts d is SalvarCardapio {
  if (!d || typeof d !== 'object') throw new Error('Dados do cardápio inválidos.');
  const x = d as Record<string, unknown>;

  if (typeof x.nome_cardapio !== 'string' || !x.nome_cardapio.trim() || x.nome_cardapio.trim().length > 100) {
    throw new Error('Nome do cardápio é obrigatório e deve ter até 100 caracteres.');
  }

  if (x.descricao_cardapio != null && (typeof x.descricao_cardapio !== 'string' || x.descricao_cardapio.length > 500)) {
    throw new Error('Descrição do cardápio deve ter até 500 caracteres.');
  }

  if (x.ativo != null && typeof x.ativo !== 'boolean') {
    throw new Error('Status ativo deve ser um valor booleano.');
  }
}

export function validarItemVinculo(d: unknown): asserts d is ItemCardapioVinculo {
  if (!d || typeof d !== 'object') throw new Error('Dados do item de cardápio inválidos.');
  const x = d as Record<string, unknown>;

  if (!inteiroPositivo(Number(x.id_produto))) {
    throw new Error('ID do produto inválido.');
  }

  if (x.preco_cardapio != null) {
    const preco = Number(x.preco_cardapio);
    if (!Number.isFinite(preco) || preco < 0) {
      throw new Error('Preço do cardápio não pode ser negativo ou inválido.');
    }
  }

  if (x.disponivel != null && typeof x.disponivel !== 'boolean') {
    throw new Error('Disponibilidade deve ser booleana.');
  }

  if (x.ordem_exibicao != null) {
    const ordem = Number(x.ordem_exibicao);
    if (!Number.isSafeInteger(ordem) || ordem < 0) {
      throw new Error('Ordem de exibição deve ser um número inteiro maior ou igual a zero.');
    }
  }
}

export function calcularStatusDisponibilidade(
  tipoProduto: 'REVENDA' | 'FEITO',
  saldoPronto: number,
  capacidadeProducao: number,
  ativoCardapio: boolean
): { status: StatusDisponibilidade; disponivelVenda: boolean } {
  if (!ativoCardapio) {
    return { status: 'INDISPONIVEL', disponivelVenda: false };
  }

  if (saldoPronto > 0) {
    return { status: 'PRONTO_ENTREGA', disponivelVenda: true };
  }

  if (tipoProduto === 'FEITO' && capacidadeProducao > 0) {
    return { status: 'SOB_ENCOMENDA', disponivelVenda: true };
  }

  return { status: 'INDISPONIVEL', disponivelVenda: false };
}
