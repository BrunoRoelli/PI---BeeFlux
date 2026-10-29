import * as repo from './cardapio.repository';
import * as regras from './cardapio.regras';
import type {
  SalvarCardapio,
  ItemCardapioVinculo,
  CardapioCompleto,
  ItemCardapioDetalhe,
  FiltroCardapioPublico
} from './cardapio.types';

export async function listar(publico = false) {
  return await repo.listarCardapios(publico);
}

export async function obterDetalhes(idCardapio: number, publico = false, filtro?: FiltroCardapioPublico): Promise<CardapioCompleto> {
  if (!regras.inteiroPositivo(idCardapio)) throw new Error('ID do cardápio inválido.');

  const cabecalho = await repo.obterCardapioPorId(idCardapio, publico);
  if (!cabecalho) throw new Error('Cardápio não encontrado ou inativo.');

  return await repo.transacao(async (conn) => {
    const itensBrutos = await repo.buscarItensCardapioBrutos(idCardapio, publico);
    const idsProdutos = itensBrutos.map((i) => Number(i.id_produto));
    const idsFeitos = itensBrutos
      .filter((i) => i.tipo_produto === 'FEITO')
      .map((i) => Number(i.id_produto));

    // Comunicação preventiva transparente: Consulta Estoque e Receita
    const saldosProntos = await repo.buscarSaldosProntos(conn, idsProdutos);
    const capacidadesProducao = await repo.buscarCapacidadeProducaoFeitos(conn, idsFeitos);

    const produtosProcessados: ItemCardapioDetalhe[] = [];

    for (const r of itensBrutos) {
      const idProd = Number(r.id_produto);
      const tipo = r.tipo_produto as 'REVENDA' | 'FEITO';
      const precoPadrao = Number(r.preco_produto);
      const precoCardapio = r.preco_cardapio != null ? Number(r.preco_cardapio) : null;
      const precoVenda = precoCardapio ?? precoPadrao;
      const ativoCardapio = Boolean(r.ativo_cardapio);

      const saldoPronto = saldosProntos.get(idProd) ?? 0;
      const capacidadeProd = capacidadesProducao.get(idProd) ?? 0;

      const { status, disponivelVenda } = regras.calcularStatusDisponibilidade(
        tipo,
        saldoPronto,
        capacidadeProd,
        ativoCardapio
      );

      // Filtros opcionais no catálogo público
      if (publico) {
        if (filtro?.id_categoria && Number(r.id_categoria) !== filtro.id_categoria) continue;
        if (filtro?.tipo && tipo !== filtro.tipo) continue;
        if (filtro?.apenas_disponiveis && !disponivelVenda) continue;
      }

      produtosProcessados.push({
        id_produto: idProd,
        nome_produto: String(r.nome_produto),
        descricao_produto: r.descricao_produto ? String(r.descricao_produto) : null,
        marca: r.marca ? String(r.marca) : null,
        tipo_produto: tipo,
        id_categoria: r.id_categoria ? Number(r.id_categoria) : null,
        nome_categoria: r.nome_categoria ? String(r.nome_categoria) : null,
        preco_padrao: precoPadrao,
        preco_cardapio: precoCardapio,
        preco_venda: precoVenda,
        ativo_cardapio: ativoCardapio,
        ordem_exibicao: Number(r.ordem_exibicao),
        status_disponibilidade: status,
        disponivel_para_venda: disponivelVenda,
        saldo_pronto: saldoPronto,
        capacidade_producao_estimada: capacidadeProd
      });
    }

    return {
      ...cabecalho,
      produtos: produtosProcessados
    };
  });
}

export async function criar(d: unknown) {
  regras.validarCabecalhoCardapio(d);
  const idCriado = await repo.criarCardapio(d);
  return { id_cardapio: idCriado, mensagem: 'Cardápio criado com sucesso.' };
}

export async function atualizar(idCardapio: number, d: unknown) {
  if (!regras.inteiroPositivo(idCardapio)) throw new Error('ID do cardápio inválido.');
  regras.validarCabecalhoCardapio(d);
  const ok = await repo.atualizarCardapio(idCardapio, d);
  if (!ok) throw new Error('Cardápio não encontrado.');
  return { id_cardapio: idCardapio, mensagem: 'Cardápio atualizado com sucesso.' };
}

export async function vincularProduto(idCardapio: number, d: unknown) {
  if (!regras.inteiroPositivo(idCardapio)) throw new Error('ID do cardápio inválido.');
  regras.validarItemVinculo(d);

  return await repo.transacao(async (conn) => {
    const cardapio = await repo.obterCardapioPorId(idCardapio);
    if (!cardapio) throw new Error('Cardápio não encontrado.');

    const prod = await repo.buscarProdutoBase(conn, d.id_produto);
    if (!prod || !prod.ativo) {
      throw new Error('Produto não encontrado ou inativo.');
    }

    if (prod.tipo_produto === 'INGREDIENTE') {
      throw new Error('Produtos do tipo INGREDIENTE não podem ser adicionados ao cardápio.');
    }

    await repo.vincularProduto(conn, idCardapio, d);
    return {
      id_cardapio: idCardapio,
      id_produto: d.id_produto,
      mensagem: 'Produto vinculado ao cardápio com sucesso.'
    };
  });
}

export async function desvincularProduto(idCardapio: number, idProduto: number) {
  if (!regras.inteiroPositivo(idCardapio) || !regras.inteiroPositivo(idProduto)) {
    throw new Error('ID do cardápio ou produto inválido.');
  }
  const ok = await repo.desvincularProduto(idCardapio, idProduto);
  if (!ok) throw new Error('Vínculo entre cardápio e produto não encontrado.');
  return { mensagem: 'Produto removido do cardápio com sucesso.' };
}

export async function alternarStatusItem(idCardapio: number, idProduto: number, ativo: boolean) {
  if (!regras.inteiroPositivo(idCardapio) || !regras.inteiroPositivo(idProduto)) {
    throw new Error('ID do cardápio ou produto inválido.');
  }
  const ok = await repo.alternarDisponibilidadeItem(idCardapio, idProduto, ativo);
  if (!ok) throw new Error('Item do cardápio não encontrado.');
  return {
    id_cardapio: idCardapio,
    id_produto: idProduto,
    ativo,
    mensagem: ativo ? 'Produto ativado no cardápio.' : 'Produto desativado no cardápio.'
  };
}
