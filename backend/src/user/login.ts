export interface Usuario {
    id: number;
    nome: string;
    email: string;
    senha: string;
}

export interface LoginDTO {
    email: string;
    senha: string;
}
