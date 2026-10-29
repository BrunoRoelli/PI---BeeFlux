import type { IngredienteReceita, SalvarReceita } from './receitas.types';

export const arredondar = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export function validarReceita(d: unknown): asserts d is SalvarReceita {
  if (!d || typeof d !== 'object') throw new Error('Dados da receita inválidos.');
  const r = d as Record<string, unknown>;

  if (!Number.isSafeInteger(r.id_produto_feito) || Number(r.id_produto_feito) <= 0) {
    throw new Error('Produto FEITO inválido.');
  }

  for (const campo of ['rendimento_receita', 'tempo_preparo_minutos', 'custos_fixos', 'custo_mao_obra', 'margem_lucro']) {
    const n = r[campo];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
      throw new Error(`${campo} inválido.`);
    }
  }

  if (Number(r.rendimento_receita) <= 0 || Number(r.tempo_preparo_minutos) <= 0) {
    throw new Error('Rendimento e tempo de preparo devem ser maiores que zero.');
  }

  if (typeof r.instrucoes !== 'string' || !r.instrucoes.trim()) {
    throw new Error('Instruções são obrigatórias.');
  }

  if (!Array.isArray(r.ingredientes) || r.ingredientes.length === 0) {
    throw new Error('Informe pelo menos um ingrediente.');
  }

  const ids = new Set<number>();
  for (const item of r.ingredientes as IngredienteReceita[]) {
    if (
      !Number.isSafeInteger(item.id_ingrediente) ||
      item.id_ingrediente <= 0 ||
      typeof item.quantidade !== 'number' ||
      !Number.isFinite(item.quantidade) ||
      item.quantidade <= 0 ||
      Math.abs(item.quantidade * 1000 - Math.round(item.quantidade * 1000)) > 1e-7
    ) {
      throw new Error('Ingrediente ou quantidade inválidos (máximo de 3 casas decimais e maior que zero).');
    }

    if (ids.has(item.id_ingrediente)) {
      throw new Error('Ingrediente repetido na mesma receita.');
    }
    ids.add(item.id_ingrediente);
  }
}

export function escalarIngredientes(
  ingredientes: Array<{ id_ingrediente: number; quantidade: number }>,
  rendimento: number,
  quantidade: number
) {
  if (!Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(rendimento) || rendimento <= 0) {
    throw new Error('Rendimento ou quantidade inválida.');
  }
  return ingredientes.map((i) => ({
    id_ingrediente: i.id_ingrediente,
    quantidade: arredondar((i.quantidade * quantidade) / rendimento)
  }));
}

export function sugerirPreco(
  custoIngredientes: number,
  fixos: number,
  maoObra: number,
  margemPercentual: number,
  rendimento: number
) {
  if ([custoIngredientes, fixos, maoObra, margemPercentual].some((n) => !Number.isFinite(n) || n < 0) || rendimento <= 0) {
    throw new Error('Valores de custo inválidos.');
  }
  const total = custoIngredientes + fixos + maoObra;
  return {
    custo_total: arredondar(total),
    custo_unitario: arredondar(total / rendimento),
    preco_sugerido: arredondar((total * (1 + margemPercentual / 100)) / rendimento)
  };
}
