import { Router } from 'express';
import * as service from './estoque.service';
import type { TipoProduto } from './estoque.types';

const router = Router();
function erro(res: import('express').Response, e: unknown) {
  const mensagem = e instanceof Error ? e.message : 'Erro interno.';
  const interno = !(e instanceof Error) || /^(Duplicate entry|Cannot add or update|Table |Unknown column)/.test(mensagem);
  return res.status(interno ? 500 : 400).json({ mensagem: interno ? 'Erro no banco de dados.' : mensagem });
}

router.get('/', async (req, res) => {
  try { res.json(await service.listar(req.query.tipo as TipoProduto | undefined)); }
  catch (e) { erro(res, e); }
});
router.get('/lotes/:id_produto', async (req, res) => {
  try { res.json(await service.lotes(Number(req.params.id_produto))); }
  catch (e) { erro(res, e); }
});
router.post('/produtos', async (req, res) => {
  try { res.status(201).json(await service.cadastrar(req.body)); }
  catch (e) { erro(res, e); }
});
router.post('/lotes', async (req, res) => {
  try { res.status(201).json(await service.criarLote(req.body)); }
  catch (e) { erro(res, e); }
});
router.post('/movimentacoes', async (req, res) => {
  try { res.status(201).json(await service.movimentar(req.body)); }
  catch (e) { erro(res, e); }
});
export default router;
