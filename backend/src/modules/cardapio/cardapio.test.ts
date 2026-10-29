import { describe, it, expect } from 'vitest';
import {
  validarCabecalhoCardapio,
  validarItemVinculo,
  calcularStatusDisponibilidade
} from './cardapio.regras';

describe('Módulo de Cardápio: regras e validações', () => {
  it('valida cabeçalho de cardápio válido', () => {
    expect(() =>
      validarCabecalhoCardapio({
        nome_cardapio: 'Cardápio Principal',
        descricao_cardapio: 'Doces e Bebidas'
      })
    ).not.toThrow();
  });

  it('rejeita cardápio com nome vazio', () => {
    expect(() => validarCabecalhoCardapio({ nome_cardapio: '   ' })).toThrow(
      'Nome do cardápio é obrigatório'
    );
  });

  it('valida item de vínculo com preço e ordem', () => {
    expect(() =>
      validarItemVinculo({
        id_produto: 5,
        preco_cardapio: 12.5,
        disponivel: true,
        ordem_exibicao: 1
      })
    ).not.toThrow();
  });

  it('rejeita preço negativo no vínculo', () => {
    expect(() =>
      validarItemVinculo({
        id_produto: 5,
        preco_cardapio: -10
      })
    ).toThrow('Preço do cardápio não pode ser negativo');
  });

  it('calcula PRONTO_ENTREGA quando há saldo disponível', () => {
    const r = calcularStatusDisponibilidade('FEITO', 5, 0, true);
    expect(r.status).toBe('PRONTO_ENTREGA');
    expect(r.disponivelVenda).toBe(true);
  });

  it('calcula SOB_ENCOMENDA para FEITO sem saldo pronto mas com insumos na receita', () => {
    const r = calcularStatusDisponibilidade('FEITO', 0, 10, true);
    expect(r.status).toBe('SOB_ENCOMENDA');
    expect(r.disponivelVenda).toBe(true);
  });

  it('calcula INDISPONIVEL para REVENDA com estoque zerado', () => {
    const r = calcularStatusDisponibilidade('REVENDA', 0, 0, true);
    expect(r.status).toBe('INDISPONIVEL');
    expect(r.disponivelVenda).toBe(false);
  });

  it('calcula INDISPONIVEL quando o item está inativado no cardápio, mesmo com estoque', () => {
    const r = calcularStatusDisponibilidade('FEITO', 10, 20, false);
    expect(r.status).toBe('INDISPONIVEL');
    expect(r.disponivelVenda).toBe(false);
  });
});
