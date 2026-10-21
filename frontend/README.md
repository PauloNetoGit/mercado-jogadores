# Frontend — Mercado de Jogadores

Interface web do sistema, feita com Next.js 16 (App Router), React 19 e Tailwind CSS 4. Ela consome a API do backend (`/api/v1`). O passo a passo completo (banco, backend e frontend) está no [README da raiz](../README.md).

## Como rodar

Com o backend e o banco no ar:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

A interface abre em http://localhost:5173.

## Variáveis de ambiente

| Variável | Finalidade | Padrão |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL base da API, com `/api/v1` | `http://localhost:3000/api/v1` |

O backend só aceita requisições da origem definida em `FRONTEND_URL` (padrão `http://localhost:5173`). Se mudar a porta do frontend, ajuste essa variável no `.env` do backend.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento na porta 5173 |
| `npm run build` | Build de produção |
| `npm start` | Serve o build de produção na porta 5173 (rode `npm run build` antes) |
| `npm run lint` | Análise estática com ESLint |

## Telas

| Rota | Tela |
|---|---|
| `/jogadores` | Lista de jogadores com busca, filtros, ordenação e paginação; cadastro, edição, condição, exclusão e compra |
| `/clubes` | Lista de clubes e cadastro de novo clube |
| `/clubes/[id]` | Clube com indicadores e três abas: Elenco (com venda), Escalação e Histórico de transações (com exportação em CSV) |
| `/partidas` | Histórico de partidas e nova partida |
| `/partidas/[id]` | Detalhe da partida, com o campo e os duelos |
| `/classificacao` | Classificação dos clubes |

Todas as listas têm os estados de carregamento, lista vazia e erro (com o botão “Tentar de novo”).

## Estrutura

```text
frontend/
├── app/                        # rotas (App Router)
│   ├── jogadores/
│   ├── clubes/ e clubes/[id]/
│   ├── partidas/ e partidas/[id]/
│   └── classificacao/
├── public/                     # arquivos estáticos (logotipo)
└── src/
    ├── components/
    │   ├── AppShell.tsx        # barra lateral, trilha de navegação e botão de atualizar
    │   ├── Modal.tsx, Toast.tsx, ListStates.tsx
    │   ├── players/            # modais de compra, condição, exclusão e cadastro; painel de detalhes
    │   ├── clubs/              # escalação, histórico, venda e novo clube
    │   └── matches/            # campo, duelos e nova partida
    ├── services/               # chamadas à API (api, players, clubs, matches)
    ├── types/                  # tipos compartilhados
    └── utils/                  # formatação de valores, validações e cálculo de fidelidade
```

## Observações

- A tela não calcula regras de negócio (overall, valor de mercado, multa): ela exibe o que a API devolve.
- Datas e horários seguem o horário de Brasília (UTC−3).
- O CSV do histórico é baixado exatamente como a API entrega (UTF-8, separador `;`, decimais com vírgula). Ao abrir no Excel ou no LibreOffice, use apenas o ponto e vírgula como separador.
- A fonte Geist é carregada do Google Fonts pelo `next/font`. O primeiro `npm run dev` e o `npm run build` precisam de internet.