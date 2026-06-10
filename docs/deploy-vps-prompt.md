# Prompt para o Claude Code na VPS — Deploy do `descuta_games`

> Copie tudo abaixo da linha e cole como mensagem para o Claude Code rodando na VPS.
> Antes, substitua os PLACEHOLDERS em MAIÚSCULAS (domínio, usuário, segredos).

---

Você é um agente de deploy rodando numa VPS Linux (provável Ubuntu/Debian). Sua tarefa é colocar em produção o projeto **descuta_games**, um monorepo de uma plataforma de "rage games". Trabalhe com cuidado: confirme cada etapa antes de seguir, não exponha segredos em logs, e ao final me entregue as URLs funcionando.

## Contexto do projeto

Repositório: `git@github.com:gelsonmatavela/descuta_games.git`
(Se a VPS não tiver chave SSH no GitHub, use HTTPS: `https://github.com/gelsonmatavela/descuta_games.git`.)

É um monorepo **pnpm** com três serviços:

| Serviço | Caminho | Stack | Porta local |
|---------|---------|-------|-------------|
| Backend API | `backend/` | Rust (Axum + SQLx/Postgres, JWT, Argon2) | **8080** |
| Jogo | `apps/plays/` | Next.js 16 + Phaser 3 | **3000** |
| Painel admin | `apps/admin/` | Next.js 16 | **3001** |
| Banco | `docker-compose.yml` (serviço `db`) | Postgres 16 (Docker) | 5432 |

- O backend roda as **migrations automaticamente** ao iniciar (`sqlx::migrate!`).
- Há um **admin de seed** criado por migration: `admin@rage.dev` / `admin123` (TROCAR — ver abaixo).
- `pnpm@10.33.2`.

## Topologia de produção desejada

- **HTTPS via Nginx (reverse proxy) + certbot.**
- Postgres roda em **Docker**; backend e apps rodam **nativos, como serviços `systemd`**.
- Domínios (ajuste aos que você tem apontando para o IP da VPS):
  - Jogo: `https://JOGO_DOMINIO` → `localhost:3000`
  - Painel: `https://admin.JOGO_DOMINIO` → `localhost:3001`
  - API: `https://api.JOGO_DOMINIO` → `localhost:8080`

## Passo a passo

### 1. Pré-requisitos
Instale (se faltar): `git`, `curl`, `docker` + `docker compose`, `nginx`, `certbot` (`python3-certbot-nginx`), Node 20+ e `pnpm@10.33.2` (`corepack enable && corepack prepare pnpm@10.33.2 --activate`), e a toolchain Rust (`rustup`, stable). Confirme versões antes de prosseguir.

### 2. Clonar
```bash
sudo mkdir -p /opt && cd /opt
git clone git@github.com:gelsonmatavela/descuta_games.git
cd /opt/descuta_games
```

### 3. Banco de dados (Postgres em Docker)
O `docker-compose.yml` sobe Postgres com usuário/senha/banco `rage/rage/rage_games`. **Para produção, troque a senha**: edite o `docker-compose.yml` (ou crie um `docker-compose.override.yml`) com uma senha forte e ajuste o `DATABASE_URL` do backend de acordo. Depois:
```bash
docker compose up -d db
docker compose ps   # confirme "healthy"
```

### 4. Backend (Rust)
Crie `backend/.env` a partir do exemplo e **gere segredos reais**:
```bash
cp backend/.env.example backend/.env
```
Edite `backend/.env`:
- `DATABASE_URL=postgres://rage:SENHA_FORTE@localhost:5432/rage_games`
- `JWT_SECRET=` → gere com `openssl rand -base64 48`
- `PORT=8080`
- `CORS_ORIGINS=https://JOGO_DOMINIO,https://admin.JOGO_DOMINIO`

Compile em release e crie o serviço systemd:
```bash
cd /opt/descuta_games/backend
cargo build --release   # gera target/release/rage-backend
```
Crie `/etc/systemd/system/descuta-backend.service`:
```ini
[Unit]
Description=descuta_games backend (Rust/Axum)
After=network.target docker.service

[Service]
WorkingDirectory=/opt/descuta_games/backend
EnvironmentFile=/opt/descuta_games/backend/.env
ExecStart=/opt/descuta_games/backend/target/release/rage-backend
Restart=on-failure
User=DEPLOY_USER

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now descuta-backend
curl -s localhost:8080/health   # {"status":"ok",...}
```
As migrations (incluindo o seed do admin) rodam sozinhas no primeiro start.

