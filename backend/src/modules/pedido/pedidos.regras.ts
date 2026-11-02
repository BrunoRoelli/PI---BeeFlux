import type { StatusPedido, StatusFinanceiro } from './pedidos.types';

export function arredondarMoeda(n: number): number {
  return Math.round(n * 100) / 100;
}

export function arredondarQuantidade(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function inteiroPositivo(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
}

export function numeroNaoNegativo(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function dataValidaFormato(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(Date.UTC(ano!, mes! - 1, dia!));
  return (
    d.getUTCFullYear() === ano &&
    d.getUTCMonth() + 1 === mes &&
    d.getUTCDate() === dia
  );
}

export function dataHoraValida(dataHora: string): boolean {
  const d = new Date(dataHora);
  return !isNaN(d.getTime());
}

export function calcularTotaisPedido(
  itens: Array<{ quantidade: number; preco_unitario: number }>,
  taxaEntrega = 0
): { valorItens: number; valorTotal: number } {
  let somaItens = 0;
  for (const item of itens) {
    const subtotal = arredondarMoeda(item.quantidade * item.preco_unitario);
    somaItens = arredondarMoeda(somaItens + subtotal);
  }
  const valorTotal = arredondarMoeda(somaItens + taxaEntrega);
  return {
    valorItens: somaItens,
    valorTotal
  };
}

/**
 * Regra: Fluxo de status operacional
 * PENDENTE -> CONFIRMADO, CANCELADO
 * CONFIRMADO -> EM_PREPARACAO, PRONTO, CANCELADO
 * EM_PREPARACAO -> PRONTO, CANCELADO
 * PRONTO -> CONCLUIDO, CANCELADO
 * CONCLUIDO -> (Estado final)
 * CANCELADO -> (Estado final)
 */
export const TRANSIÇÕES_PERMITIDAS: Record<StatusPedido, StatusPedido[]> = {
  PENDENTE: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['EM_PREPARACAO', 'PRONTO', 'CANCELADO'],
  EM_PREPARACAO: ['PRONTO', 'CANCELADO'],
  PRONTO: ['CONCLUIDO', 'CANCELADO'],
  CONCLUIDO: [],
  CANCELADO: []
};

export function validarTransicaoStatus(
  statusAtual: StatusPedido,
  novoStatus: StatusPedido
): void {
  if (statusAtual === novoStatus) return;

  const permitidos = TRANSIÇÕES_PERMITIDAS[statusAtual];
  if (!permitidos || !permitidos.includes(novoStatus)) {
    throw new Error(
      `Transição de status inválida: não é permitido alterar de ${statusAtual} para ${novoStatus}.`
    );
  }
}

export function podeCancelarPedido(status: StatusPedido): boolean {
  return status !== 'CANCELADO' && status !== 'CONCLUIDO';
}

export function podeEditarItensPedido(status: StatusPedido): boolean {
  return status === 'PENDENTE';
}

export function podeExcluirPedido(status: StatusPedido): boolean {
  return status === 'PENDENTE';
}

export function determinarStatusFinanceiro(
  statusPagamento: 'CONFIRMADO' | 'ESTORNADO' | null
): StatusFinanceiro {
  if (statusPagamento === 'CONFIRMADO') return 'PAGO';
  if (statusPagamento === 'ESTORNADO') return 'ESTORNADO';
  return 'PENDENTE';
}

export function formatarNumeroExibicao(idPedido: number): string {
  return `Pedido #${String(idPedido).padStart(3, '0')}`;
}

export function validarValorPagamento(
  valorPagamento: number,
  valorTotal: number
): void {
  const pago = arredondarMoeda(valorPagamento);
  const total = arredondarMoeda(valorTotal);

  if (pago <= 0) {
    throw new Error('Valor do pagamento deve ser maior que zero.');
  }

  // Regra BeeFlux: pagamento único e integral por pedido. Sem pagamentos parciais.
  if (pago !== total) {
    throw new Error(
      `Pagamento parcial não é permitido. O valor informado (R$ ${pago.toFixed(2)}) deve ser exatamente igual ao total do pedido (R$ ${total.toFixed(2)}).`
    );
  }
}
