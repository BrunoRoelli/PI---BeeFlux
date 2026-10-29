import { Router } from 'express';
import * as service from './receitas.service';

const router = Router();
const numeroId = (v: string) => Number(v);

function erro(res: import('express').Response, e: unknown) {
  const msg = e instanceof Error ? e.message : 'Erro interno.';
  const conhecido = /inválid|obrigatóri|não encontrad|já possui|devem|informe|ausente/i.test(msg);
  return res
    .status(!conhecido ? 500 : /não encontrad/i.test(msg) ? 404 : 400)
    .json({ mensagem: conhecido ? msg : 'Erro interno.' });
}

router.get('/', async (_req, res) => {
  try {
    res.json(await service.listar());
  } catch (e) {
    erro(res, e);
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await service.obter(numeroId(req.params.id as string)));
  } catch (e) {
    erro(res, e);
  }
});

router.get('/:id/simular', async (req, res) => {
  try {
    res.json(await service.simular(numeroId(req.params.id as string), Number(req.query.quantidade)));
  } catch (e) {
    erro(res, e);
  }
});

// Caminho Reverso: Estoque -> Receita (Consegue produzir?)
router.get('/:id/viabilidade-producao', async (req, res) => {
  try {
    const qtd = Number(req.query.quantidade ?? 1);
    res.json(await service.verificarDisponibilidadeProducao(numeroId(req.params.id as string), qtd));
  } catch (e) {
    erro(res, e);
  }
});

// Comunicação: Cardápio -> Receita -> Estoque (Disponibilidade para venda)
router.get('/:id/disponibilidade-cardapio', async (req, res) => {
  try {
    res.json(await service.verificarDisponibilidadeCardapio(numeroId(req.params.id as string)));
  } catch (e) {
    erro(res, e);
  }
});

router.post('/:id/preco-sugerido', async (req, res) => {
  try {
    res.json(await service.precoSugerido(numeroId(req.params.id as string), req.body?.custos_unitarios));
  } catch (e) {
    erro(res, e);
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await service.salvar(req.body));
  } catch (e) {
    erro(res, e);
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await service.salvar({ ...req.body, id_produto_feito: numeroId(req.params.id as string) }, true));
  } catch (e) {
    erro(res, e);
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    res.json(await service.mudarStatus(numeroId(req.params.id as string), req.body?.status));
  } catch (e) {
    erro(res, e);
  }
});

export default router;
