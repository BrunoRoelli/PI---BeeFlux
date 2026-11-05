import { Router } from 'express';
import { contatosController } from './contatos.controller';

const router = Router();
router.get('/clientes', contatosController.listarClientes);
router.post('/clientes', contatosController.criarCliente);
router.put('/clientes/:id', contatosController.atualizarCliente);
router.patch('/clientes/:id/status', contatosController.statusCliente);
router.get('/clientes/:id/historico', contatosController.historicoCliente);

router.get('/fornecedores', contatosController.listarFornecedores);
router.post('/fornecedores', contatosController.criarFornecedor);
router.put('/fornecedores/:id', contatosController.atualizarFornecedor);
router.patch('/fornecedores/:id/status', contatosController.statusFornecedor);
router.get('/fornecedores/:id/historico', contatosController.historicoFornecedor);

export default router;