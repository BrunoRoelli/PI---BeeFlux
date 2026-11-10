import { Router } from 'express';
import * as controller from './agendamentos.controller';

const router = Router();

router.get('/', controller.listar);
router.get('/:id', controller.obterPorId);
router.put('/:id', controller.atualizar);
router.post('/:id/cancelar', controller.cancelar);

export default router;
