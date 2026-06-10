use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};

use crate::error::{AppError, AppResult};
use crate::models::Game;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_games))
        .route("/{slug}", get(get_game))
}

async fn list_games(State(state): State<AppState>) -> AppResult<Json<Vec<Game>>> {
    let games = sqlx::query_as::<_, Game>(
        "SELECT * FROM games WHERE active = TRUE ORDER BY created_at",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(games))
}

async fn get_game(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Json<Game>> {
    let game = sqlx::query_as::<_, Game>("SELECT * FROM games WHERE slug = $1")
        .bind(&slug)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(game))
}
