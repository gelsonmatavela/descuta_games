use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("recurso nao encontrado")]
    NotFound,

    #[error("nao autorizado")]
    Unauthorized,

    #[error("acesso negado")]
    Forbidden,

    #[error("{0}")]
    BadRequest(String),

    #[error("conflito: {0}")]
    Conflict(String),

    #[error(transparent)]
    Database(#[from] sqlx::Error),

    #[error(transparent)]
    Other(#[from] anyhow_lite::Error),
}

// Pequeno wrapper para erros genericos sem puxar a crate anyhow.
pub mod anyhow_lite {
    pub type Error = Box<dyn std::error::Error + Send + Sync>;
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            AppError::Conflict(_) => (StatusCode::CONFLICT, self.to_string()),
            AppError::Database(ref e) => {
                tracing::error!("erro de banco: {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "erro interno".to_string(),
                )
            }
            AppError::Other(ref e) => {
                tracing::error!("erro: {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "erro interno".to_string(),
                )
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
