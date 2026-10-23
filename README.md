# Mercado de Jogadores

Sistema de gerenciamento de clubes, jogadores, escalações, partidas e operações de mercado, desenvolvido com NestJS, Prisma, PostgreSQL e Next.js.

**Sumário**

1. [Pré-requisitos](#1-pré-requisitos)
2. [Banco de dados, backend e frontend (passo a passo)](#2-banco-de-dados-backend-e-frontend-passo-a-passo)
3. [Variáveis de ambiente](#3-variáveis-de-ambiente)
4. [Testes, lint e formatação](#4-testes-lint-e-formatação)
5. [Estrutura do projeto](#5-estrutura-do-projeto)
6. [API](#6-api)
7. [Modelo de dados](#7-modelo-de-dados)
8. [Decisões e premissas](#8-decisões-e-premissas)
9. [Funcionalidades não implementadas](#9-funcionalidades-não-implementadas)
10. [Solução de problemas](#10-solução-de-problemas)
11. [Uso de inteligência artificial](#11-uso-de-inteligência-artificial)

## 1. Pré-requisitos

Ambiente verificado: Ubuntu 24.04.

- Node.js 22.23.3 e npm 10.9.9 (necessários só para a Opção B do item 2; na Opção A o Node roda dentro dos containers).
- Docker Engine 29.1.3 e Docker Compose 2.40.3.
- Git.
- PostgreSQL 16, executado pelo Docker Compose (não precisa instalar).

Versões principais das dependências:

- Backend: NestJS 12, Prisma e Prisma Client 6.19.3, Vitest 5.0.5.
- Frontend: Next.js 16.4.1, React 19.3.0, Tailwind CSS 4 e Vitest 3.

## 2. Banco de dados, backend e frontend (passo a passo)

Todos os comandos abaixo podem ser copiados e executados no Ubuntu 24.04 com Docker. A API fica em `http://localhost:3000` (os caminhos começam em `/api/v1`) e a interface em `http://localhost:5173`.

| Serviço | Endereço |
|---|---|
| Interface web | http://localhost:5173 |
| API (origem) | http://localhost:3000 |
| API (caminhos) | http://localhost:3000/api/v1 |
| Documentação da API (Swagger) | http://localhost:3000/api/docs |
| PostgreSQL | `127.0.0.1:5432` (banco `mercado_jogadores`, usuário `mercado_app`) |

### Opção A: um único comando sobe banco, API e interface

```bash
# Na raiz do repositório
cp .env.example .env            # edite POSTGRES_PASSWORD (use só letras e números)
docker compose up -d --build
docker compose ps               # os três serviços devem ficar "running" / "healthy"
```

As migrações são aplicadas automaticamente quando a API inicia. Não é preciso criar `backend/.env` nem `frontend/.env.local`.

- Log das requisições da API: `docker compose logs -f backend`
- Parar mantendo os dados: `docker compose down`
- Parar e apagar os dados: `docker compose down -v`

### Opção B: só o banco no Docker; backend e frontend com npm

```bash
# Na raiz do repositório: variáveis do Docker Compose e subida do PostgreSQL
cp .env.example .env
docker compose up -d postgres

# Backend (terminal 1)
cd backend
cp .env.example .env
npm ci
npx prisma generate
npx prisma migrate deploy
npm run start:dev

# Frontend (terminal 2, a partir da raiz do repositório)
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

O banco criado pelas migrações começa vazio (sem jogadores, clubes, transações nem partidas). Para ter dados de teste, cadastre jogadores e clubes pela interface ou pelo Swagger.

### Recriar o banco do zero

Opção A (na raiz do repositório):

```bash
docker compose down -v
docker compose up -d --build
```

Opção B (na pasta `backend`, com o PostgreSQL de pé):

```bash
npx prisma migrate reset --force --skip-seed
```

O comando apaga o schema, reaplica todas as migrações e deixa o banco vazio. Para parar o container do banco sem apagar os dados: `docker compose stop postgres`.

## 3. Variáveis de ambiente

Cada pasta tem seu `.env.example`; copie para `.env` (ou `.env.local` no frontend) e ajuste a senha, que precisa ser a mesma em `POSTGRES_PASSWORD` (raiz) e em `DATABASE_URL` (backend, Opção B). Não versione arquivos `.env` com credenciais. Na Opção A, o Compose monta a `DATABASE_URL` sozinho a partir de `POSTGRES_PASSWORD`.

| Variável | Onde | Finalidade | Padrão |
|---|---|---|---|
| `POSTGRES_PASSWORD` | raiz | Senha do PostgreSQL no Docker Compose | obrigatória |
| `DATABASE_URL` | backend | Conexão do Prisma com o PostgreSQL | obrigatória na Opção B |
| `PORT` | backend | Porta HTTP da API | `3000` |
| `FRONTEND_URL` | backend | Origem permitida pelo CORS | `http://localhost:5173` |
| `NEXT_PUBLIC_API_URL` | frontend | URL base da API, com `/api/v1` | `http://localhost:3000/api/v1` |

## 4. Testes, lint e formatação

No diretório `backend`:

| Comando | O que faz |
|---|---|
| `npm test` | Testes automatizados (Vitest); terminam sozinhos |
| `npm run test:cov` | Testes com relatório de cobertura |
| `npm run lint` | Lint com oxlint |
| `npm run format:check` | Verifica a formatação com Prettier, sem alterar arquivos |
| `npm run format` | Formata os arquivos com Prettier |
| `npm run build` | Compila o backend |

No diretório `frontend`:

| Comando | O que faz |
|---|---|
| `npm test` | Testes de componente e de funções (Vitest + Testing Library); terminam sozinhos |
| `npm run lint` | Análise estática com ESLint |
| `npm run format:check` | Verifica a formatação com Prettier, sem alterar arquivos |
| `npm run format` | Formata os arquivos com Prettier |
| `npm run build` | Gera o build de produção |

Os testes do backend dependem do Prisma Client gerado (`npx prisma generate`); os testes não usam o banco de dados.

## 5. Estrutura do projeto

```text
mercado-jogadores/
├── backend/
│   ├── Dockerfile                 # imagem da API (gera o client, compila e aplica as migrações)
│   ├── prisma/
│   │   ├── migrations/            # migrações SQL versionadas
│   │   └── schema.prisma          # modelo de dados
│   └── src/
│       ├── main.ts                # inicialização da API
│       ├── app.setup.ts           # prefixo /api/v1, log, CORS, validação e Swagger
│       ├── app.module.ts
│       ├── clubs/                 # clubes (cadastro e consulta)
│       ├── players/               # jogadores (cadastro, edição, condição, exclusão)
│       ├── market/                # compra, venda e histórico de transações (CSV)
│       ├── lineups/               # escalação do clube
│       ├── matches/               # partidas e duelos
│       ├── standings/             # classificação
│       ├── prisma/                # PrismaModule e PrismaService
│       └── common/                # utilitários compartilhados (veja abaixo)
├── frontend/
│   ├── Dockerfile                 # imagem da interface (build do Next.js)
│   ├── tests/                     # testes do frontend (Vitest)
│   ├── app/                       # rotas (Next.js App Router)
│   │   ├── jogadores/
│   │   ├── clubes/ e clubes/[id]/
│   │   ├── partidas/ e partidas/[id]/
│   │   └── classificacao/
│   └── src/
│       ├── components/            # AppShell, Modal, Toast, ListStates e componentes por área
│       │   ├── players/
│       │   ├── clubs/
│       │   └── matches/
│       ├── services/              # chamadas à API (api, players, clubs, matches)
│       ├── types/
│       └── utils/                 # formatação, validações e cálculo de fidelidade
├── compose.yaml                   # PostgreSQL 16, API e interface
├── .env.example
└── README.md
```

A API é organizada por domínios funcionais. Cada pasta de `backend/src/<domínio>/` segue o mesmo padrão:

- `*.controller.ts`: rotas HTTP e documentação Swagger.
- `*.service.ts`: regras de negócio e acesso ao banco.
- `*.module.ts`: módulo NestJS do domínio.
- `dto/`: formato e validação dos dados de entrada.
- `utils/`: funções puras com as regras e os cálculos (testadas por arquivos `*.spec.ts`).

A pasta `backend/src/common/` reúne o que é compartilhado entre os domínios: dinheiro em centavos (`money.ts`), datas em horário de Brasília (`brasilia-time.ts`), comparação e ordenação de nomes sem acento (`text.ts`), leitura de ids e parâmetros de consulta (`parse-id.pipe.ts`, `query-params.ts`), registro de requisições (`request-logger.middleware.ts`) e o filtro global de erros (`all-exceptions.filter.ts`).

### 5.1. Bibliotecas principais

#### Backend

- **NestJS** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`): estrutura da API HTTP, módulos, controladores e serviços. O `Logger` do NestJS registra cada requisição.
- **Prisma** (`prisma`, `@prisma/client`): schema, migrações e acesso ao PostgreSQL.
- **class-validator** e **class-transformer**: validação e transformação dos dados recebidos pela API.
- **@nestjs/swagger**: documentação interativa da API (OpenAPI).
- **Vitest** e **supertest**: execução dos testes automatizados.
- **oxlint** e **Prettier**: lint e formatação do backend.
- **dotenv**: carregamento de variáveis de ambiente na configuração do Prisma.

#### Frontend

- **Next.js**: framework da aplicação web.
- **React** e **React DOM**: construção e renderização da interface.
- **Tailwind CSS**: utilitários de estilização.
- **lucide-react**: ícones da interface.
- **ESLint** e **eslint-config-next**: análise estática e regras de qualidade do código frontend.
- **Prettier**: formatação do código do frontend.
- **Vitest**: execução dos testes automatizados.
- **@testing-library/react**, **@testing-library/user-event** e **@testing-library/jest-dom**: testes de componentes, simulando o uso e verificando o que aparece na tela.
- **jsdom**: simula o navegador nos testes.

## 6. API

Todos os caminhos começam em `/api/v1`. O detalhe de parâmetros, corpos e respostas está no Swagger (`/api/docs`); o documento OpenAPI em JSON fica em `/api/docs-json`.

| Método | Caminho | Descrição |
|---|---|---|
| `GET` | `/players` | Lista jogadores, com busca, filtros, ordenação e paginação |
| `GET` | `/players/:id` | Consulta um jogador |
| `POST` | `/players` | Cadastra um jogador |
| `PUT` | `/players/:id` | Edita nome, posição, idade e agilidade |
| `PATCH` | `/players/:id/condition` | Altera a condição física |
| `DELETE` | `/players/:id` | Exclui (de forma lógica) um jogador livre |
| `POST` | `/players/:id/buy` | Compra um jogador livre para um clube |
| `POST` | `/players/:id/sell` | Vende um jogador do clube |
| `GET` | `/clubs` | Lista clubes, com ordenação |
| `GET` | `/clubs/:id` | Consulta um clube com o elenco |
| `POST` | `/clubs` | Cadastra um clube |
| `GET` | `/clubs/:id/transactions` | Histórico de transações, com totais e filtros |
| `GET` | `/clubs/:id/transactions/export` | Histórico em CSV |
| `GET` | `/clubs/:id/lineup` | Consulta a escalação |
| `PUT` | `/clubs/:id/lineup` | Salva a escalação (formação e 5 titulares) |
| `POST` | `/matches` | Joga uma partida entre dois clubes |
| `GET` | `/matches` | Lista as partidas |
| `GET` | `/matches/:id` | Consulta uma partida com os duelos |
| `GET` | `/standings` | Classificação |

## 7. Modelo de dados

O schema está em `backend/prisma/schema.prisma`.

| Modelo | Papel |
|---|---|
| `Jogador` | Dados do jogador, atributos e condição física; exclusão lógica |
| `Clube` | Clube com nome, sigla e caixa |
| `Contrato` | Vínculo entre jogador e clube, com valor de compra e fim da fidelidade |
| `Transacao` | Compras e vendas, com o nome e os valores gravados no momento da operação |
| `Escalacao` | Titulares e formação de cada clube |
| `Partida` | Partida entre dois clubes, com os gols |
| `DueloPartida` | Cada duelo entre jogadores de uma partida |

## 8. Decisões e premissas

- PostgreSQL é executado em container Docker e mantém os dados em volume persistente.
- O Docker Compose sobe três serviços (`postgres`, `backend` e `frontend`); a API só inicia depois que o banco está saudável e aplica as migrações ao iniciar. O endereço da API gravado no frontend é o que o navegador enxerga (`http://localhost:3000/api/v1`).
- O Prisma é utilizado para modelar o banco e controlar as migrações.
- O backend é organizado em módulos por domínio, com responsabilidades separadas entre controladores e serviços.
- A API utiliza o prefixo global `/api/v1`.
- Cada requisição gera uma linha de log (método, caminho, status e duração), com data e hora, pelo `Logger` do NestJS.
- O CORS permite a origem configurada em `FRONTEND_URL`.
- As configurações locais e credenciais devem permanecer nos arquivos de ambiente ignorados pelo Git.
- Dinheiro é calculado em centavos inteiros no backend; o arredondamento é “meio para longe do zero”, aplicado uma única vez ao final de cada regra.
- Nomes são comparados e ordenados sem acento e sem diferenciar maiúsculas de minúsculas; empates se resolvem pelo id.
- Nas validações, a ordem de resposta é 400, depois 404, depois 409. Id inválido na URL (letras, zero, negativo, zero à esquerda ou acima de 2.147.483.647) responde 404.
- O jogador excluído (`DELETE`) é apagado de forma lógica: some das consultas, mas as transações antigas mantêm o nome gravado.
- O CSV do histórico é entregue pelo frontend exatamente como a API devolve (UTF-8, sem BOM, separador `;`, decimais com vírgula). Ao abrir no Excel ou no LibreOffice, use apenas o ponto e vírgula como separador, senão os decimais se dividem em duas colunas.
- Compra, venda, escalação, criação de clube e partida usam transações Serializable; conflitos concorrentes respondem 409.
- Datas e horários seguem o horário de Brasília (UTC−3).

## 9. Funcionalidades não implementadas

Nenhuma.

## 10. Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `docker compose up` pede `POSTGRES_PASSWORD` | Falta o `.env` na raiz | `cp .env.example .env` |
| Erro `P1000` (autenticação) ou API não conecta ao banco | A senha do `.env` mudou depois da primeira criação do volume, ou é diferente entre a raiz e o backend (Opção B) | `docker compose down -v`, suba de novo e aplique as migrações |
| O serviço `backend` não fica `healthy` | Senha com caracteres especiais (`@`, `/`, `:`) quebra a URL do banco, ou o banco ainda está subindo | Use uma senha só com letras e números; veja `docker compose logs backend` |
| Erro 500 e `relation ... does not exist` | Migrações não aplicadas (Opção B) | Na pasta `backend`: `npx prisma migrate deploy` |
| `@prisma/client did not initialize yet` ou testes do backend falhando em `Prisma.Decimal` | Prisma Client não gerado | Na pasta `backend`: `npx prisma generate` |
| Interface mostra “Não foi possível carregar…” | API parada ou `NEXT_PUBLIC_API_URL` errada | Suba o backend e confira o `.env.local` do frontend |
| Erro de CORS no navegador | Origem da interface diferente de `FRONTEND_URL` | Ajuste `FRONTEND_URL` no `.env` do backend e reinicie a API |
| Porta 3000, 5173 ou 5432 em uso | Outro processo usando a porta | Pare o outro processo ou mude a porta |
| CSV com colunas partidas | Vírgula marcada como separador na importação | Importe só com ponto e vírgula e UTF-8 |

## 11. Uso de inteligência artificial

Utilizei o Claude (Anthropic) como apoio ao desenvolvimento, em: revisão do backend contra as regras de negócio do enunciado (RN01 a RN21 e V1 a V9), escrita e ajuste das telas do frontend (clubes, escalação, compra e venda, histórico, partidas, classificação e estados de tela), geração de testes automatizados (cálculos do backend e funções e componentes do frontend), configuração do Prettier, do Vitest e do Docker Compose completo, e redação deste README e das mensagens de commit. Aceitei, alterei ou descartei as sugestões após ler o código gerado; executei o backend, os testes e as telas, e sou responsável pelo resultado final.
