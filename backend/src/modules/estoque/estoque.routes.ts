import { Router } from 'express';
import type { Request, Response } from 'express';
import * as service from './estoque.service';
import type { TipoProduto, TipoMovimentacao, FiltroMovimentacao } from './estoque.types';

const router = Router();

interface MysqlError extends Error {
  code?: string;
  errno?: number;
}

function erro(res: Response, e: unknown) {
  const err = e as MysqlError;
  const mensagem = err?.message || 'Erro interno.';

  if (err?.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        return res.status(409).json({ mensagem: 'Registro duplicado já existente no sistema.' });
      case 'ER_ROW_IS_REFERENCED_2':
      case 'ER_NO_REFERENCED_ROW_2':
        return res.status(400).json({ mensagem: 'Violação de integridade referencial: chave relacionada inválida.' });
      case 'ER_CHECK_CONSTRAINT_VIOLATED':
        return res.status(400).json({ mensagem: 'Valor não atende às restrições de validação do banco de dados.' });
      case 'ER_DATA_TOO_LONG':
        return res.status(400).json({ mensagem: 'Tamanho de dado informado ultrapassa o limite permitido.' });
      case 'ER_LOCK_WAIT_TIMEOUT':
      case 'ER_LOCK_DEADLOCK':
        return res.status(503).json({ mensagem: 'Recurso temporariamente indisponível devido a concorrência. Tente novamente.' });
      default:
        console.error(`[MySQL Error: ${err.code}]`, err);
        return res.status(500).json({ mensagem: 'Erro interno ao processar operação no banco de dados.' });
    }
  }

  if (/não encontrad/i.test(mensagem)) {
    return res.status(404).json({ mensagem });
  }

  return res.status(400).json({ mensagem });
}

const id = (valor: unknown) => Number(valor);
const texto = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
const numero = (v: unknown) => {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function filtroMovimentacao(req: Request, idProduto?: number): FiltroMovimentacao {
  return {
    id_produto: idProduto ?? numero(req.query.id_produto),
    tipo: texto(req.query.tipo) as TipoMovimentacao | undefined,
    de: texto(req.query.de),
    ate: texto(req.query.ate),
    limite: numero(req.query.limite),
    pagina: numero(req.query.pagina)
  };
}

// ----- Consultas -----
router.get('/', async (req, res) => {
  try {
    res.json(await service.listar(texto(req.query.tipo) as TipoProduto | undefined));
  } catch (e) {
    erro(res, e);
  }
});

router.get('/necessidades', async (_req, res) => {
  try {
    res.json(await service.necessidadesCompra());
  } catch (e) {
    erro(res, e);
  }
});

router.get('/lotes/:id_produto', async (req, res) => {
  try {
    res.json(await service.lotes(id(req.params.id_produto)));
  } catch (e) {
    erro(res, e);
  }
});

router.get('/movimentacoes', async (req, res) => {
  try {
    res.json(await service.historico(filtroMovimentacao(req)));
  } catch (e) {
    erro(res, e);
  }
});

router.get('/movimentacoes/:id_produto', async (req, res) => {
  try {
    res.json(await service.historico(filtroMovimentacao(req, id(req.params.id_produto))));
  } catch (e) {
    erro(res, e);
  }
});

// ----- Produtos -----
router.get('/produtos/:id', async (req, res) => {
  try {
    res.json(await service.obterProduto(id(req.params.id)));
  } catch (e) {
    erro(res, e);
  }
});

router.post('/produtos', async (req, res) => {
  try {
    res.status(201).json(await service.cadastrar(req.body));
  } catch (e) {
    erro(res, e);
  }
});

router.put('/produtos/:id', async (req, res) => {
  try {
    res.json(await service.editarProduto(id(req.params.id), req.body));
  } catch (e) {
    erro(res, e);
  }
});

router.delete('/produtos/:id', async (req, res) => {
  try {
    res.json(await service.desativarProduto(id(req.params.id)));
  } catch (e) {
    erro(res, e);
  }
});

// ----- Lotes e Movimentações Manuais -----
router.post('/lotes', async (req, res) => {
  try {
    res.status(201).json(await service.criarLote(req.body));
  } catch (e) {
    erro(res, e);
  }
});

router.post('/movimentacoes', async (req, res) => {
  try {
    res.status(201).json(await service.movimentar(req.body));
  } catch (e) {
    erro(res, e);
  }
});

// ----- Reservas de Estoque -----
router.post('/pedidos/:id_pedido/reservar', async (req, res) => {
  try {
    res.status(201).json(
      await service.reservarEstoquePedido({
        id_pedido: id(req.params.id_pedido),
        id_produto: id(req.body?.id_produto),
        quantidade: Number(req.body?.quantidade)
      })
    );
  } catch (e) {
    erro(res, e);
  }
});

// ----- Produção e Baixa de Produtos FEITOS -----
router.post('/producao', async (req, res) => {
  try {
    res.status(201).json(await service.registrarProducaoFeito(req.body));
  } catch (e) {
    erro(res, e);
  }
});

router.get('/pedidos/:id_pedido/producoes', async (req, res) => {
  try {
    res.json(await service.producoesPedido(id(req.params.id_pedido)));
  } catch (e) {
    erro(res, e);
  }
});

router.post('/pedidos/:id_pedido/feitos/:id_produto/baixa', async (req, res) => {
  try {
    res.status(201).json(
      await service.baixarFeitoPedido({
        id_pedido: id(req.params.id_pedido),
        id_produto_feito: id(req.params.id_produto),
        quantidade: Number(req.body?.quantidade),
        id_user: req.body?.id_user ? id(req.body.id_user) : undefined
      })
    );
  } catch (e) {
    erro(res, e);
  }
});

// ----- Compras e Pedidos -----
router.post('/compras/:id_compra/receber', async (req, res) => {
  try {
    res.status(201).json(await service.receberCompra({ ...req.body, id_compra: id(req.params.id_compra) }));
  } catch (e) {
    erro(res, e);
  }
});

router.post('/pedidos/:id_pedido/baixa', async (req, res) => {
  try {
    const body = req.body ?? {};
    res.status(201).json(
      await service.baixarRevendaPedido(id(req.params.id_pedido), body.confirmar_vencidos === true, body.id_user ? id(body.id_user) : undefined)
    );
  } catch (e) {
    erro(res, e);
  }
});

router.post('/pedidos/:id_pedido/devolucao', async (req, res) => {
  try {
    res.json(await service.devolverPedido(id(req.params.id_pedido), req.body?.id_user ? id(req.body.id_user) : undefined));
  } catch (e) {
    erro(res, e);
  }
});

export default router;
