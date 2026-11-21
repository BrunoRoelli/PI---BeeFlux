import type { Request, Response, NextFunction } from 'express';
import * as service from './custos.service';
import type { AtualizarDespesaInput, CategoriaDespesa, FiltroFinanceiro, StatusDespesa, TipoMovimentacaoFinanceira } from './custos.types';

export const custosController = {
  async resumo(req: Request, res: Response, next: NextFunction) {
    try {
      const { de, ate } = req.query;
      res.json(await service.consultarResumo(typeof de === 'string' ? de : undefined, typeof ate === 'string' ? ate : undefined));
    } catch (err) { next(err); }
  },

async movimentacoes(req: Request, res: Response, next: NextFunction) {
    try {
      const { de, ate, tipo, categoria } = req.query;
      
      const filtro: FiltroFinanceiro = {};
      if (typeof de === 'string') filtro.de = de;
      if (typeof ate === 'string') filtro.ate = ate;
      if (typeof tipo === 'string') filtro.tipo = tipo as TipoMovimentacaoFinanceira;
      if (typeof categoria === 'string') filtro.categoria = categoria;

      res.json(await service.consultarMovimentacoes(filtro));
    } catch (err) { next(err); }
  },

  async despesas(req: Request, res: Response, next: NextFunction) {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status as StatusDespesa : undefined;
      res.json(await service.consultarDespesas(status));
    } catch (err) { next(err); }
  },

  async criarDespesa(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body ?? {};
      const result = await service.cadastrarDespesa({
        descricao_despesa: body.descricao_despesa,
        categoria_despesa: body.categoria_despesa as CategoriaDespesa,
        valor_despesa: Number(body.valor_despesa),
        data_despesa: body.data_despesa,
        data_vencimento: body.data_vencimento ?? null,
        observacao: body.observacao ?? null
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  },

async editarDespesa(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      
      const payload: AtualizarDespesaInput = {};
      if (body.descricao_despesa !== undefined) payload.descricao_despesa = body.descricao_despesa;
      if (body.categoria_despesa !== undefined) payload.categoria_despesa = body.categoria_despesa;
      if (body.valor_despesa !== undefined) payload.valor_despesa = Number(body.valor_despesa);
      if (body.data_despesa !== undefined) payload.data_despesa = body.data_despesa;
      if (body.data_vencimento !== undefined) payload.data_vencimento = body.data_vencimento;
      if (body.observacao !== undefined) payload.observacao = body.observacao;

      const result = await service.editarDespesa(id, payload);
      res.json(result);
    } catch (err) { next(err); }
  },

  async excluirDespesa(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      res.json(await service.removerDespesa(id));
    } catch (err) { next(err); }
  },

  async pagarDespesa(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.confirmarPagamentoDespesa(Number(req.params.id)));
    } catch (err) { next(err); }
  },

  async criarRetirada(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body ?? {};
      const idUser = Number(body.id_user);
      
      if (!idUser || isNaN(idUser)) {
        return res.status(400).json({ mensagem: 'ID do usuário é obrigatório e deve ser válido para registrar retiradas.' });
      }

      const result = await service.cadastrarRetirada({
        id_user: idUser,
        valor_retirada: Number(body.valor_retirada),
        descricao_retirada: body.descricao_retirada ?? null,
        data_retirada: body.data_retirada
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  },

  async listarRetiradas(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.consultarRetiradas());
    } catch (err) { next(err); }
  }
};
