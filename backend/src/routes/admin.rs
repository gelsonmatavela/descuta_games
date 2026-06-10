use axum::extract::{Path, State};
use axum::routing::{delete, get, patch, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AdminUser;
use crate::error::{AppError, AppResult};
use crate::models::{Game, PlayerPublic, Taunt};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/overview", get(overview))
        .route("/players", get(list_players))
        .route("/games/{slug}/difficulty", patch(set_difficulty))
        .route("/taunts", post(create_taunt))
        .route("/taunts/{id}", delete(delete_taunt))
}

/// Numeros globais para o painel.
async fn overview(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> AppResult<Json<Value>> {
    let players: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM players")
        .fetch_one(&state.pool)
        .await?;
    let runs: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM runs")
        .fetch_one(&state.pool)
        .await?;
    let total_deaths: i64 =
        sqlx::query_scalar("SELECT COALESCE(SUM(deaths), 0) FROM runs")
            .fetch_one(&state.pool)
            .await?;

    Ok(Json(json!({
        "players": players,
        "runs": runs,
        "total_deaths": total_deaths,
    })))
}

async fn list_players(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> AppResult<Json<Vec<PlayerPublic>>> {
    let players = sqlx::query_as::<_, crate::models::Player>(
        "SELECT * FROM players ORDER BY created_at DESC LIMIT 200",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(players.into_iter().map(Into::into).collect()))
}

#[derive(Deserialize)]
struct DifficultyInput {
    difficulty: i32,
}

async fn set_difficulty(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(slug): Path<String>,
    Json(input): Json<DifficultyInput>,
) -> AppResult<Json<Game>> {
    if !(1..=10).contains(&input.difficulty) {
        return Err(AppError::BadRequest("dificuldade deve ser de 1 a 10".into()));
    }
    let game = sqlx::query_as::<_, Game>(
        "UPDATE games SET difficulty = $1 WHERE slug = $2 RETURNING *",
    )
    .bind(input.difficulty)
    .bind(&slug)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(game))
}

#[derive(Deserialize)]
struct TauntInput {
    game_id: Option<Uuid>,
    text: String,
}

async fn create_taunt(
    State(state): State<AppState>,
    _admin: AdminUser,
    Json(input): Json<TauntInput>,
) -> AppResult<Json<Taunt>> {
    if input.text.trim().is_empty() {
        return Err(AppError::BadRequest("texto vazio".into()));
    }
    let taunt = sqlx::query_as::<_, Taunt>(
        "INSERT INTO taunts (game_id, text) VALUES ($1, $2) RETURNING *",
    )
    .bind(input.game_id)
    .bind(input.text.trim())
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(taunt))
}

async fn delete_taunt(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let result = sqlx::query("DELETE FROM taunts WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "deleted": true })))
}
