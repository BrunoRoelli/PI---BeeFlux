import { Router } from 'express';
import * as controller from './pedidos.controller';

const router = Router();

// Consultas
router.get('/', controller.listar);
router.get('/:id', controller.obterPorId);

// Criação
router.post('/', controller.criarPedido);

// Alteração de itens e exclusão (Permitido enquanto PENDENTE)
router.put('/:id/itens', controller.atualizarItens);
router.delete('/:id', controller.excluirPedidoPendente);

// Pagamento (liquidação única integral)
router.post('/:id/pagamentos', controller.registrarPagamento);

// Transições de status operacional e cancelamento
router.patch('/:id/status', controller.atualizarStatus);
router.post('/:id/cancelar', controller.cancelarPedido);

export default router;
