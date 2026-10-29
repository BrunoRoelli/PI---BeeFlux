import * as repo from './receitas.repository';
import { validarReceita, escalarIngredientes, sugerirPreco, arredondar } from './receitas.regras';
import type {
  SalvarReceita,
  VerificacaoDisponibilidadeProducao,
  StatusDisponibilidadeCardapio
} from './receitas.types';

const idValido = (id: number) => Number.isSafeInteger(id) && id > 0;

export const listar = repo.listar;

export async function obter(id: number) {
  if (!idValido(id)) throw new Error('ID inválido.');
  const resultado = await repo.transacao((conn) => repo.receita(conn, id));
  if (!resultado) throw new Error('Receita não encontrada.');
  return resultado;
}

export async function salvar(d: unknown, atualizar = false) {
  validarReceita(d);
  const dados: SalvarReceita = d;
  return repo.transacao(async (conn) => {
    const p = await repo.produto(conn, dados.id_produto_feito);
    if (!p || p.tipo_produto !== 'FEITO' || !p.ativo) {
      throw new Error('É obrigatório selecionar um produto FEITO ativo já cadastrado.');
    }
    const ids = dados.ingredientes.map((i) => i.id_ingrediente);
    const cadastrados = await repo.ingredientesCadastrados(conn, ids);
    if (cadastrados.length !== ids.length || cadastrados.some((i) => i.tipo_produto !== 'INGREDIENTE' || !i.ativo)) {
      throw new Error('Todos os ingredientes devem estar cadastrados e ativos como INGREDIENTE.');
    }
    const anterior = await repo.receita(conn, dados.id_produto_feito);
    if (atualizar && !anterior) throw new Error('Receita não encontrada.');
    if (!atualizar && anterior) throw new Error('Este produto já possui receita. Use a edição.');

    await repo.salvar(conn, dados, atualizar);
    return {
      id_produto_feito: dados.id_produto_feito,
      mensagem: atualizar ? 'Receita atualizada.' : 'Receita cadastrada com sucesso.'
    };
  });
}

export async function mudarStatus(id: number, status: 'ATIVA' | 'INATIVA') {
  if (!idValido(id) || !['ATIVA', 'INATIVA'].includes(status)) throw new Error('Dados inválidos.');
  return repo.transacao(async (conn) => {
    const afetadas = await repo.mudarStatus(conn, id, status);
    if (!afetadas) throw new Error('Receita não encontrada.');
    return { mensagem: `Receita alterada para ${status}.` };
  });
}

export async function simular(id: number, quantidade: number) {
  if (!idValido(id) || !Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Parâmetros de simulação inválidos.');
  }
  const r = await obter(id);
  const rendimento = Number(r.rendimento_receita);
  return {
    id_produto_feito: id,
    quantidade,
    ingredientes: escalarIngredientes(r.ingredientes, rendimento, quantidade)
  };
}

// Caminho Reverso: Estoque -> Receita (Consegue produzir X bolos?)
export async function verificarDisponibilidadeProducao(
  idProdutoFeito: number,
  quantidade: number
): Promise<VerificacaoDisponibilidadeProducao> {
  if (!idValido(idProdutoFeito) || !Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Produto e quantidade válidos são obrigatórios.');
  }

  return await repo.transacao(async (conn) => {
    const r = await repo.receita(conn, idProdutoFeito);
    if (!r || r.status_receita !== 'ATIVA') {
      return {
        id_produto_feito: idProdutoFeito,
        quantidade_solicitada: quantidade,
        possui_receita_ativa: false,
        viavel: false,
        ingredientes: []
      };
    }

    const idsIngredientes = r.ingredientes.map((i: { id_ingrediente: number }) => i.id_ingrediente);
    const saldos = await repo.saldosDisponiveisIngredientes(conn, idsIngredientes);
    const escalados = escalarIngredientes(r.ingredientes, Number(r.rendimento_receita), quantidade);

    let viavelGeral = true;
    const checagem = escalados.map((esc) => {
      const infoIng = r.ingredientes.find((i: { id_ingrediente: number }) => i.id_ingrediente === esc.id_ingrediente);
      const disponivel = saldos.get(esc.id_ingrediente) ?? 0;
      const atende = disponivel >= esc.quantidade;
      if (!atende) viavelGeral = false;

      return {
        id_ingrediente: esc.id_ingrediente,
        nome_produto: infoIng?.nome_produto ?? 'Ingrediente',
        unidade_medida: infoIng?.unidade_medida ?? 'un',
        quantidade_necessaria: esc.quantidade,
        quantidade_disponivel: disponivel,
        quantidade_faltante: atende ? 0 : arredondar(esc.quantidade - disponivel),
        atende
      };
    });

    return {
      id_produto_feito: idProdutoFeito,
      quantidade_solicitada: quantidade,
      possui_receita_ativa: true,
      viavel: viavelGeral,
      ingredientes: checagem
    };
  });
}

