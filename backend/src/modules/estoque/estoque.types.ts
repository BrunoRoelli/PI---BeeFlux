export interface Estoque {
  id_estoque: number;
  id_produto: number;
  quantidade: number;
  estoque_minimo: number;
  data_atualizacao: Date;
}