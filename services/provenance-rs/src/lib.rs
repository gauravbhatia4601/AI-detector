use c2pa::{
    assertions::{Actions, SoftwareAgent},
    settings::{self, Settings},
    validation_status::ValidationStatus,
    Reader, ValidationState,
};
use reqwest::StatusCode as HttpStatusCode;
use serde::Serialize;
use std::{io::Cursor, sync::Arc};
use thiserror::Error;
use url::Url;

/// Summary of the provenance information extracted from an asset.
#[derive(Debug, Clone, Serialize)]
pub struct Interpretation {
    /// The human readable issuer of the signing credential, if present.
    pub issuer: Option<String>,
    /// The certificate chain presented by the signing credential encoded as PEM blocks.
    pub certificate_chain: Vec<String>,
    /// The list of edits recorded in the manifest actions assertion.
    pub edits: Vec<Edit>,
    /// A summary of every manifest claim discovered in the asset.
    pub claims: Vec<ClaimSummary>,
    /// The validation state reported by the verifier.
    pub validation_state: ValidationState,
    /// The raw validation status codes returned by the verifier.
    pub validation_status: Vec<String>,
}

/// Summary of an individual edit entry from the manifest actions assertion.
#[derive(Debug, Clone, Serialize)]
pub struct Edit {
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub software_agent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Summary information extracted for a manifest claim.
#[derive(Debug, Clone, Serialize)]
pub struct ClaimSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generator: Option<String>,
    pub ingredients: Vec<IngredientSummary>,
}

/// Summary of an ingredient referenced by a manifest.
#[derive(Debug, Clone, Serialize)]
pub struct IngredientSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relationship: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest: Option<String>,
}

/// Errors that can be returned when verifying provenance data.
#[derive(Debug, Error)]
pub enum ProvenanceError {
    #[error("unsupported media type")]
    UnsupportedMediaType,
    #[error("asset does not contain a C2PA manifest")]
    ManifestMissing,
    #[error("c2pa error: {0}")]
    C2pa(#[from] c2pa::Error),
    #[error("remote loading is disabled")]
    RemoteDisabled,
    #[error("remote url not allowed: {0}")]
    RemoteUrlNotAllowed(String),
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("unexpected remote status: {0}")]
    RemoteStatus(HttpStatusCode),
    #[error("invalid url: {0}")]
    InvalidUrl(String),
    #[error("multipart error: {0}")]
    Multipart(String),
}

/// A helper that maintains trusted issuer configuration for the verifier.
#[derive(Debug, Clone, Default)]
pub struct TrustedIssuers {
    config: Option<Arc<str>>,
}

impl TrustedIssuers {
    pub fn new(anchors_pem: Option<String>, trust_list_json: Option<String>) -> Self {
        let config = if anchors_pem.as_ref().is_some() || trust_list_json.as_ref().is_some() {
            let mut toml = String::from("[trust]\nverify_trust_list = true\n");
            if let Some(pem) = anchors_pem.as_ref() {
                toml.push_str("user_anchors = ");
                toml.push_str(&multiline_value(pem));
            }
            if let Some(json) = trust_list_json.as_ref() {
                toml.push_str("trust_config = ");
                toml.push_str(&multiline_value(json));
            }
            toml.push_str("[verify]\nverify_trust = true\n");
            Some(Arc::from(toml.into_boxed_str()))
        } else {
            None
        };
        Self { config }
    }

    pub fn apply(&self) -> Result<(), ProvenanceError> {
        settings::reset_default_settings()?;
        if let Some(config) = &self.config {
            Settings::from_toml(config)?;
        }
        Ok(())
    }
}

/// Loader capable of retrieving remote assets when remote verification is enabled.
#[derive(Clone)]
pub struct RemoteLoader {
    client: reqwest::Client,
    allowed: Arc<[AllowedUrl]>,
    enabled: bool,
}

impl RemoteLoader {
    pub fn disabled() -> Self {
        Self {
            client: reqwest::Client::new(),
            allowed: Arc::from([]),
            enabled: false,
        }
    }

    pub fn new(enabled: bool, allowed: Vec<AllowedUrl>) -> Self {
        Self {
            client: reqwest::Client::new(),
            allowed: allowed.into(),
            enabled,
        }
    }

    pub fn enabled(&self) -> bool {
        self.enabled
    }

    fn is_allowed(&self, url: &Url) -> bool {
        self.allowed.iter().any(|allowed| allowed.matches(url))
    }

    pub async fn fetch(&self, url: &Url) -> Result<Vec<u8>, ProvenanceError> {
        if !self.enabled {
            return Err(ProvenanceError::RemoteDisabled);
        }

        if !self.is_allowed(url) {
            return Err(ProvenanceError::RemoteUrlNotAllowed(url.to_string()));
        }

        let response = self.client.get(url.clone()).send().await?;
        let response = response.error_for_status().map_err(|err| {
            if let Some(status) = err.status() {
                ProvenanceError::RemoteStatus(status)
            } else {
                ProvenanceError::Network(err)
            }
        })?;
        let body = response.bytes().await?;
        Ok(body.to_vec())
    }
}

/// Allow list rule describing which remote URLs may be downloaded.
#[derive(Clone)]
pub enum AllowedUrl {
    Host(String),
    Prefix(Url),
}

impl AllowedUrl {
    pub fn host<S: Into<String>>(host: S) -> Self {
        Self::Host(host.into())
    }

    pub fn prefix(url: Url) -> Self {
        Self::Prefix(url)
    }

