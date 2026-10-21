# Backend — API do mercado de jogadores

API REST em NestJS 12 com Prisma 6 e PostgreSQL. O passo a passo completo (banco, instalação e execução) está no [README da raiz](../README.md).

```bash
npm ci
cp .env.example .env
npx prisma migrate deploy
npm run start:dev      # http://localhost:3000/api/v1 (Swagger em /api/docs)
npm test               # testes unitários (terminam sozinhos)
npm run lint           # oxlint
npm run format:check   # prettier, sem alterar arquivos
```

Estrutura: `src/<domínio>/` (players, clubs, market, lineups, matches, standings) com controller, service, `dto/` e `utils/` de regras; `src/common/` reúne dinheiro em centavos, datas de Brasília, ordenação de nomes, parsing de ids e query params e o filtro global de erros.