### 5. Apps Next.js (jogo e painel)
A URL da API é **embutida no build** (`NEXT_PUBLIC_API_URL`), então precisa apontar para a API pública ANTES de buildar:
```bash
cd /opt/descuta_games
echo 'NEXT_PUBLIC_API_URL=https://api.JOGO_DOMINIO/api' > apps/plays/.env.local
echo 'NEXT_PUBLIC_API_URL=https://api.JOGO_DOMINIO/api' > apps/admin/.env.local

pnpm install --frozen-lockfile
pnpm -r build
```
Crie dois serviços systemd. `/etc/systemd/system/descuta-plays.service`:
```ini
[Unit]
Description=descuta_games jogo (Next.js)
After=network.target

[Service]
WorkingDirectory=/opt/descuta_games/apps/plays
ExecStart=/usr/bin/env pnpm start
Environment=PORT=3000
Restart=on-failure
User=DEPLOY_USER

[Install]
WantedBy=multi-user.target
```
`/etc/systemd/system/descuta-admin.service` (idêntico, mas `apps/admin`, `Environment=PORT=3001` — o script do admin já usa `-p 3001`):
```ini
[Unit]
Description=descuta_games painel admin (Next.js)
After=network.target

[Service]
WorkingDirectory=/opt/descuta_games/apps/admin
ExecStart=/usr/bin/env pnpm start
Restart=on-failure
User=DEPLOY_USER

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now descuta-plays descuta-admin
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000
curl -s -o /dev/null -w "%{http_code}\n" localhost:3001
```
(Se `pnpm` não estiver no PATH do systemd, use o caminho absoluto de `pnpm` em `ExecStart`.)

### 6. Nginx (reverse proxy)
Crie um server block para cada subdomínio, fazendo proxy para a porta local. Modelo (repita ajustando `server_name` e `proxy_pass` para 3000 / 3001 / 8080):
```nginx
server {
    server_name JOGO_DOMINIO;          # e depois admin.JOGO_DOMINIO / api.JOGO_DOMINIO
    location / {
        proxy_pass http://127.0.0.1:3000;   # 3001 para admin, 8080 para api
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 7. HTTPS
```bash
sudo certbot --nginx -d JOGO_DOMINIO -d admin.JOGO_DOMINIO -d api.JOGO_DOMINIO
```
Confirme a renovação automática (`systemctl status certbot.timer`).

### 8. Verificação final
- `https://api.JOGO_DOMINIO/health` → `{"status":"ok"}`
- `https://JOGO_DOMINIO` → o jogo carrega e dá pra jogar
- `https://admin.JOGO_DOMINIO` → login com `admin@rage.dev` / `admin123` mostra o painel
- Faça login no painel e confirme que o overview/jogadores carregam (valida CORS + API pública).

## Avisos importantes (não pule)

1. **Segredos:** nunca commite `backend/.env`. Gere `JWT_SECRET` aleatório e use senha forte no Postgres (não deixe `rage/rage`).
2. **Trocar a senha do admin de seed:** `admin123` é pública (está no repo). Gere um novo hash Argon2 e atualize no banco:
   ```bash
   docker exec -it rage_games_db psql -U rage -d rage_games \
     -c "UPDATE players SET password_hash='NOVO_HASH_ARGON2' WHERE email='admin@rage.dev';"
   ```
   O hash deve ser Argon2id no formato PHC. O backend usa `Argon2::default()`.
3. **Migrations são embutidas em tempo de compilação** (`sqlx::migrate!`). Ao adicionar uma migration nova, **recompile o backend** (`cargo build --release`) e reinicie o serviço — só `git pull` não basta.
4. **Login é sensível a maiúsculas/espaços no email** (`WHERE email = $1`). Use exatamente `admin@rage.dev`.
5. **Rebuild dos apps ao mudar `NEXT_PUBLIC_API_URL`** — a URL é embutida no build, não lida em runtime.

## Fluxo de atualização (deploys futuros)
```bash
cd /opt/descuta_games && git pull
cargo build --release -p rage-backend && sudo systemctl restart descuta-backend
pnpm install --frozen-lockfile && pnpm -r build
sudo systemctl restart descuta-plays descuta-admin
```

Ao terminar, me reporte: status dos serviços (`systemctl is-active ...`), os 3 health checks, e qualquer erro que tenha aparecido nos logs (`journalctl -u descuta-backend -n 50`).
