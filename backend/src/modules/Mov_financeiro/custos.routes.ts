import { Router } from 'express';
import { custosController } from './custos.controller';

const router = Router();

router.get('/resumo', custosController.resumo);
router.get('/movimentacoes', custosController.movimentacoes);
router.get('/despesas', custosController.despesas);
router.post('/despesas', custosController.criarDespesa);
router.put('/despesas/:id', custosController.editarDespesa);
router.delete('/despesas/:id', custosController.excluirDespesa);
router.patch('/despesas/:id/pagar', custosController.pagarDespesa);

router.get('/retiradas', custosController.listarRetiradas);
router.post('/retiradas', custosController.criarRetirada);

export default router;
