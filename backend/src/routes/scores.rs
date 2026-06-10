use axum::extract::{Path, Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::{LeaderboardEntry, Run};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/{slug}/runs", post(submit_run))
        .route("/{slug}/leaderboard", get(leaderboard))
}

#[derive(Deserialize)]
struct SubmitRunInput {
    score: i32,
    deaths: i32,
    duration_seconds: i32,
    #[serde(default)]
    completed: bool,
}

#[derive(Deserialize)]
struct LeaderboardQuery {
    #[serde(default = "default_limit")]
    limit: i64,
}

fn default_limit() -> i64 {
    20
}

async fn game_id_by_slug(state: &AppState, slug: &str) -> AppResult<Uuid> {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM games WHERE slug = $1 AND active = TRUE")
        .bind(slug)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)
}

async fn submit_run(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(slug): Path<String>,
    Json(input): Json<SubmitRunInput>,
) -> AppResult<Json<Run>> {
    if input.score < 0 || input.deaths < 0 || input.duration_seconds < 0 {
        return Err(AppError::BadRequest("valores nao podem ser negativos".into()));
    }
    let game_id = game_id_by_slug(&state, &slug).await?;

    let run = sqlx::query_as::<_, Run>(
        "INSERT INTO runs (player_id, game_id, score, deaths, duration_seconds, completed)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *",
    )
    .bind(claims.sub)
    .bind(game_id)
    .bind(input.score)
    .bind(input.deaths)
    .bind(input.duration_seconds)
    .bind(input.completed)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(run))
}

async fn leaderboard(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(q): Query<LeaderboardQuery>,
) -> AppResult<Json<Vec<LeaderboardEntry>>> {
    let game_id = game_id_by_slug(&state, &slug).await?;
    let limit = q.limit.clamp(1, 100);

    let entries = sqlx::query_as::<_, LeaderboardEntry>(
        "SELECT r.player_id,
                p.username,
                MAX(r.score)::int        AS best_score,
                SUM(r.deaths)::bigint     AS total_deaths,
                COUNT(*)::bigint          AS runs
         FROM runs r
         JOIN players p ON p.id = r.player_id
         WHERE r.game_id = $1
         GROUP BY r.player_id, p.username
         ORDER BY best_score DESC
         LIMIT $2",
    )
    .bind(game_id)
    .bind(limit)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(entries))
}
