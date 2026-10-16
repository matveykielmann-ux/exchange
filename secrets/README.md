# Secrets directory (do not commit key material)

`configure-env.sh` may write `DATA_ENCRYPTION_KEY.offline` here when it generates a **new** encryption key.

- Mode `700` on this directory, `600` on key files.
- Copy the key into a password manager / offline vault immediately.
- Losing `DATA_ENCRYPTION_KEY` makes encrypted DB fields and `FILES_DIR` blobs permanently unreadable.
- Never rotate the key on a live database without a deliberate re-encryption project.
- This path is gitignored except for this README.
