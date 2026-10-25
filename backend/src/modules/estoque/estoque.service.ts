import * as repo from './estoque.repository';
import type { CadastroProduto, MovimentoEstoque, NovoLote, TipoProduto } from './estoque.types';

function validarQuantidade(n: number, permitirNegativo = false) {
  if (!Number.isFinite(n) || (!permitirNegativo && n <= 0) || (permitirNegativo && n === 0)
      || Math.round(n * 1000) !== n * 1000) {
    throw new Error('Quantidade inválida: use até 3 casas decimais e valor diferente de zero.');
  }
}
function inteiroPositivo(n: number) { return Number.isSafeInteger(n) && n > 0; }

export async function listar(tipo?: TipoProduto) {
  if (tipo && !['INGREDIENTE', 'REVENDA', 'FEITO'].includes(tipo)) throw new Error('Tipo inválido.');
  return repo.listarEstoque(tipo);
}
export async function lotes(idProduto: number) {
  if (!inteiroPositivo(idProduto)) throw new Error('Produto inválido.');
  return repo.listarLotes(idProduto);
}
export async function cadastrar(d: CadastroProduto) {
  if (!d || !d.nome_produto?.trim() || !d.unidade_medida?.trim()) throw new Error('Nome e unidade são obrigatórios.');
  if (!['INGREDIENTE', 'REVENDA', 'FEITO'].includes(d.tipo_produto)) throw new Error('Tipo inválido.');
  if (d.preco_produto !== undefined && (!Number.isFinite(d.preco_produto) || d.preco_produto < 0)) throw new Error('Preço inválido.');
  if (d.estoque_minimo !== undefined && (!Number.isFinite(d.estoque_minimo) || d.estoque_minimo < 0)) throw new Error('Estoque mínimo inválido.');
  return repo.cadastrarProduto({ ...d, nome_produto: d.nome_produto.trim(), unidade_medida: d.unidade_medida.trim() });
}

export async function criarLote(d: NovoLote) {
  if (!d || !inteiroPositivo(d.id_produto)) throw new Error('Produto inválido.');
  validarQuantidade(d.quantidade);
  if (d.data_validade && (!/^\d{4}-\d{2}-\d{2}$/.test(d.data_validade) ||
      Number.isNaN(Date.parse(d.data_validade)))) throw new Error('Validade inválida.');
  return repo.executarTransacao(async conn => {
    const p = await repo.buscarProduto(conn, d.id_produto);
    if (!p) throw new Error('Produto não encontrado.');
    // O SQL atual impede lotes FEITO (CHECK).
    if (p.tipo_produto === 'FEITO') throw new Error('O banco atual não permite lotes de produtos FEITOS.');
    const id_lote = await repo.inserirLote(conn, p, d);
    await repo.registrarMovimentacao(conn, {
      id_produto: p.id_produto, tipo_produto: p.tipo_produto, id_lote,
      tipo_movimentacao: 'ENTRADA', quantidade: d.quantidade, motivo: 'Cadastro de lote'
    });
    return { id_lote };
  });
}

export async function movimentar(d: MovimentoEstoque) {
  if (!d || !inteiroPositivo(d.id_lote)) throw new Error('Lote inválido.');
  if (!['ENTRADA', 'SAIDA', 'PERDA', 'AJUSTE'].includes(d.tipo_movimentacao)) throw new Error('Movimentação inválida.');
  validarQuantidade(d.quantidade, d.tipo_movimentacao === 'AJUSTE');
  if (['PERDA', 'AJUSTE'].includes(d.tipo_movimentacao) && !d.motivo?.trim()) throw new Error('Motivo obrigatório.');
  if (d.tipo_movimentacao === 'AJUSTE' && d.confirmado !== true) throw new Error('Confirme o ajuste manual.');
  if (d.id_user !== undefined && !inteiroPositivo(d.id_user)) throw new Error('Usuário inválido.');
  return repo.executarTransacao(async conn => {
    const lote = await repo.buscarLote(conn, d.id_lote);
    if (!lote) throw new Error('Lote não encontrado.');
    if (lote.tipo_produto === 'FEITO') throw new Error('O banco atual não suporta movimentação de FEITO.');
    if (lote.vencido && ['SAIDA', 'PERDA'].includes(d.tipo_movimentacao) &&
        d.confirmar_vencido !== true && d.tipo_movimentacao === 'SAIDA') {
      throw new Error('Lote vencido: confirme o consumo.');
    }
    const delta = d.tipo_movimentacao === 'AJUSTE' ? d.quantidade :
      d.tipo_movimentacao === 'ENTRADA' ? d.quantidade : -d.quantidade;
    const novo = Math.round((Number(lote.quantidade_atual) + delta) * 1000) / 1000;
    if (novo < 0) throw new Error('Estoque insuficiente neste lote.');
    // O SQL atual exige quantidade_atual <= quantidade_inicial.
    // Ao receber mais unidades, aumenta-se a capacidade historica do lote.
    if (delta > 0) {
      await conn.execute(
        'UPDATE lotes_estoque SET quantidade_inicial = quantidade_inicial + ? WHERE id_lote = ?',
        [delta, d.id_lote]);
    }
    await repo.atualizarLote(conn, d.id_lote, novo);

    const id_movimentacao = await repo.registrarMovimentacao(conn, {
        id_produto: lote.id_produto,
        tipo_produto: lote.tipo_produto,
        id_lote: d.id_lote,
        tipo_movimentacao: d.tipo_movimentacao,
        quantidade: delta,
    ...(d.motivo !== undefined && { motivo: d.motivo.trim() }),
    ...(d.id_user !== undefined && { id_user: d.id_user })
    });


    return { id_movimentacao, saldo_lote: novo };
  });
}
