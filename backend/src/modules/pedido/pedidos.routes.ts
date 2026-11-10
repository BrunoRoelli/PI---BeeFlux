import { Router } from 'express';
import * as controller from './pedidos.controller';

const router = Router();

router.get('/', controller.listar);
router.get('/:id', controller.obterPorId);
router.post('/', controller.criarPedido);
router.put('/:id/itens', controller.atualizarItens);
router.delete('/:id', controller.excluirPedidoPendente);
router.post('/:id/pagamentos', controller.registrarPagamento);
router.patch('/:id/status', controller.atualizarStatus);
router.post('/:id/cancelar', controller.cancelarPedido);

export default router;
