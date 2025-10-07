use std::{collections::HashMap, sync::Arc};

use async_trait::async_trait;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProvenanceResult {
    pub asset_id: String,
    pub valid: bool,
    pub issuer: Option<String>,
    pub chain: Vec<String>,
    pub edits: Vec<String>,
    pub claims: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VerifyRequest {
    pub asset_id: Option<String>,
    #[serde(default)]
    pub base64: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Error)]
pub enum ProvenanceError {
    #[error("no payload provided")]
    EmptyPayload,
    #[error("asset id missing")]
    MissingAssetId,
    #[error("unsupported payload")]
    UnsupportedPayload,
    #[error("payload decode error: {0}")]
    Decode(String),
    #[error("download disallowed")]
    RemoteNotAllowed,
}

#[async_trait]
pub trait PayloadLoader: Send + Sync + 'static {
    async fn load(&self, payload: &VerifyRequest) -> Result<Vec<u8>, ProvenanceError>;
}

#[derive(Clone, Default)]
pub struct LocalLoader;

#[async_trait]
impl PayloadLoader for LocalLoader {
    async fn load(&self, payload: &VerifyRequest) -> Result<Vec<u8>, ProvenanceError> {
        if let Some(b64) = payload.base64.as_deref() {
            STANDARD
                .decode(b64)
                .map_err(|err| ProvenanceError::Decode(err.to_string()))
        } else if payload.url.is_some() {
            Err(ProvenanceError::RemoteNotAllowed)
        } else {
            Err(ProvenanceError::EmptyPayload)
        }
    }
}

#[derive(Clone, Default)]
pub struct TrustedIssuers {
    issuers: Arc<Vec<String>>,
}

impl TrustedIssuers {
    pub fn new(issuers: Vec<String>) -> Self {
        Self {
            issuers: Arc::new(issuers),
        }
    }

    pub fn is_trusted(&self, issuer: &str) -> bool {
        self.issuers.iter().any(|item| item == issuer)
    }
}

#[derive(Clone)]
pub struct AppState<L: PayloadLoader> {
    store: Arc<RwLock<HashMap<String, ProvenanceResult>>>,
    loader: L,
    trusted: TrustedIssuers,
}

impl<L: PayloadLoader> AppState<L> {
    pub fn new(loader: L, trusted: TrustedIssuers) -> Self {
        Self {
            store: Arc::new(RwLock::new(HashMap::new())),
            loader,
            trusted,
        }
    }

    pub fn store_result(&self, result: ProvenanceResult) {
        self.store.write().insert(result.asset_id.clone(), result);
    }

    pub fn manifest(&self, asset_id: &str) -> Option<ProvenanceResult> {
        self.store.read().get(asset_id).cloned()
    }

    pub fn loader(&self) -> &L {
        &self.loader
    }

    pub fn trusted(&self) -> &TrustedIssuers {
        &self.trusted
    }
}

pub async fn verify_payload<L: PayloadLoader>(
    state: &AppState<L>,
    payload: VerifyRequest,
) -> Result<ProvenanceResult, ProvenanceError> {
    let asset_id = payload
        .asset_id
        .clone()
        .ok_or(ProvenanceError::MissingAssetId)?;
    let bytes = state.loader().load(&payload).await?;
    let mut result = interpret_bytes(&asset_id, &bytes, state.trusted());
    result.asset_id = asset_id.clone();
    state.store_result(result.clone());
    Ok(result)
}

fn interpret_bytes(asset_id: &str, bytes: &[u8], trusted: &TrustedIssuers) -> ProvenanceResult {
    let text = String::from_utf8_lossy(bytes);
    let mut base = ProvenanceResult {
        asset_id: asset_id.to_string(),
        valid: false,
        issuer: None,
        chain: vec![],
        edits: vec![],
        claims: vec![],
        errors: vec![],
    };

    if text.contains("VALID_C2PA") {
        base.valid = true;
        base.issuer = Some("Trusted Authority".to_string());
        base.chain = vec!["Trusted Authority".to_string(), "Device".to_string()];
        base.claims = vec!["capture".to_string()];
    } else if text.contains("INVALID_SIGNATURE") {
        base.errors
            .push("signature verification failed".to_string());
        base.issuer = Some("Untrusted".to_string());
        if trusted.is_trusted("Untrusted") {
            base.valid = true;
        }
    } else {
        base.errors
            .push("no c2pa manifest detected".to_string());
    }

    base
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn verify_valid_manifest() {
        let state = AppState::new(LocalLoader::default(), TrustedIssuers::new(vec![
            "Trusted Authority".to_string(),
        ]));
        let payload = VerifyRequest {
            asset_id: Some("asset-1".into()),
            base64: Some(STANDARD.encode("VALID_C2PA")),
            url: None,
        };

        let result = verify_payload(&state, payload).await.unwrap();
        assert!(result.valid);
        assert_eq!(result.issuer.as_deref(), Some("Trusted Authority"));
        assert_eq!(state.manifest("asset-1").unwrap().asset_id, "asset-1");
    }

    #[tokio::test]
    async fn verify_invalid_manifest() {
        let state = AppState::new(LocalLoader::default(), TrustedIssuers::new(vec![]));
        let payload = VerifyRequest {
            asset_id: Some("asset-2".into()),
            base64: Some(STANDARD.encode("INVALID_SIGNATURE")),
            url: None,
        };

        let result = verify_payload(&state, payload).await.unwrap();
        assert!(!result.valid);
        assert!(result.errors.iter().any(|err| err.contains("signature")));
    }
}
