.PHONY: test-provenance test-synthid test-sensity test-hive test-readef test-orchestrator test-video test-preservation test-sdk-ts test-sdk-py e2e fmt

test-provenance:
	cargo test --manifest-path services/provenance-rs/Cargo.toml

test-synthid:
	npm test --prefix services/watermark-synthid -- --run

test-sensity:
	cd services/detector-sensity && pytest

test-hive:
	npm test --prefix services/detector-hive -- --run

test-readef:
	cd services/detector-readef && pytest

test-orchestrator:
	npm test --prefix services/orchestrator -- --run

test-video:
	npm test --prefix services/video-pipeline -- --run

test-preservation:
	cd tests/preservation && pytest

test-sdk-ts:
	npm test --prefix sdks/typescript -- --run

test-sdk-py:
	cd sdks/python && pytest

e2e: test-provenance test-synthid test-sensity test-hive test-readef test-orchestrator test-video test-preservation test-sdk-ts test-sdk-py

fmt:
	cargo fmt --manifest-path services/provenance-rs/Cargo.toml
