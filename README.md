# Mercado de Jogadores

Sistema de gerenciamento de clubes, jogadores, escalações, partidas e operações de mercado, desenvolvido com NestJS, Prisma, PostgreSQL e Next.js.

## 1. Pré-requisitos

Ambiente verificado: Ubuntu 24.04.

- Node.js 22.23.3 e npm 10.9.9.
- Docker Engine 29.1.3 e Docker Compose 2.40.3.
- Git.
- PostgreSQL 16, executado pelo Docker Compose.

Versões principais das dependências:

- Backend: NestJS 12, Prisma e Prisma Client 6.19.3, Vitest 5.0.5.
- Frontend: Next.js 16.4.1, React 19.3.0 e Tailwind CSS 4.

## 2. Banco de dados, backend e frontend (passo a passo)

Todos os comandos abaixo podem ser copiados e executados no Ubuntu 24.04 com Docker. A API fica em `http://localhost:3000` (os caminhos começam em `/api/v1`) e a interface em `http://localhost:5173`.

```bash
# Na raiz do repositório: variáveis do Docker Compose e subida do PostgreSQL
cp .env.example .env
docker compose up -d postgres

# Backend (terminal 1)
cd backend
cp .env.example .env
npm ci
npx prisma migrate deploy
npm run start:dev

# Frontend (terminal 2, a partir da raiz do repositório)
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

O banco criado pelas migrações começa vazio (sem jogadores, clubes, transações nem partidas). A documentação interativa da API (Swagger) fica em `http://localhost:3000/api/docs`.

### Recriar o banco do zero

Na pasta `backend`, com o PostgreSQL de pé:

```bash
npx prisma migrate reset --force --skip-seed
```

O comando apaga o schema, reaplica todas as migrações e deixa o banco vazio. Para parar o container sem apagar os dados: `docker compose stop postgres`.

## 3. Variáveis de ambiente

Cada pasta tem seu `.env.example`; copie para `.env` (ou `.env.local` no frontend) e ajuste a senha, que precisa ser a mesma em `POSTGRES_PASSWORD` (raiz) e em `DATABASE_URL` (backend). Não versione arquivos `.env` com credenciais.

| Variável | Onde | Finalidade | Padrão |
|---|---|---|---|
| `POSTGRES_PASSWORD` | raiz | Senha do PostgreSQL no Docker Compose | obrigatória |
| `DATABASE_URL` | backend | Conexão do Prisma com o PostgreSQL | obrigatória |
| `PORT` | backend | Porta HTTP da API | `3000` |
| `FRONTEND_URL` | backend | Origem permitida pelo CORS | `http://localhost:5173` |
| `NEXT_PUBLIC_API_URL` | frontend | URL base da API, com `/api/v1` | `http://localhost:3000/api/v1` |

## 4. Testes, lint e formatação

No diretório `backend`, execute os testes unitários:

```bash
npm test
```

Para gerar o relatório de cobertura:

```bash
npm run test:cov
```

Lint e verificação de formatação (sem alterar arquivos):

```bash
npm run lint
npm run format:check
```

Para compilar o backend:

```bash
npm run build
```

No diretório `frontend`, os comandos disponíveis incluem:

```bash
npm run lint
npm run build
```

## 5. Estrutura do projeto

```text
mercado-jogadores/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   └── src/
│       ├── clubs/
│       ├── lineups/
│       ├── market/
│       ├── matches/
│       ├── players/
│       └── standings/
├── frontend/
├── compose.yaml
├── .env.example
└── README.md
```

A estrutura organiza a API por domínios funcionais. O Prisma gerencia o acesso ao PostgreSQL; o NestJS organiza os módulos e serviços do backend; e o Next.js implementa a interface web.

## 5.1. Bibliotecas principais

### Backend

- **NestJS** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`): estrutura da API HTTP, módulos, controladores e serviços.
- **Prisma** (`prisma`, `@prisma/client`): schema, migrações e acesso ao PostgreSQL.
- **class-validator** e **class-transformer**: validação e transformação dos dados recebidos pela API.
- **Vitest**: execução dos testes automatizados.
- **oxlint** e **Prettier**: lint e formatação do backend.
- **@nestjs/swagger**: documentação interativa da API.
- **dotenv**: carregamento de variáveis de ambiente na configuração do Prisma.

### Frontend

- **Next.js**: framework da aplicação web.
- **React** e **React DOM**: construção e renderização da interface.
- **Tailwind CSS**: utilitários de estilização.
- **lucide-react**: ícones da interface.
- **ESLint** e **eslint-config-next**: análise estática e regras de qualidade do código frontend.

## 6. Decisões e premissas

- PostgreSQL é executado em container Docker e mantém os dados em volume persistente.
- O Prisma é utilizado para modelar o banco e controlar as migrações.
- O backend é organizado em módulos por domínio, com responsabilidades separadas entre controladores e serviços.
- A API utiliza o prefixo global `/api/v1`.
- O CORS permite a origem configurada em `FRONTEND_URL`.
- As configurações locais e credenciais devem permanecer nos arquivos de ambiente ignorados pelo Git.
- Dinheiro é calculado em centavos inteiros no backend; o arredondamento é “meio para longe do zero”, aplicado uma única vez ao final de cada regra.
- Nomes são comparados e ordenados sem acento e sem diferenciar maiúsculas de minúsculas; empates se resolvem pelo id.
- Nas validações, a ordem de resposta é 400, depois 404, depois 409. Id inválido na URL (letras, zero, negativo, zero à esquerda ou acima de 2.147.483.647) responde 404.
- O jogador excluído (`DELETE`) é apagado de forma lógica: some das consultas, mas as transações antigas mantêm o nome gravado.
- O CSV do histórico é entregue pelo frontend exatamente como a API devolve (UTF-8, sem BOM, separador `;`, decimais com vírgula).
- Compra, venda, escalação, criação de clube e partida usam transações Serializable; conflitos concorrentes respondem 409.

## 7. Funcionalidades não implementadas

Nenhuma.

## 8. Uso de inteligência artificial

Utilizei o Claude (Anthropic) como apoio ao desenvolvimento, em: revisão do backend contra as regras de negócio do enunciado (RN01 a RN21 e V1 a V9), escrita e ajuste das telas do frontend (clubes, escalação, compra e venda, histórico, partidas, classificação e estados de tela), geração de testes unitários dos cálculos, e redação deste README e das mensagens de commit. Aceitei, alterei ou descartei as sugestões após ler o código gerado; executei o backend, os testes e as telas, e sou responsável pelo resultado final.
