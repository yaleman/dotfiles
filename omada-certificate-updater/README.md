# Omada certificate updater

Keeps the certificate served by an Omada switch synchronized with a cert-manager TLS Secret.

The container is configured entirely through environment variables:

- `OMADA_USERNAME`
- `OMADA_PASSWORD`
- `OMADA_URL`
- `OMADA_K8S_NAMESPACE`
- `OMADA_K8S_SECRET_NAME`
- `OMADA_CERTIFICATE_NAME`
- `OMADA_EXPIRY_THRESHOLD_DAYS`
- `OMADA_RENEWAL_TIMEOUT_SECONDS`

Run the checks with `mise run test-omada-certificate-updater` from the dotfiles repository root.
To publish the multi-architecture image, set `OMADA_CERTIFICATE_UPDATER_IMAGE` to the complete image name and run
`mise run build-omada-certificate-updater`.
