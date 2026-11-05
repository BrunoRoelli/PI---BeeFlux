export type TipoContato = 'cliente' | 'fornecedor';

export interface ClienteInput {
  nome: string;
  telefone: string;
  email?: string | null;
  observacao?: string | null;
}

export interface FornecedorInput {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cnpj?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  complemento?: string | null;
}