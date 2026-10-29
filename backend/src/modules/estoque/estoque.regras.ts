import type { TipoMovimentacao, UsoLote } from './estoque.types';

export function arredondar(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function inteiroPositivo(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
}

export function paginacaoSegura(pagina?: unknown, limite?: unknown): { pagina: number; limite: number; offset: number } {
  const p = Number(pagina);
  const l = Number(limite);
  const pag = Number.isInteger(p) && p > 0 ? p : 1;
  const lim = Number.isInteger(l) && l > 0 ? Math.min(l, 100) : 50;
  return { pagina: pag, limite: lim, offset: (pag - 1) * lim };
}

export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(Date.UTC(ano!, mes! - 1, dia!));
  return d.getUTCFullYear() === ano && d.getUTCMonth() + 1 === mes && d.getUTCDate() === dia;
}

export function validarQuantidade(n: number, permitirNegativo = false): void {
  const invalido = permitirNegativo ? n === 0 : n <= 0;
  if (
    typeof n !== 'number' ||
    !Number.isFinite(n) ||
    invalido ||
    Math.abs(n * 1000 - Math.round(n * 1000)) > 1e-7
  ) {
    throw new Error(
      permitirNegativo
        ? 'Quantidade inválida: utilize até 3 casas decimais e valor diferente de zero.'
        : 'Quantidade inválida: utilize até 3 casas decimais e valor maior que zero.'
    );
  }
}

export function validarPrecoEEstoqueMinimo(preco?: number, estoqueMinimo?: number): void {
  if (preco !== undefined) {
    if (typeof preco !== 'number' || !Number.isFinite(preco) || preco < 0) {
      throw new Error('Preço do produto não pode ser negativo ou inválido.');
    }
  }
  if (estoqueMinimo !== undefined) {
    if (typeof estoqueMinimo !== 'number' || !Number.isFinite(estoqueMinimo) || estoqueMinimo < 0) {
      throw new Error('Estoque mínimo não pode ser negativo ou inválido.');
    }
  }
}

export function calcularDelta(tipo: TipoMovimentacao, quantidade: number): number {
  if (tipo === 'AJUSTE') return quantidade;
  return tipo === 'ENTRADA' ? Math.abs(quantidade) : -Math.abs(quantidade);
}

export function calcularNovoSaldo(atual: number, inicial: number, delta: number): number {
  const novo = arredondar(atual + delta);
  if (novo < 0) {
    throw new Error('Estoque insuficiente neste lote.');
  }
  if (novo > inicial) {
    throw new Error('A movimentação ultrapassa a capacidade inicial deste lote.');
  }
  return novo;
}

export interface LoteConsumivel {
  id_lote: number;
  quantidade_atual: number;
  vencido: boolean;
}

export interface PlanoConsumo {
  usos: UsoLote[];
  faltante: number;
  usouVencido: boolean;
}

export function planejarConsumo(
  lotes: LoteConsumivel[],
  quantidade: number,
  confirmarVencidos: boolean
): PlanoConsumo {
  const validos = lotes.filter((l) => !l.vencido && l.quantidade_atual > 0);
  const vencidos = lotes.filter((l) => l.vencido && l.quantidade_atual > 0);
  const usos: UsoLote[] = [];
  let restante = arredondar(quantidade);

  const consumir = (lista: LoteConsumivel[]) => {
    for (const lote of lista) {
      if (restante <= 0) break;
      const usar = Math.min(restante, lote.quantidade_atual);
      usos.push({
        id_lote: lote.id_lote,
        quantidade: usar,
        saldo_restante: arredondar(lote.quantidade_atual - usar)
      });
      restante = arredondar(restante - usar);
    }
  };

  consumir(validos);

  if (restante > 0 && vencidos.length > 0 && !confirmarVencidos) {
    const totalVencido = arredondar(vencidos.reduce((s, l) => s + l.quantidade_atual, 0));
    throw new Error(
      `Estoque em lotes válidos insuficiente. Há ${totalVencido} em lotes vencidos disponíveis. Confirme o uso de lotes vencidos se desejar utilizá-los.`
    );
  }

  const itensAntes = usos.length;
  if (restante > 0 && confirmarVencidos) {
    consumir(vencidos);
  }

  return {
    usos,
    faltante: restante,
    usouVencido: usos.length > itensAntes
  };
}

export function saldoDisponivel(saldoValido: number, reservado: number): number {
  if (!Number.isFinite(saldoValido) || !Number.isFinite(reservado) || reservado < 0) {
    throw new Error('Saldo ou reserva inválida.');
  }
  return arredondar(Math.max(0, saldoValido - reservado));
}
