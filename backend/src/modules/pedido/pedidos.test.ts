import { describe, it, expect } from 'vitest';
import * as regras from './pedidos.regras';
import * as validators from './pedidos.validators';

describe('Regras de Negócio de Pedidos (pedidos.regras)', () => {
  it('deve calcular corretamente totais com produtos e taxa de entrega', () => {
    const itens = [
      { quantidade: 2, preco_unitario: 15.5 },
      { quantidade: 3, preco_unitario: 10.0 }
    ];
    const taxa = 7.5;
    const res = regras.calcularTotaisPedido(itens, taxa);

    expect(res.valorItens).toBe(61.0);
    expect(res.valorTotal).toBe(68.5);
  });

  it('deve validar transição de status permitida', () => {
    expect(() => regras.validarTransicaoStatus('PENDENTE', 'CONFIRMADO')).not.toThrow();
    expect(() => regras.validarTransicaoStatus('CONFIRMADO', 'EM_PREPARACAO')).not.toThrow();
    expect(() => regras.validarTransicaoStatus('EM_PREPARACAO', 'PRONTO')).not.toThrow();
    expect(() => regras.validarTransicaoStatus('PRONTO', 'CONCLUIDO')).not.toThrow();
    expect(() => regras.validarTransicaoStatus('CONFIRMADO', 'CANCELADO')).not.toThrow();
  });

  it('deve rejeitar transições ilegais', () => {
    expect(() => regras.validarTransicaoStatus('CONCLUIDO', 'PENDENTE')).toThrow();
    expect(() => regras.validarTransicaoStatus('CANCELADO', 'CONFIRMADO')).toThrow();
    expect(() => regras.validarTransicaoStatus('PENDENTE', 'CONCLUIDO')).toThrow();
  });

  it('deve exigir pagamento integral e recusar pagamentos parciais', () => {
    expect(() => regras.validarValorPagamento(100, 100)).not.toThrow();
    expect(() => regras.validarValorPagamento(50, 100)).toThrow(/pagamento parcial não é permitido/i);
    expect(() => regras.validarValorPagamento(0, 100)).toThrow(/maior que zero/i);
  });

  it('deve validar datas no formato AAAA-MM-DD', () => {
    expect(regras.dataValidaFormato('2026-05-15')).toBe(true);
    expect(regras.dataValidaFormato('2026-02-30')).toBe(false);
    expect(regras.dataValidaFormato('texto-qualquer')).toBe(false);
  });
});

describe('Validadores de Pedidos (pedidos.validators)', () => {
  it('deve rejeitar agendamento em pedido IMEDIATO', () => {
    expect(() =>
      validators.validarCriarPedido({
        tipo_pedido: 'IMEDIATO',
        id_user: 1,
        itens: [{ id_produto: 1, quantidade: 2 }],
        agendamento: {
          tipo_atendimento: 'RETIRADA',
          data_hora_agendada: '2026-05-15 14:00:00'
        }
      })
    ).toThrow(/não aceitam dados de agendamento/i);
  });

  it('deve rejeitar taxa de entrega em atendimento por RETIRADA', () => {
    expect(() =>
      validators.validarCriarPedido({
        tipo_pedido: 'AGENDADO',
        id_cliente: 1,
        id_user: 1,
        taxa_entrega: 10.0,
        itens: [{ id_produto: 1, quantidade: 2 }],
        agendamento: {
          tipo_atendimento: 'RETIRADA',
          data_hora_agendada: '2026-05-15 14:00:00'
        }
      })
    ).toThrow(/taxa de entrega deve ser zero quando o atendimento for RETIRADA/i);
  });

  it('deve exigir endereço em atendimento por ENTREGA', () => {
    expect(() =>
      validators.validarCriarPedido({
        tipo_pedido: 'AGENDADO',
        id_cliente: 1,
        id_user: 1,
        taxa_entrega: 10.0,
        itens: [{ id_produto: 1, quantidade: 2 }],
        agendamento: {
          tipo_atendimento: 'ENTREGA',
          data_hora_agendada: '2026-05-15 14:00:00',
          endereco_entrega: ''
        }
      })
    ).toThrow(/endereço de entrega é obrigatório/i);
  });

  it('deve rejeitar id_user ausente ou inválido', () => {
    expect(() =>
      validators.validarCriarPedido({
        tipo_pedido: 'IMEDIATO',
        itens: [{ id_produto: 1, quantidade: 2 }]
      })
    ).toThrow(/identificação do usuário/i);
  });

  it('deve rejeitar filtros de data ou status inválidos', () => {
    expect(() => validators.validarFiltroPedidos({ status: 'STATUS_INEXISTENTE' })).toThrow(/filtro de status inválido/i);
    expect(() => validators.validarFiltroPedidos({ de: 'data-invalida' })).toThrow(/formato esperado: AAAA-MM-DD/i);
  });
});
