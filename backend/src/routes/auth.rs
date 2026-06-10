use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::auth::{create_token, hash_password, verify_password, AuthUser};
use crate::error::{AppError, AppResult};
use crate::models::{Player, PlayerPublic};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/me", get(me))
}

#[derive(Deserialize, Validate)]
struct RegisterInput {
    #[validate(length(min = 3, max = 20, message = "username de 3 a 20 caracteres"))]
    username: String,
    #[validate(email(message = "email invalido"))]
    email: String,
    #[validate(length(min = 6, message = "senha de no minimo 6 caracteres"))]
    password: String,
}

#[derive(Deserialize)]
struct LoginInput {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct AuthResponse {
    token: String,
    player: PlayerPublic,
}

async fn register(
    State(state): State<AppState>,
    Json(input): Json<RegisterInput>,
) -> AppResult<Json<AuthResponse>> {
    input
        .validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let password_hash = hash_password(&input.password)?;

    let player = sqlx::query_as::<_, Player>(
        "INSERT INTO players (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING *",
    )
    .bind(&input.username)
    .bind(&input.email)
    .bind(&password_hash)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match &e {
        sqlx::Error::Database(db) if db.is_unique_violation() => {
            AppError::Conflict("username ou email ja em uso".into())
        }
        _ => AppError::Database(e),
    })?;

    let token = create_token(&state.config.jwt_secret, player.id, &player.username, player.is_admin)?;
    Ok(Json(AuthResponse {
        token,
        player: player.into(),
    }))
}

async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginInput>,
) -> AppResult<Json<AuthResponse>> {
    let player = sqlx::query_as::<_, Player>("SELECT * FROM players WHERE email = $1")
        .bind(&input.email)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::Unauthorized)?;

    if !verify_password(&input.password, &player.password_hash) {
        return Err(AppError::Unauthorized);
    }

    let token = create_token(&state.config.jwt_secret, player.id, &player.username, player.is_admin)?;
    Ok(Json(AuthResponse {
        token,
        player: player.into(),
    }))
}

async fn me(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
) -> AppResult<Json<PlayerPublic>> {
    let player = sqlx::query_as::<_, Player>("SELECT * FROM players WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(player.into()))
}
