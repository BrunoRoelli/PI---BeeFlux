# BeeFlux

O **BeeFlux** é um sistema web para gerenciamento de confeitarias, desenvolvido como projeto acadêmico do curso de **Análise e Desenvolvimento de Sistemas (ADS)**.

![Logo BeeFlux](assets/logo.png)

A plataforma tem como foco a integração dos módulos de **Estoque, Compras, Receita e Custos**, centralizando informações e auxiliando no controle e organização dos processos da confeitaria.

**Tecnologias:** TypeScript, HTML, CSS, MySQL e Vitest.

## Configuração inicial do projeto
1. Inicialização do projeto
npm init -y

Cria o arquivo package.json, que armazena as informações do projeto, scripts e dependências utilizadas.

2. Instalação do TypeScript
npm i -D typescript

Instala o TypeScript como dependência de desenvolvimento, permitindo escrever, verificar e compilar arquivos .ts.

3. Tipos do Node.js
npm i -D @types/node

Adiciona as definições de tipos do Node.js para que o TypeScript reconheça recursos e módulos do ambiente Node.

4. Instalação do Vitest
npm i -D vitest

Instala o Vitest, utilizado para criar e executar os testes automatizados do projeto.

5. Criação do tsconfig.json
npx tsc --init

Cria o arquivo tsconfig.json, responsável pelas configurações do compilador TypeScript.

6. Configuração do TypeScript

No tsconfig.json, foram configuradas as opções relacionadas à entrada e saída da compilação:

rootDir — define a pasta onde estão os arquivos TypeScript do projeto.
outDir — define a pasta onde os arquivos JavaScript compilados serão gerados.
"verbatimModuleSyntax": false — permite que o TypeScript faça os ajustes necessários nos imports e exports durante a compilação.
"strict": true — ativa verificações mais rigorosas do TypeScript para ajudar a encontrar erros durante o desenvolvimento.

7. Configuração do .gitignore

O arquivo .gitignore impede que arquivos desnecessários sejam enviados para o GitHub:

node_modules — contém as dependências instaladas pelo npm e pode ser recriado usando npm install.
dist — contém os arquivos JavaScript gerados pela compilação e não precisa ser versionado.

8. Compilação do projeto
npx tsc

Executa o compilador TypeScript e transforma os arquivos .ts em arquivos .js, colocando o resultado na pasta definida em outDir.

9. Execução do projeto compilado
node dist/index.js

Executa com o Node.js o arquivo index.js gerado após a compilação.

10. Verificação do TypeScript
npx tsc --noEmit

Verifica se existem erros de TypeScript sem gerar os arquivos .js. Essa verificação é utilizada para confirmar que o projeto está compilando corretamente.

11. Execução dos testes
npm test

Executa os testes automatizados do projeto utilizando o Vitest.

12. Execução durante o desenvolvimento
npm run dev

Executa o src/index.ts diretamente utilizando o script dev configurado no package.json.

## Estrutura do projeto
+ src/tipos.ts — Contém a interface Despesa e o tipo Categoria.
+ src/despesas.ts — Contém as funções para adicionar, remover, filtrar e calcular despesas.
+ src/relatorio.ts — Contém as funções responsáveis pela descrição das categorias, matriz de gastos e formatação do relatório.
+ src/index.ts — Contém as despesas de exemplo e executa o relatório principal.
+ src/*.test.ts — Contém os testes automatizados das funções.

## Arquivos de configuração
+ package.json — Define as dependências, scripts do projeto e informações do projeto.
+ tsconfig.json — Configura o TypeScript, incluindo o modo strict.
+ .gitignore — Define arquivos e pastas que não devem ser enviados para o Git.
+ vitest.config.ts — Configura o Vitest para execução dos testes, caso presente no projeto.
