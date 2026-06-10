use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct Player {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub is_admin: bool,
    pub created_at: DateTime<Utc>,
}

/// Versao publica do jogador (sem hash de senha).
#[derive(Debug, Serialize)]
pub struct PlayerPublic {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub is_admin: bool,
    pub created_at: DateTime<Utc>,
}

impl From<Player> for PlayerPublic {
    fn from(p: Player) -> Self {
        Self {
            id: p.id,
            username: p.username,
            email: p.email,
            is_admin: p.is_admin,
            created_at: p.created_at,
        }
    }
}

#[derive(Debug, Serialize, FromRow)]
pub struct Game {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub difficulty: i32,
    pub active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Run {
    pub id: Uuid,
    pub player_id: Uuid,
    pub game_id: Uuid,
    pub score: i32,
    pub deaths: i32,
    pub duration_seconds: i32,
    pub completed: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct LeaderboardEntry {
    pub player_id: Uuid,
    pub username: String,
    pub best_score: i32,
    pub total_deaths: i64,
    pub runs: i64,
}

/// Estatisticas de raiva de um jogador num jogo.
#[derive(Debug, Serialize, FromRow)]
pub struct RageStats {
    pub total_runs: i64,
    pub total_deaths: i64,
    pub best_score: Option<i32>,
    pub longest_run_seconds: Option<i32>,
    pub completed_runs: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Taunt {
    pub id: Uuid,
    pub game_id: Option<Uuid>,
    pub text: String,
    pub active: bool,
}
