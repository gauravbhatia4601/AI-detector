# CDN Preservation Guidance

This directory contains a sample configuration for Cloudflare Images that keeps
C2PA Content Credentials intact while media assets transit the CDN. The
`cloudflare-images.toml` file demonstrates how to configure delivery variants so
metadata is never stripped and downstream services can continue to verify
provenance manifests.

Key points:

- `content_credentials = "preserve"` forces Cloudflare to forward Content
  Credentials rather than re-encoding or dropping the manifest.
- `strip_metadata = false` prevents other EXIF/XMP fields from being removed,
  which is required for C2PA manifests embedded in standard metadata blocks.
- A dedicated upload bucket/variant keeps provenance-protected media separate
  from standard assets so compliance policies can be tuned independently.

Pair this configuration with the smoke test located in `tests/preservation/` to
ensure the manifest survives a simulated upload and download round trip.
