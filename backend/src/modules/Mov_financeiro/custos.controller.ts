import type { Request, Response, NextFunction } from 'express';
import * as service from './custos.service';
import type { CategoriaDespesa, StatusDespesa, TipoMovimentacaoFinanceira } from './custos.types';

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
      res.json(await service.consultarMovimentacoes({
        de: typeof de === 'string' ? de : undefined,
        ate: typeof ate === 'string' ? ate : undefined,
        tipo: typeof tipo === 'string' ? tipo as TipoMovimentacaoFinanceira : undefined,
        categoria: typeof categoria === 'string' ? categoria : undefined
      }));
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
      const result = await service.editarDespesa(id, {
        descricao_despesa: body.descricao_despesa,
        categoria_despesa: body.categoria_despesa,
        valor_despesa: body.valor_despesa !== undefined ? Number(body.valor_despesa) : undefined,
        data_despesa: body.data_despesa,
        data_vencimento: body.data_vencimento,
        observacao: body.observacao
      });
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
      const result = await service.cadastrarRetirada({
        id_user: Number(body.id_user) || 1,
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
