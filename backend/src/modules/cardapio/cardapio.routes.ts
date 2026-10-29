import { Router } from 'express';
import type { Request, Response } from 'express';
import * as service from './cardapio.service';
import type { TipoProdutoCardapio } from './cardapio.types';

const router = Router();

function erro(res: Response, e: unknown) {
  const msg = e instanceof Error ? e.message : 'Erro interno.';
  const conhecido = /inválid|obrigatóri|não encontrad|já possui|deve|INGREDIENTE/i.test(msg);
  return res
    .status(!conhecido ? 500 : /não encontrad/i.test(msg) ? 404 : 400)
    .json({ mensagem: conhecido ? msg : 'Erro interno no cardápio.' });
}

const id = (v: unknown) => Number(v);

// ===== ROTAS PÚBLICAS (Catálogo para Clientes) =====
router.get('/publico', async (_req, res) => {
  try {
    res.json(await service.listar(true));
  } catch (e) {
    erro(res, e);
  }
});

router.get('/publico/:id', async (req, res) => {
  try {
    const filtro = {
      id_categoria: req.query.id_categoria ? id(req.query.id_categoria) : undefined,
      tipo: req.query.tipo as TipoProdutoCardapio | undefined,
      apenas_disponiveis: req.query.apenas_disponiveis === 'true'
    };
    res.json(await service.obterDetalhes(id(req.params.id), true, filtro));
  } catch (e) {
    erro(res, e);
  }
});

// ===== ROTAS ADMINISTRATIVAS (Gestão do Cardápio) =====
router.get('/admin', async (_req, res) => {
  try {
    res.json(await service.listar(false));
  } catch (e) {
    erro(res, e);
  }
});

router.get('/admin/:id', async (req, res) => {
  try {
    res.json(await service.obterDetalhes(id(req.params.id), false));
  } catch (e) {
    erro(res, e);
  }
});

router.post('/admin', async (req, res) => {
  try {
    res.status(201).json(await service.criar(req.body));
  } catch (e) {
    erro(res, e);
  }
});

router.put('/admin/:id', async (req, res) => {
  try {
    res.json(await service.atualizar(id(req.params.id), req.body));
  } catch (e) {
    erro(res, e);
  }
});

router.put('/admin/:id/produtos', async (req, res) => {
  try {
    res.json(await service.vincularProduto(id(req.params.id), req.body));
  } catch (e) {
    erro(res, e);
  }
});

router.patch('/admin/:id/produtos/:id_produto/status', async (req, res) => {
  try {
    const ativo = req.body?.ativo !== false;
    res.json(await service.alternarStatusItem(id(req.params.id), id(req.params.id_produto), ativo));
  } catch (e) {
    erro(res, e);
  }
});

router.delete('/admin/:id/produtos/:id_produto', async (req, res) => {
  try {
    res.json(await service.desvincularProduto(id(req.params.id), id(req.params.id_produto)));
  } catch (e) {
    erro(res, e);
  }
});

export default router;
