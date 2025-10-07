use std::net::SocketAddr;

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use provenance_rs::{verify_payload, AppState, LocalLoader, ProvenanceError, VerifyRequest};
use serde::Serialize;
use tower_http::trace::TraceLayer;
use tokio::net::TcpListener;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

#[derive(Clone)]
struct ApiState {
    inner: AppState<LocalLoader>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorResponse {
    error: String,
}

#[tokio::main]
async fn main() {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("set tracing subscriber");

    let state = ApiState {
        inner: AppState::new(LocalLoader::default(), provenance_rs::TrustedIssuers::new(vec![
            "Trusted Authority".to_string(),
            "Camera Inc".to_string(),
        ])),
    };

    let app = Router::new()
        .route("/verify", post(post_verify))
        .route("/manifest/:asset_id", get(get_manifest))
        .route("/health", get(get_health))
        .with_state(state)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = ([0, 0, 0, 0], 8080).into();
    let listener = TcpListener::bind(addr).await.unwrap();
    let local_addr = listener.local_addr().unwrap();
    info!(%local_addr, "listening");
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

async fn post_verify(
    State(state): State<ApiState>,
    Json(payload): Json<VerifyRequest>,
) -> Result<Json<provenance_rs::ProvenanceResult>, (axum::http::StatusCode, Json<ErrorResponse>)> {
    verify_payload(&state.inner, payload)
        .await
        .map(Json)
        .map_err(|err| map_error(err))
}

async fn get_manifest(
    State(state): State<ApiState>,
    Path(asset_id): Path<String>,
) -> Result<Json<provenance_rs::ProvenanceResult>, (axum::http::StatusCode, Json<ErrorResponse>)> {
    state
        .inner
        .manifest(&asset_id)
        .map(Json)
        .ok_or_else(|| {
            (
                axum::http::StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "asset not found".to_string(),
                }),
            )
        })
}

async fn get_health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

fn map_error(err: ProvenanceError) -> (axum::http::StatusCode, Json<ErrorResponse>) {
    use axum::http::StatusCode;
    let status = match err {
        ProvenanceError::MissingAssetId | ProvenanceError::EmptyPayload => StatusCode::BAD_REQUEST,
        ProvenanceError::Decode(_) => StatusCode::UNPROCESSABLE_ENTITY,
        ProvenanceError::RemoteNotAllowed => StatusCode::FORBIDDEN,
        ProvenanceError::UnsupportedPayload => StatusCode::UNPROCESSABLE_ENTITY,
    };

    (
        status,
        Json(ErrorResponse {
            error: err.to_string(),
        }),
    )
}
