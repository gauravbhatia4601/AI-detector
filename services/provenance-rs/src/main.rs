use std::{env, net::SocketAddr, path::Path};

use axum::{
    extract::{DefaultBodyLimit, Multipart, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::Serialize;
use tokio::fs;
use tracing::{error, info};

use provenance_rs::{
    interpret_bytes, parse_allow_list, ProvenanceError, RemoteLoader, TrustedIssuers,
};

#[derive(Clone)]
struct AppState {
    trusted: TrustedIssuers,
    remote: RemoteLoader,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_target(false)
        .init();

    let trusted = TrustedIssuers::new(
        read_env_file("PROVENANCE_TRUSTED_CERT_BUNDLE").await?,
        read_env_file("PROVENANCE_TRUSTED_TRUST_LIST").await?,
    );
    let remote_enabled = env::var("PROVENANCE_ENABLE_REMOTE")
        .map(|value| matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);
    let remote_allow = env::var("PROVENANCE_REMOTE_ALLOW_LIST")
        .map(|value| parse_allow_list(&value))
        .unwrap_or_else(|_| Vec::new());
    let remote = if remote_enabled {
        RemoteLoader::new(true, remote_allow)
    } else {
        RemoteLoader::disabled()
    };

    let state = AppState { trusted, remote };

    let app = Router::new()
        .route("/verify", post(verify))
        .layer(DefaultBodyLimit::max(25 * 1024 * 1024))
        .with_state(state);

    let bind_addr: SocketAddr = env::var("PROVENANCE_BIND")
        .unwrap_or_else(|_| "0.0.0.0:8080".to_owned())
        .parse()?;

    info!("listening on {}", bind_addr);
    axum::serve(tokio::net::TcpListener::bind(bind_addr).await?, app).await?;
    Ok(())
}

async fn read_env_file(var: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
    let path = match env::var(var) {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return Ok(None),
    };

    match fs::read_to_string(Path::new(&path)).await {
        Ok(contents) => Ok(Some(contents)),
        Err(err) => {
            error!(%path, ?err, "failed to read trusted issuer file");
            Ok(None)
        }
    }
}

async fn verify(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let mut data: Option<Vec<u8>> = None;
    let mut remote_url: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| into_error(ProvenanceError::Multipart(err.to_string())))?
    {
        let name = field.name().map(str::to_owned);
        match name.as_deref() {
            Some("file") | Some("asset") | Some("data") => {
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|err| into_error(ProvenanceError::Multipart(err.to_string())))?;
                data = Some(bytes.to_vec());
            }
            Some("url") => {
                let text = field
                    .text()
                    .await
                    .map_err(|err| into_error(ProvenanceError::Multipart(err.to_string())))?;
                remote_url = Some(text);
            }
            _ => {}
        }
    }

    let bytes = if let Some(bytes) = data {
        bytes
    } else if let Some(url) = remote_url {
        let parsed = url::Url::parse(&url)
            .map_err(|_| into_error(ProvenanceError::InvalidUrl(url.clone())))?;
        state.remote.fetch(&parsed).await.map_err(into_error)?
    } else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "missing file or url field".into(),
            }),
        ));
    };

    let report = interpret_bytes(&bytes, &state.trusted).map_err(into_error)?;
    Ok((StatusCode::OK, Json(report)))
}

fn into_error(err: ProvenanceError) -> (StatusCode, Json<ErrorResponse>) {
    let status = match err {
        ProvenanceError::UnsupportedMediaType => StatusCode::UNSUPPORTED_MEDIA_TYPE,
        ProvenanceError::ManifestMissing => StatusCode::UNPROCESSABLE_ENTITY,
        ProvenanceError::RemoteDisabled | ProvenanceError::RemoteUrlNotAllowed(_) => {
            StatusCode::FORBIDDEN
        }
        ProvenanceError::InvalidUrl(_) => StatusCode::BAD_REQUEST,
        ProvenanceError::RemoteStatus(_) => StatusCode::BAD_GATEWAY,
        ProvenanceError::Network(_) => StatusCode::BAD_GATEWAY,
        ProvenanceError::Multipart(_) => StatusCode::BAD_REQUEST,
        ProvenanceError::C2pa(_) => StatusCode::UNPROCESSABLE_ENTITY,
    };
    (
        status,
        Json(ErrorResponse {
            error: err.to_string(),
        }),
    )
}
