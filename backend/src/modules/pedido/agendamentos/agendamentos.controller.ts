import type { Request, Response } from 'express';
import * as service from './agendamentos.service';
import * as regras from '../pedidos/pedidos.regras';
import type { TipoAtendimento } from '../pedidos/pedidos.types';

export async function listar(req: Request, res: Response) {
  try {
    const de = req.query.de;
    const ate = req.query.ate;
    const tipo = req.query.tipo_atendimento;

    if (de !== undefined && (typeof de !== 'string' || !regras.dataValidaFormato(de))) {
      return res.status(400).json({ mensagem: 'Filtro "de" inválido. Use o formato AAAA-MM-DD.' });
    }
    if (ate !== undefined && (typeof ate !== 'string' || !regras.dataValidaFormato(ate))) {
      return res.status(400).json({ mensagem: 'Filtro "ate" inválido. Use o formato AAAA-MM-DD.' });
    }
    if (typeof de === 'string' && typeof ate === 'string' && de > ate) {
      return res.status(400).json({ mensagem: 'A data inicial "de" não pode ser posterior à data final "ate".' });
    }
    if (tipo !== undefined && tipo !== 'RETIRADA' && tipo !== 'ENTREGA') {
      return res.status(400).json({ mensagem: 'Filtro tipo_atendimento deve ser RETIRADA ou ENTREGA.' });
    }

    const filtro = {
      de: de as string | undefined,
      ate: ate as string | undefined,
      tipo_atendimento: tipo as TipoAtendimento | undefined
    };
    const agendamentos = await service.listarAgendamentos(filtro);
    res.json(agendamentos);
  } catch (e: any) {
    res.status(400).json({ mensagem: e.message || 'Erro ao listar agendamentos.' });
  }
}

export async function obterPorId(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const agendamento = await service.obterAgendamentoPorId(id);
    res.json(agendamento);
  } catch (e: any) {
    res.status(404).json({ mensagem: e.message || 'Agendamento não encontrado.' });
  }
}

export async function atualizar(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const body = req.body ?? {};
    const idUser = Number(body.id_user);
    if (!Number.isSafeInteger(idUser) || idUser <= 0) {
      return res.status(400).json({ mensagem: 'Identificação do usuário (id_user) é obrigatória.' });
    }
    const resultado = await service.atualizarAgendamento(id, {
      ...body,
      id_user: idUser
    });
    res.json(resultado);
  } catch (e: any) {
    res.status(400).json({ mensagem: e.message || 'Erro ao atualizar agendamento.' });
  }
}

export async function cancelar(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const idUser = Number(req.body?.id_user);
    if (!Number.isSafeInteger(idUser) || idUser <= 0) {
      return res.status(400).json({ mensagem: 'Identificação do usuário (id_user) é obrigatória.' });
    }
    const resultado = await service.cancelarAgendamento(id, idUser);
    res.json(resultado);
  } catch (e: any) {
    res.status(400).json({ mensagem: e.message || 'Erro ao cancelar agendamento.' });
  }
}
