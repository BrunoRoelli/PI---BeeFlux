# BeeFlux

O **BeeFlux** é um sistema web para gerenciamento de confeitarias, desenvolvido como projeto acadêmico do curso de **Análise e Desenvolvimento de Sistemas (ADS)**.

O sistema tem como objetivo centralizar informações e auxiliar na organização dos processos de uma confeitaria, integrando os módulos de **Estoque, Compras, Receitas e Custos**.

## Tecnologias utilizadas

- **TypeScript:** desenvolvimento da lógica e do backend.
- **Node.js:** ambiente de execução do backend.
- **Express:** criação das rotas e gerenciamento das requisições HTTP.
- **HTML:** estrutura das páginas do sistema.
- **CSS:** estilização e organização visual da interface.
- **JavaScript:** interações do frontend e comunicação com a API.
- **MySQL:** banco de dados planejado para o armazenamento das informações.
- **Vitest:** criação e execução de testes automatizados.
- **bcryptjs:** geração e verificação de hashes de senhas.
- **CORS:** configuração da comunicação entre frontend e backend.
- **dotenv:** gerenciamento de variáveis de ambiente.

## Funcionalidades em desenvolvimento

- **Cadastro de usuários:** recebimento e validação dos dados de cadastro pela API.
- **Login:** autenticação das credenciais cadastradas pelo backend.
- **Criptografia de senhas:** armazenamento das senhas em formato de hash utilizando `bcryptjs`.
- **Interface web:** páginas de login, cadastro e módulos do sistema.
- **Gerenciamento de confeitaria:** desenvolvimento dos módulos de Estoque, Compras, Receitas e Custos.

> **Estado atual:** o cadastro e o login já se comunicam com o backend. Os usuários ainda são armazenados temporariamente em memória, e a persistência no MySQL e a proteção completa das páginas e rotas privadas ainda precisam ser implementadas.

## Estrutura do projeto

A organização geral do projeto segue a seguinte estrutura:

```text
BeeFlux/
├── backend/
│   └── src/
│       ├── modules/
│       │   └── auth/
│       │   └── compras/
│       │   └── custos/
│       │   └── estoque/
│       │   └── receitas/
│       ├── tests/
│       └── index.ts
├── frontend/
│   ├── css/
│   ├── html/
│   ├── js/
│   └── index.html
├── .gitignore
├── package.json
├── package-lock.json
└── tsconfig.json
```

A estrutura apresentada é uma referência baseada na organização atual do projeto e poderá ser ampliada conforme os módulos forem implementados.

## Configuração do ambiente de desenvolvimento

Os comandos abaixo devem ser executados no terminal, na raiz do projeto, onde está localizado o `package.json`.

### 1. Inicialização do projeto

```bash
npm init -y
```

Cria o arquivo `package.json`, responsável por armazenar informações do projeto, dependências e scripts de execução.

*Se o arquivo já existir no repositório, não é necessário executar esse comando novamente.*

### 2. Instalação das dependências

As dependências utilizadas pelo backend e pelos testes incluem:

```bash
npm install express cors bcryptjs dotenv
npm install -D typescript tsx @types/node @types/express @types/cors vitest
```

O suporte a sessões, caso seja adotado posteriormente, deverá ser instalado quando essa funcionalidade for implementada.

Principais dependências:

- `express`: criação do servidor e das rotas da API.
- `cors`: configuração do acesso do frontend à API.
- `bcryptjs`: geração e comparação de hashes de senhas.
- `dotenv`: leitura das variáveis de ambiente.
- `typescript`: tipagem estática e compilação do código.
- `tsx`: execução dos arquivos TypeScript durante o desenvolvimento.
- `@types/node`, `@types/express` e `@types/cors`: definições de tipos para o TypeScript.
- `vitest`: execução dos testes automatizados.

Para a futura integração com MySQL, também será necessário instalar o driver `mysql2`:

```bash
npm install mysql2
```

### 3. Configuração do TypeScript

Caso o arquivo `tsconfig.json` ainda não exista, ele pode ser criado com:

```bash
npx tsc --init
```

O `tsconfig.json` define as configurações do compilador TypeScript.

Principais opções:

- `rootDir`: define a pasta dos arquivos TypeScript de origem.
- `outDir`: define onde os arquivos JavaScript compilados serão gerados.
- `strict`: ativa verificações rigorosas de tipos.
- `include`: define os arquivos TypeScript incluídos na compilação.
- `exclude`: exclui pastas que não devem ser compiladas.

Como o backend está organizado em `backend/src/`, os caminhos devem ser configurados de acordo com a estrutura real do projeto.

### 4. Configuração dos scripts

No `package.json`, os scripts podem ser definidos assim, considerando o backend em `backend/src/index.ts`:

```json
"scripts": {
  "dev": "tsx backend/src/index.ts",
  "build": "tsc",
  "test": "vitest run"
}
```

- `npm run dev`: executa o backend durante o desenvolvimento.
- `npm run build`: compila o TypeScript conforme as configurações do `tsconfig.json`.
- `npm test`: executa os testes automatizados uma vez.

*Se esses scripts já estiverem configurados, mantenha a configuração existente e ajuste apenas o necessário.*

### 5. Configuração do `.gitignore`

O arquivo `.gitignore` define quais arquivos e pastas não devem ser enviados ao GitHub.

Exemplo:

```gitignore
node_modules/
backend/dist/
.env
```

- `node_modules/`: contém as dependências instaladas pelo npm.
- `backend/dist/`: contém os arquivos gerados pela compilação, caso essa seja a pasta definida em `outDir`.
- `.env`: contém configurações locais e dados sensíveis.

### 6. Execução do backend

Após instalar as dependências e configurar o ambiente, execute:

```bash
npm run dev
```

Se tudo estiver configurado corretamente, o terminal deverá indicar que a API está rodando em:

```text
http://localhost:3000
```

Para verificar se o servidor está funcionando, acesse esse endereço no navegador. A resposta esperada é:

```json
{
  "mensagem": "API do BeeFlux funcionando!"
}
```

**Observação:** o frontend deve ser aberto por um servidor de desenvolvimento local, como o Live Server do VS Code, para facilitar a comunicação com a API.

## Objetivo do projeto

O BeeFlux busca integrar as principais operações de uma confeitaria em um único sistema web, facilitando a organização dos dados, o acompanhamento das atividades e o gerenciamento das informações utilizadas no dia a dia.

O projeto também permite aplicar, na prática, os conhecimentos adquiridos durante o curso de Análise e Desenvolvimento de Sistemas, envolvendo desenvolvimento web, organização de código, APIs, bancos de dados e testes automatizados.
