import type { Request, Response, NextFunction } from 'express';
import { contatosService } from './contatos.service';

const idParam = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Identificador inválido.');
  return id;
};

export const contatosController = {
  async listarClientes(req: Request, res: Response, next: NextFunction) {
    try { res.json(await contatosService.listarClientes(String(req.query.busca ?? ''), String(req.query.status ?? 'ativos'))); }
    catch (e) { next(e); }
  },
  async criarCliente(req: Request, res: Response, next: NextFunction) {
    try { const id = await contatosService.salvarCliente(req.body); res.status(201).json({ id_cliente: id, mensagem: 'Cliente cadastrado.' }); }
    catch (e) { next(e); }
  },
  async atualizarCliente(req: Request, res: Response, next: NextFunction) {
    try { const id = idParam(req.params.id); await contatosService.salvarCliente(req.body, id); res.json({ mensagem: 'Cliente atualizado.' }); }
    catch (e) { next(e); }
  },
  async statusCliente(req: Request, res: Response, next: NextFunction) {
    try { await contatosService.statusCliente(idParam(req.params.id), Boolean(req.body.ativo)); res.json({ mensagem: 'Status do cliente atualizado.' }); }
    catch (e) { next(e); }
  },
  async historicoCliente(req: Request, res: Response, next: NextFunction) {
    try { res.json(await contatosService.historicoCliente(idParam(req.params.id))); }
    catch (e) { next(e); }
  },
  async listarFornecedores(req: Request, res: Response, next: NextFunction) {
    try { res.json(await contatosService.listarFornecedores(String(req.query.busca ?? ''), String(req.query.status ?? 'ativos'))); }
    catch (e) { next(e); }
  },
  async criarFornecedor(req: Request, res: Response, next: NextFunction) {
    try { const id = await contatosService.salvarFornecedor(req.body); res.status(201).json({ id_fornecedor: id, mensagem: 'Fornecedor cadastrado.' }); }
    catch (e) { next(e); }
  },
  async atualizarFornecedor(req: Request, res: Response, next: NextFunction) {
    try { await contatosService.salvarFornecedor(req.body, idParam(req.params.id)); res.json({ mensagem: 'Fornecedor atualizado.' }); }
    catch (e) { next(e); }
  },
  async statusFornecedor(req: Request, res: Response, next: NextFunction) {
    try { await contatosService.statusFornecedor(idParam(req.params.id), Boolean(req.body.ativo)); res.json({ mensagem: 'Status do fornecedor atualizado.' }); }
    catch (e) { next(e); }
  },
  async historicoFornecedor(req: Request, res: Response, next: NextFunction) {
    try { res.json(await contatosService.historicoFornecedor(idParam(req.params.id))); }
    catch (e) { next(e); }
  }
};