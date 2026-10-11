# BeeFlux

O **BeeFlux** é um sistema web para gerenciamento de confeitarias, desenvolvido como projeto acadêmico do curso de **Análise e Desenvolvimento de Sistemas (ADS)**.

O sistema tem como objetivo centralizar informações e auxiliar na organização dos processos de uma confeitaria, integrando os módulos de **Estoque, Compras, Receitas e Custos**.

## Tecnologias utilizadas

- **TypeScript:** desenvolvimento da lógica e do backend.
- **HTML:** estrutura das páginas do sistema.
- **CSS:** estilização e organização visual da interface.
- **MySQL:** armazenamento e gerenciamento dos dados.
- **Vitest:** criação e execução de testes automatizados.
- **Node.js:** ambiente de execução do backend.

## Configuração inicial do projeto

Os comandos abaixo devem ser executados no terminal, na raiz do projeto, onde está localizado o `package.json`.

### 1. Inicialização do projeto

```bash
npm init -y
```

Cria o arquivo `package.json`, responsável por armazenar informações do projeto, dependências e scripts de execução.

*Se o arquivo já existir no repositório, não é necessário executar esse comando novamente.*

### 2. Instalação das dependências

```bash
npm install -D typescript tsx @types/node vitest
npm install mysql2 dotenv
```

- `typescript`: permite escrever, verificar e compilar arquivos TypeScript.
- `tsx`: executa arquivos TypeScript durante o desenvolvimento.
- `@types/node`: fornece definições de tipos para o Node.js.
- `vitest`: executa os testes automatizados.
- `mysql2`: permite a comunicação entre o backend e o MySQL.
- `dotenv`: carrega as variáveis de ambiente definidas no arquivo `.env`.

### 3. Criação do arquivo de configuração TypeScript

```bash
npx tsc --init
```

Cria o arquivo `tsconfig.json`, responsável por definir as configurações do compilador TypeScript.

### 4. Configuração do TypeScript

O `tsconfig.json` deve ser ajustado de acordo com a estrutura do projeto.

Principais opções:

- `rootDir`: define a pasta dos arquivos TypeScript de origem.
- `outDir`: define onde os arquivos JavaScript compilados serão gerados.
- `strict`: ativa verificações rigorosas de tipos.
- `include`: define os arquivos TypeScript incluídos na compilação.
- `exclude`: exclui pastas que não devem ser compiladas.

Como o backend está planejado para ficar em `backend/src/`, os caminhos devem considerar essa estrutura.

### 5. Configuração dos scripts

No `package.json`, os scripts podem ser definidos assim, considerando o backend em `backend/src/index.ts`:

```json
"scripts": {
  "dev": "tsx backend/src/index.ts",
  "build": "tsc",
  "test": "vitest run"
}
```

- `npm run dev`: executa o backend durante o desenvolvimento.
- `npm run build`: compila o TypeScript.
- `npm test`: executa os testes automatizados uma vez.

### 6. Configuração do `.gitignore`

O arquivo `.gitignore` define quais arquivos e pastas não devem ser enviados ao GitHub.

```gitignore
node_modules/
backend/dist/
.env
```

- `node_modules/`: contém as dependências instaladas pelo npm.
- `backend/dist/`: contém os arquivos JavaScript gerados pela compilação.
- `.env`: contém configurações locais e dados sensíveis.

!A SER PREENCHIDO!

## Objetivo do projeto

O BeeFlux busca integrar as principais operações de uma confeitaria em um único sistema web, facilitando a organização dos dados, o acompanhamento das atividades e o gerenciamento das informações utilizadas no dia a dia.
