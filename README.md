# Rage Games — Plataforma Armadilha

Plataforma de jogos 2D web feitos para **estressar o jogador**. O primeiro jogo é
o *Plataforma Armadilha*: um platformer cheio de armadilhas traiçoeiras (chão falso,
picos escondidos, blocos que caem). Você vai morrer muito — e o servidor vai zombar de você.

## Arquitetura (monorepo)

```
games/
├── apps/
│   ├── plays/      # O jogo — Next.js + Phaser 3 (porta 3000)
│   └── admin/      # Painel administrativo — Next.js (porta 3001)
├── backend/        # API em Rust (Axum + SQLx + PostgreSQL) (porta 8080)
└── docker-compose.yml  # PostgreSQL
```

- **Backend:** Rust com [Axum](https://github.com/tokio-rs/axum), SQLx, JWT (jsonwebtoken)
  e hashing de senha com Argon2.
- **Jogo:** Next.js (App Router) + Phaser 3 para a física arcade. O nível é
  determinístico de propósito — dá pra decorar, mas é injusto.
- **Admin:** Next.js. Login só para contas `is_admin`, ajusta dificuldade e frases zombeteiras.

## Como rodar (desenvolvimento)

Pré-requisitos: Docker, Node 20+, pnpm, Rust (stable).

```bash
# 1. Subir o PostgreSQL
pnpm db:up

# 2. Backend (roda migrations automaticamente no start)
cd backend
cp .env.example .env        # ajuste JWT_SECRET em produção
cargo run                   # http://localhost:8080

# 3. Instalar deps do front (na raiz)
pnpm install

# 4. O jogo
pnpm dev:plays              # http://localhost:3000

# 5. O painel admin (outro terminal)
pnpm dev:admin              # http://localhost:3001
```

## Criar um administrador

Registre uma conta normal pelo jogo, depois promova via SQL:

```bash
docker exec -it rage_games_db psql -U rage -d rage_games \
  -c "UPDATE players SET is_admin = TRUE WHERE email = 'seu@email.com';"
```

## API (resumo)

| Método | Rota                                   | Auth   | Descrição                          |
|--------|----------------------------------------|--------|------------------------------------|
| POST   | `/api/auth/register`                   | —      | Cria conta                         |
| POST   | `/api/auth/login`                      | —      | Login (retorna JWT)                |
| GET    | `/api/auth/me`                         | player | Perfil do jogador                  |
| GET    | `/api/games`                           | —      | Lista jogos ativos                 |
| GET    | `/api/games/{slug}`                    | —      | Detalhe de um jogo                 |
| POST   | `/api/scores/{slug}/runs`              | player | Submete uma tentativa              |
| GET    | `/api/scores/{slug}/leaderboard`       | —      | Ranking global                     |
| GET    | `/api/stats/{slug}/me`                 | player | Estatísticas de raiva do jogador   |
| GET    | `/api/stats/{slug}/taunt`              | —      | Frase zombeteira aleatória         |
| GET    | `/api/admin/overview`                  | admin  | Números globais                    |
| GET    | `/api/admin/players`                   | admin  | Lista jogadores                    |
| PATCH  | `/api/admin/games/{slug}/difficulty`   | admin  | Ajusta dificuldade (1–10)          |
| POST   | `/api/admin/taunts`                    | admin  | Cria frase zombeteira              |
| DELETE | `/api/admin/taunts/{id}`               | admin  | Remove frase                       |

## Controles do jogo

- **Andar:** ← → ou A / D
- **Pular:** ↑ / W / Espaço
- **Mobile:** botões na tela