    fn matches(&self, candidate: &Url) -> bool {
        match self {
            AllowedUrl::Host(host) => candidate
                .host_str()
                .map(|h| h.eq_ignore_ascii_case(host))
                .unwrap_or(false),
            AllowedUrl::Prefix(prefix) => {
                if candidate.scheme() != prefix.scheme() {
                    return false;
                }
                if candidate.port_or_known_default() != prefix.port_or_known_default() {
                    return false;
                }
                if candidate
                    .host_str()
                    .zip(prefix.host_str())
                    .map(|(lhs, rhs)| lhs.eq_ignore_ascii_case(rhs))
                    .unwrap_or(false)
                {
                    candidate.path().starts_with(prefix.path())
                } else {
                    false
                }
            }
        }
    }
}

/// Interpret the provenance metadata embedded in `bytes`.
pub fn interpret_bytes(
    bytes: &[u8],
    trusted: &TrustedIssuers,
) -> Result<Interpretation, ProvenanceError> {
    if bytes.is_empty() {
        return Err(ProvenanceError::UnsupportedMediaType);
    }

    trusted.apply()?;

    let format = infer::get(bytes)
        .map(|k| k.mime_type().to_string())
        .ok_or(ProvenanceError::UnsupportedMediaType)?;

    let mut cursor = Cursor::new(bytes);
    let reader = Reader::from_stream(&format, &mut cursor).map_err(|err| match err {
        c2pa::Error::JumbfNotFound => ProvenanceError::ManifestMissing,
        other => ProvenanceError::C2pa(other),
    })?;

    let validation_state = reader.validation_state();
    let validation_status = reader
        .validation_status()
        .map(|status| {
            status
                .iter()
                .map(ValidationStatus::code)
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default();

    let manifest = reader
        .active_manifest()
        .ok_or(ProvenanceError::ManifestMissing)?;

    let issuer = manifest.issuer();
    let certificate_chain = manifest
        .signature_info()
        .map(|info| parse_pem_chain(info.cert_chain()))
        .unwrap_or_default();

    let edits = manifest
        .find_assertion::<Actions>(Actions::LABEL)
        .map(|actions| {
            actions
                .actions()
                .iter()
                .map(|action| Edit {
                    action: action.action().to_string(),
                    when: action.when().map(|value| value.to_string()),
                    software_agent: action.software_agent().map(|agent| match agent {
                        SoftwareAgent::String(value) => value.clone(),
                        SoftwareAgent::ClaimGeneratorInfo(info) => info.name.clone(),
                    }),
                    description: action.description().map(|value| value.to_string()),
                })
                .collect()
        })
        .unwrap_or_default();

    let claims = reader
        .iter_manifests()
        .map(|manifest| ClaimSummary {
            label: manifest.label().map(|value| value.to_string()),
            title: manifest.title().map(|value| value.to_string()),
            format: manifest.format().map(|value| value.to_string()),
            generator: manifest.claim_generator().map(|value| value.to_string()),
            ingredients: manifest
                .ingredients()
                .iter()
                .map(|ingredient| IngredientSummary {
                    title: ingredient.title().map(|value| value.to_string()),
                    format: ingredient.format().map(|value| value.to_string()),
                    document_id: ingredient.document_id().map(|value| value.to_string()),
                    relationship: Some(format!("{:?}", ingredient.relationship())),
                    manifest: ingredient.active_manifest().map(|value| value.to_string()),
                })
                .collect(),
        })
        .collect();

    Ok(Interpretation {
        issuer,
        certificate_chain,
        edits,
        claims,
        validation_state,
        validation_status,
    })
}

fn parse_pem_chain(pem_blob: &str) -> Vec<String> {
    let mut chain = Vec::new();
    let mut current = Vec::new();
    for line in pem_blob.lines() {
        if line.starts_with("-----BEGIN ") {
            current.clear();
            current.push(line.trim().to_owned());
        } else if line.starts_with("-----END ") {
            current.push(line.trim().to_owned());
            chain.push(current.join("\n"));
            current.clear();
        } else if !current.is_empty() {
            current.push(line.trim().to_owned());
        }
    }
    chain
}

/// Parse a comma or newline separated allow list string into [`AllowedUrl`] rules.
pub fn parse_allow_list(spec: &str) -> Vec<AllowedUrl> {
    spec.split(|c| matches!(c, ',' | '\n'))
        .filter_map(|token| {
            let trimmed = token.trim();
            if trimmed.is_empty() {
                return None;
            }
            if let Ok(url) = Url::parse(trimmed) {
                Some(AllowedUrl::prefix(url))
            } else {
                Some(AllowedUrl::host(trimmed))
            }
        })
        .collect()
}

fn multiline_value(value: &str) -> String {
    let mut body = String::from("\"\"\"\n");
    body.push_str(value);
    if !value.ends_with('\n') {
        body.push('\n');
    }
    body.push_str("\"\"\"\n");
    body
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_chain_extracts_multiple_blocks() {
        let pem = format!(
            "{begin}\nAAA\n{end}\n{begin}\nBBB\n{end}\n",
            begin = "-----BEGIN CERTIFICATE-----",
            end = "-----END CERTIFICATE-----"
        );
        let chain = parse_pem_chain(&pem);
        assert_eq!(chain.len(), 2);
        assert!(chain[0].contains("AAA"));
    }

    #[test]
    fn parse_allow_list_mixes_hosts_and_urls() {
        let rules = parse_allow_list("example.com, https://example.net/base");
        assert_eq!(rules.len(), 2);
        match &rules[0] {
            AllowedUrl::Host(host) => assert_eq!(host, "example.com"),
            _ => panic!("expected host"),
        }
        match &rules[1] {
            AllowedUrl::Prefix(url) => assert_eq!(url.host_str(), Some("example.net")),
            _ => panic!("expected prefix"),
        }
    }
}