// Comunicação: Cardápio -> Receita -> Estoque (Disponibilidade para venda)
export async function verificarDisponibilidadeCardapio(
  idProduto: number
): Promise<StatusDisponibilidadeCardapio> {
  if (!idValido(idProduto)) throw new Error('ID do produto inválido.');

  return await repo.transacao(async (conn) => {
    const prod = await repo.produto(conn, idProduto);
    if (!prod || !prod.ativo) throw new Error('Produto não encontrado ou inativo.');

    if (prod.tipo_produto === 'REVENDA') {
      const saldos = await repo.saldosDisponiveisIngredientes(conn, [idProduto]);
      const saldo = saldos.get(idProduto) ?? 0;
      return {
        id_produto: idProduto,
        nome_produto: 'Produto Revenda',
        tipo_produto: 'REVENDA',
        disponivel: saldo > 0,
        status_atendimento: saldo > 0 ? 'PRONTO_ENTREGA' : 'INDISPONIVEL',
        saldo_pronto: saldo,
        capacidade_producao_estimada: 0
      };
    }

    if (prod.tipo_produto === 'FEITO') {
      const pronto = await repo.saldoFeitoPronto(conn, idProduto);
      const r = await repo.receita(conn, idProduto);

      let capacidadeProducao = 0;
      if (r && r.status_receita === 'ATIVA' && r.ingredientes.length > 0) {
        const ids = r.ingredientes.map((i: { id_ingrediente: number }) => i.id_ingrediente);
        const saldos = await repo.saldosDisponiveisIngredientes(conn, ids);
        const rendimento = Number(r.rendimento_receita);

        let maxLotes = Infinity;
        for (const ing of r.ingredientes) {
          const saldoDisp = saldos.get(ing.id_ingrediente) ?? 0;
          const lotesPossiveis = saldoDisp / ing.quantidade;
          if (lotesPossiveis < maxLotes) maxLotes = lotesPossiveis;
        }

        if (Number.isFinite(maxLotes) && maxLotes > 0) {
          capacidadeProducao = Math.floor(maxLotes * rendimento);
        }
      }

      const disponivel = pronto > 0 || capacidadeProducao > 0;
      let status: 'PRONTO_ENTREGA' | 'SOB_ENCOMENDA' | 'INDISPONIVEL' = 'INDISPONIVEL';

      if (pronto > 0) {
        status = 'PRONTO_ENTREGA';
      } else if (capacidadeProducao > 0) {
        status = 'SOB_ENCOMENDA';
      }

      return {
        id_produto: idProduto,
        nome_produto: 'Produto Feito',
        tipo_produto: 'FEITO',
        disponivel,
        status_atendimento: status,
        saldo_pronto: pronto,
        capacidade_producao_estimada: capacidadeProducao
      };
    }

    throw new Error('Tipo de produto não comercializável no cardápio.');
  });
}

export async function precoSugerido(
  id: number,
  custosUnitarios?: Array<{ id_ingrediente: number; custo_por_unidade: number }>
) {
  const r = await obter(id);
  let mapa = new Map<number, number>();

  if (Array.isArray(custosUnitarios) && custosUnitarios.length > 0) {
    mapa = new Map(custosUnitarios.map((x) => [x.id_ingrediente, x.custo_por_unidade]));
  } else {
    // Busca automática dos custos reais no banco de dados se não informado
    const ids = r.ingredientes.map((i: { id_ingrediente: number }) => i.id_ingrediente);
    mapa = await repo.transacao((conn) => repo.custosRecentesIngredientes(conn, ids));
  }

  let custo = 0;
  const semCusto: number[] = [];

  for (const ing of r.ingredientes) {
    const unitario = mapa.get(ing.id_ingrediente);
    if (typeof unitario !== 'number' || !Number.isFinite(unitario) || unitario < 0) {
      semCusto.push(ing.id_ingrediente);
      continue;
    }
    custo += ing.quantidade * unitario;
  }

  return {
    custo_ingredientes: arredondar(custo),
    ingredientes_sem_custo: semCusto,
    ...sugerirPreco(
      custo,
      Number(r.custos_fixos),
      Number(r.custo_mao_obra),
      Number(r.margem_lucro),
      Number(r.rendimento_receita)
    )
  };
}
