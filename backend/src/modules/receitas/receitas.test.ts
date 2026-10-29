import { describe, it, expect } from 'vitest';
import { validarReceita, escalarIngredientes, sugerirPreco } from './receitas.regras';

const receitaValida = {
  id_produto_feito: 10,
  rendimento_receita: 20,
  tempo_preparo_minutos: 40,
  custos_fixos: 5,
  custo_mao_obra: 10,
  margem_lucro: 30,
  instrucoes: 'Misturar os secos, bater e assar.',
  ingredientes: [
    { id_ingrediente: 1, quantidade: 0.5 },
    { id_ingrediente: 2, quantidade: 2.0 }
  ]
};

describe('Módulo de Receitas: regras e cálculos', () => {
  it('valida receita preenchida corretamente', () => {
    expect(() => validarReceita(receitaValida)).not.toThrow();
  });

  it('rejeita receita sem instruções ou com instruções vazias', () => {
    expect(() => validarReceita({ ...receitaValida, instrucoes: '   ' })).toThrow('Instruções são obrigatórias');
  });

  it('rejeita ingredientes duplicados na mesma receita', () => {
    expect(() =>
      validarReceita({
        ...receitaValida,
        ingredientes: [
          { id_ingrediente: 1, quantidade: 0.5 },
          { id_ingrediente: 1, quantidade: 1.0 }
        ]
      })
    ).toThrow('Ingrediente repetido');
  });

  it('escala ingredientes proporcionalmente ao rendimento', () => {
    const escalado = escalarIngredientes(receitaValida.ingredientes, 20, 40);
    expect(escalado[0]?.quantidade).toBe(1.0);
    expect(escalado[1]?.quantidade).toBe(4.0);
  });

  it('calcula preço sugerido com margem e custos fixos/mão de obra', () => {
    const res = sugerirPreco(25, 5, 10, 30, 20);
    expect(res.custo_total).toBe(40);
    expect(res.custo_unitario).toBe(2);
    expect(res.preco_sugerido).toBe(2.6);
  });
});
