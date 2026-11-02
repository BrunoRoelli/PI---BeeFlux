import type { Request, Response } from 'express';
import * as service from './pedidos.service';
import * as validators from './pedidos.validators';

interface MysqlError extends Error {
  code?: string;
  errno?: number;
}

function tratarErro(res: Response, e: unknown) {
  const err = e as MysqlError;
  const mensagem = err?.message || 'Erro interno do servidor.';

  if (err?.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        return res.status(409).json({
          mensagem: 'Conflito de dados: este pedido já possui pagamento ou registro associado.'
        });
      case 'ER_ROW_IS_REFERENCED_2':
      case 'ER_NO_REFERENCED_ROW_2':
        return res.status(400).json({
          mensagem: 'Violação de integridade referencial: entidade relacionada não existe.'
        });
      case 'ER_CHECK_CONSTRAINT_VIOLATED':
        return res.status(400).json({
          mensagem: 'Restrição de validação violada: verifique se os campos atendem às regras do sistema.'
        });
      case 'ER_LOCK_WAIT_TIMEOUT':
      case 'ER_LOCK_DEADLOCK':
        return res.status(503).json({
          mensagem: 'Recurso temporariamente ocupado por outra operação concorrente. Tente novamente.'
        });
      default:
        console.error(`[MySQL Error: ${err.code}]`, err);
        return res.status(500).json({ mensagem: 'Erro interno ao processar operação no banco.' });
    }
  }

  if (/não encontrad/i.test(mensagem)) {
    return res.status(404).json({ mensagem });
  }

  return res.status(400).json({ mensagem });
}

export async function listar(req: Request, res: Response) {
  try {
    const filtro = validators.validarFiltroPedidos(req.query as Record<string, unknown>);
    const pedidos = await service.listar(filtro);
    res.json(pedidos);
  } catch (e) {
    tratarErro(res, e);
  }
}

export async function obterPorId(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const pedido = await service.obterPorId(id);
    res.json(pedido);
  } catch (e) {
    tratarErro(res, e);
  }
}

export async function criarPedido(req: Request, res: Response) {
  try {
    const dados = validators.validarCriarPedido(req.body);
    const resultado = await service.criarPedido(dados);
    res.status(201).json(resultado);
  } catch (e) {
    tratarErro(res, e);
  }
}

export async function atualizarItens(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const dados = validators.validarAtualizarItens(req.body);
    const resultado = await service.atualizarItensPedido(id, dados);
    res.json(resultado);
  } catch (e) {
    tratarErro(res, e);
  }
}

export async function excluirPedidoPendente(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const idUser = Number(req.body?.id_user ?? req.query?.id_user);
    if (!idUser || isNaN(idUser)) {
      return res.status(400).json({ mensagem: 'Identificação do usuário (id_user) é obrigatória para excluir.' });
    }
    const resultado = await service.excluirPedidoPendente(id, idUser);
    res.json(resultado);
  } catch (e) {
    tratarErro(res, e);
  }
}

export async function registrarPagamento(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const dadosPagamento = validators.validarPagamento(req.body);
    if (!dadosPagamento) {
      return res.status(400).json({ mensagem: 'Dados do pagamento são obrigatórios.' });
    }
    const idUser = Number(req.body?.id_user);
    if (!idUser || isNaN(idUser)) {
      return res.status(400).json({ mensagem: 'Identificação do usuário (id_user) é obrigatória.' });
    }
    const resultado = await service.registrarPagamento(id, dadosPagamento, idUser);
    res.status(201).json(resultado);
  } catch (e) {
    tratarErro(res, e);
  }
}

export async function atualizarStatus(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const dados = validators.validarAtualizarStatus(req.body);
    const resultado = await service.atualizarStatus(id, dados);
    res.json(resultado);
  } catch (e) {
    tratarErro(res, e);
  }
}

export async function cancelarPedido(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo : undefined;
    const idUser = req.body?.id_user ? Number(req.body.id_user) : undefined;
    const resultado = await service.cancelarPedido(id, motivo, idUser);
    res.json(resultado);
  } catch (e) {
    tratarErro(res, e);
  }
}
