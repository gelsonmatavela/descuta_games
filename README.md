# 😡 Rage Games — Rage

## I AND CLAUDE BUILT THIS STRESS GAME JUST FOR YOU

### 🎮 Live Demo

https://games.descuta.online

---

## About

**Rage Games** is a collection of web-based 2D games designed to push players to their limits.

The first title, **Rage**, is a brutal platformer packed with deceptive traps, fake floors, hidden spikes, collapsing platforms, and countless unfair surprises. Every level is designed to test your patience, memory, and determination.

You will fail.

You will fail repeatedly.

And the server will happily remind you of that.

---

## Architecture (Monorepo)

```text
games/
├── apps/
│   ├── plays/      # Game client — Next.js + Phaser 3 (Port 3000)
│   └── admin/      # Admin dashboard — Next.js (Port 3001)
├── backend/        # Rust API (Axum + SQLx + PostgreSQL) (Port 8080)
└── docker-compose.yml
```

### Technology Stack

#### Backend

* Rust
* Axum
* SQLx
* PostgreSQL
* JWT Authentication
* Argon2 Password Hashing

#### Game Client

* Next.js (App Router)
* Phaser 3
* React
* TypeScript

#### Admin Dashboard

* Next.js
* React
* TypeScript

Only users marked as `is_admin` can access the administration panel.

Administrators can:

* Manage players
* Configure game difficulty
* Create and manage taunting messages
* View game statistics

---

## Running the Project

### Prerequisites

* Docker
* Node.js 20+
* pnpm
* Rust (Stable)

### 1. Start PostgreSQL

```bash
pnpm db:up
```

### 2. Start the Backend

```bash
cd backend

cp .env.example .env

# Configure JWT_SECRET before production deployment

cargo run
```

Backend will be available at:

```text
http://localhost:8080
```

### 3. Install Frontend Dependencies

From the project root:

```bash
pnpm install
```

### 4. Run the Game Client

```bash
pnpm dev:plays
```

Game available at:

```text
http://localhost:3000
```

### 5. Run the Admin Dashboard

Open a new terminal and run:

```bash
pnpm dev:admin
```

Admin dashboard available at:

```text
http://localhost:3001
```

---

## Creating an Administrator

Create a regular account through the game and then promote it using SQL:

```bash
docker exec -it rage_games_db psql -U rage -d rage_games \
-c "UPDATE players SET is_admin = TRUE WHERE email = 'your@email.com';"
```

---

## API Overview

| Method | Endpoint                             | Auth   | Description                    |
| ------ | ------------------------------------ | ------ | ------------------------------ |
| POST   | `/api/auth/register`                 | Public | Create an account              |
| POST   | `/api/auth/login`                    | Public | Login and receive JWT          |
| GET    | `/api/auth/me`                       | Player | Retrieve player profile        |
| GET    | `/api/games`                         | Public | List available games           |
| GET    | `/api/games/{slug}`                  | Public | Retrieve game details          |
| POST   | `/api/scores/{slug}/runs`            | Player | Submit a game run              |
| GET    | `/api/scores/{slug}/leaderboard`     | Public | View global leaderboard        |
| GET    | `/api/stats/{slug}/me`               | Player | Retrieve player statistics     |
| GET    | `/api/stats/{slug}/taunt`            | Public | Retrieve a random taunt        |
| GET    | `/api/admin/overview`                | Admin  | Global platform statistics     |
| GET    | `/api/admin/players`                 | Admin  | List all players               |
| PATCH  | `/api/admin/games/{slug}/difficulty` | Admin  | Update difficulty level (1–10) |
| POST   | `/api/admin/taunts`                  | Admin  | Create a taunt                 |
| DELETE | `/api/admin/taunts/{id}`             | Admin  | Delete a taunt                 |

---

## Controls

### Keyboard

| Action     | Keys               |
| ---------- | ------------------ |
| Move Left  | ← or A             |
| Move Right | → or D             |
| Jump       | ↑ or W or Spacebar |

### Mobile

* On-screen touch controls

---

## Disclaimer

This game was intentionally designed to be unfair.

If you're looking for a relaxing experience, this may not be the game for you.

If you're looking for pain, frustration, and the satisfaction of eventually overcoming impossible odds, welcome to **Rage**.
