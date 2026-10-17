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

## 2. Configuração do ambiente

Clone o repositório e entre na pasta do projeto.

Configure o arquivo `.env` da raiz com a variável `POSTGRES_PASSWORD`, utilizada pelo Docker Compose:

```env
POSTGRES_PASSWORD=defina_uma_senha_local
```

O arquivo `.env.example` serve como referência das variáveis utilizadas pelo projeto. Não use senhas reais no arquivo de exemplo nem versione arquivos `.env` com credenciais.

Configure `backend/.env` com a URL de conexão do PostgreSQL:

```env
DATABASE_URL="postgresql://mercado_app:SUA_SENHA@localhost:5432/mercado_jogadores?schema=public"
```

Substitua `SUA_SENHA` pela mesma senha definida em `POSTGRES_PASSWORD`. Se a senha tiver caracteres especiais, codifique-os corretamente na URL.

O backend aceita as seguintes variáveis:

| Variável | Finalidade | Valor padrão |
|---|---|---|
| `DATABASE_URL` | Conexão do Prisma com o PostgreSQL | Obrigatória |
| `PORT` | Porta HTTP do backend | `3000` |
| `FRONTEND_URL` | Origem permitida pelo CORS | `http://localhost:5173` |

No frontend, configure `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## 3. Banco de dados e migrações

Na raiz do projeto, inicie o PostgreSQL:

```bash
docker compose up -d postgres
```

Verifique o estado das migrações:

```bash
cd backend
npx prisma migrate status
```

Para aplicar as migrações existentes em um banco configurado:

```bash
npx prisma migrate deploy
```

O schema do Prisma está em `backend/prisma/schema.prisma`, e as migrações estão em `backend/prisma/migrations/`.

Para interromper o container sem apagar os dados:

```bash
docker compose stop postgres
```

O projeto utiliza o volume persistente `postgres_data`. Não utilize comandos que removam volumes sem compreender que isso pode apagar os dados do banco.

## 4. Instalação e execução

### Backend

Em um terminal:

```bash
cd backend
npm install
npm run start:dev
```

A API fica disponível, por padrão, em `http://localhost:3000/api/v1`.

### Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev -- --port 5173
```

A interface fica disponível em `http://localhost:5173`.

O frontend utiliza `NEXT_PUBLIC_API_URL` para identificar a API. O backend utiliza `FRONTEND_URL` para configurar o CORS. Mantenha essas URLs alinhadas com as portas utilizadas.

## 5. Testes e validação

No diretório `backend`, execute os testes unitários:

```bash
npm test
```

Para gerar o relatório de cobertura:

```bash
npm run test:cov
```

Para executar os testes de ponta a ponta:

```bash
npm run test:e2e
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

## 6. Estrutura do projeto

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

## 6.1. Bibliotecas principais

### Backend

- **NestJS** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`): estrutura da API HTTP, módulos, controladores e serviços.
- **Prisma** (`prisma`, `@prisma/client`): schema, migrações e acesso ao PostgreSQL.
- **class-validator** e **class-transformer**: validação e transformação dos dados recebidos pela API.
- **Vitest**: execução dos testes automatizados.
- **dotenv**: carregamento de variáveis de ambiente na configuração do Prisma.

### Frontend

- **Next.js**: framework da aplicação web.
- **React** e **React DOM**: construção e renderização da interface.
- **Tailwind CSS**: utilitários de estilização.
- **lucide-react**: ícones da interface.
- **ESLint** e **eslint-config-next**: análise estática e regras de qualidade do código frontend.

## 7. Decisões e premissas

- PostgreSQL é executado em container Docker e mantém os dados em volume persistente.
- O Prisma é utilizado para modelar o banco e controlar as migrações.
- O backend é organizado em módulos por domínio, com responsabilidades separadas entre controladores e serviços.
- A API utiliza o prefixo global `/api/v1`.
- O CORS permite a origem configurada em `FRONTEND_URL`.
- As configurações locais e credenciais devem permanecer nos arquivos de ambiente ignorados pelo Git.

## 8. Funcionalidades não implementadas

Documentar aqui as funcionalidades previstas no enunciado que não foram concluídas. Se todas as funcionalidades obrigatórias estiverem implementadas e validadas, registrar explicitamente: **Nenhuma**.

## 9. Uso de inteligência artificial

Registrar as ferramentas de inteligência artificial utilizadas durante o desenvolvimento e descrever, de forma transparente, em quais atividades auxiliaram. Informar também que o código e os resultados foram revisados e testados pelo responsável pelo projeto.
