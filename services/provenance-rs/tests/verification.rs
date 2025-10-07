use base64::{engine::general_purpose::STANDARD, Engine as _};
use c2pa::ValidationState;
use provenance_rs::{interpret_bytes, ProvenanceError, TrustedIssuers};

fn decode_fixture(name: &str) -> Vec<u8> {
    let encoded = match name {
        "valid" => include_str!("fixtures/valid_base64.txt"),
        "invalid_signature" => include_str!("fixtures/invalid_signature_base64.txt"),
        "stripped" => include_str!("fixtures/stripped_base64.txt"),
        other => panic!("unexpected fixture name: {other}"),
    };
    STANDARD
        .decode(encoded.trim())
        .expect("fixtures should contain valid base64")
}

#[test]
fn valid_manifest_produces_report() {
    let bytes = decode_fixture("valid");
    let trusted = TrustedIssuers::default();
    let report = interpret_bytes(&bytes, &trusted).expect("expected valid manifest");
    assert!(report.issuer.is_some(), "issuer should be present");
    assert!(
        !report.certificate_chain.is_empty(),
        "certificate chain should not be empty"
    );
    assert!(matches!(
        report.validation_state,
        ValidationState::Valid | ValidationState::Trusted
    ));
    assert!(!report.claims.is_empty(), "expected at least one claim");
}

#[test]
fn invalid_signature_is_detected() {
    let bytes = decode_fixture("invalid_signature");
    let trusted = TrustedIssuers::default();
    let report = interpret_bytes(&bytes, &trusted).expect("manifest should still be parsed");
    assert_eq!(report.validation_state, ValidationState::Invalid);
    assert!(
        report
            .validation_status
            .iter()
            .any(|code| code.contains("mismatch") || code.contains("invalid")),
        "expected mismatch or invalid status"
    );
}

#[test]
fn stripped_manifest_returns_error() {
    let bytes = decode_fixture("stripped");
    let trusted = TrustedIssuers::default();
    let err = interpret_bytes(&bytes, &trusted).expect_err("expected missing manifest error");
    assert!(matches!(err, ProvenanceError::ManifestMissing));
}
