use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::RageStats;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/{slug}/me", get(my_stats))
        .route("/{slug}/taunt", get(random_taunt))
}

async fn game_id_by_slug(state: &AppState, slug: &str) -> AppResult<Uuid> {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM games WHERE slug = $1")
        .bind(slug)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)
}

/// Estatisticas de raiva do jogador logado num jogo.
async fn my_stats(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(slug): Path<String>,
) -> AppResult<Json<RageStats>> {
    let game_id = game_id_by_slug(&state, &slug).await?;

    let stats = sqlx::query_as::<_, RageStats>(
        "SELECT COUNT(*)::bigint                                  AS total_runs,
                COALESCE(SUM(deaths), 0)::bigint                  AS total_deaths,
                MAX(score)::int                                   AS best_score,
                MAX(duration_seconds)::int                        AS longest_run_seconds,
                COUNT(*) FILTER (WHERE completed)::bigint         AS completed_runs
         FROM runs
         WHERE player_id = $1 AND game_id = $2",
    )
    .bind(claims.sub)
    .bind(game_id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(stats))
}

/// Uma frase zombeteira aleatoria para jogar na cara do jogador quando ele morre.
async fn random_taunt(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Json<Value>> {
    let game_id = game_id_by_slug(&state, &slug).await?;

    let text = sqlx::query_scalar::<_, String>(
        "SELECT text FROM taunts
         WHERE active = TRUE AND (game_id = $1 OR game_id IS NULL)
         ORDER BY random()
         LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.pool)
    .await?
    .unwrap_or_else(|| "Voce perdeu. De novo.".to_string());

    Ok(Json(json!({ "taunt": text })))
}
