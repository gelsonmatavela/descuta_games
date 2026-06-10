mod auth;
mod config;
mod error;
mod models;
mod routes;

use axum::http::{HeaderValue, Method};
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rage_backend=debug,tower_http=debug,info".into()),
        )
        .init();

    let config = Config::from_env();

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .expect("falha ao conectar no banco");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("falha ao rodar migrations");

    let state = AppState {
        pool,
        config: config.clone(),
    };

    let origins: Vec<HeaderValue> = config
        .cors_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        .route("/health", get(health))
        .nest("/api/auth", routes::auth::router())
        .nest("/api/games", routes::games::router())
        .nest("/api/scores", routes::scores::router())
        .nest("/api/stats", routes::stats::router())
        .nest("/api/admin", routes::admin::router())
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("falha ao abrir porta");
    tracing::info!("backend ouvindo em http://{addr}");
    axum::serve(listener, app).await.expect("servidor caiu");
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "service": "rage-backend" }))
}
