# JSON backup and restore

The 1.1 release candidate source uses backup format **2.6**. Deploy the frontend and backend together, apply migrations, and then create a fresh JSON backup. Registry deployments default to the published `v1.1-beta5` image; set `IMAGE_TAG` to the candidate tag once it is published. The forward migration adds stable identities to existing assignments, work sessions, journal entries and replies, point transactions, and grade history without replacing published migrations.

Format 2.6 preserves repeated assignments, lesson ownership, work-session and point-source links, journal replies and exact timestamps, grading history and attribution, parent relationships, assignment type settings and weights, and reward transaction links. A preview runs the actual restore operations inside a rolled-back transaction. A failed import also rolls back the entire operation, including a requested wipe.

Merge keeps existing assignment type keys and their configuration by default; `update_existing_data=true` refreshes that configuration. Wipe restores replace assignment types when the backup includes them; older backups retain local type settings.

Formats 1.0 and 2.0–2.5 remain supported. Data those files never included cannot be reconstructed: examples include replies, category weights, parent identities, and assignment point sources. Ambiguous legacy assignment references cause restore to fail safely instead of attaching work to the wrong assignment. Legacy point transactions without source links carry a warning about regrading. Prefer a fresh 2.6 export whenever the original installation is available.

Credentials, browser sessions, and live Paperless connection secrets are excluded. Wipe-and-restore preserves the importing administrator's login and requires other restored users to reset their passwords. Restoring additional administrator accounts requires `allow_admin_import=true`; review those accounts before enabling it. Successful imports revoke browser sessions and require fresh login.

Shop images remain included in JSON backups. Imports validate size, strictly decode base64, and normalize decoded pixels; supplied MIME types and sizes are ignored. Unsafe existing image rows are blocked when served, including conditional requests. Run `python -m utils.audit_shop_images` against the intended database to list unsafe image identities without altering records; re-upload affected catalog images. School-logo backup support and the derived Paperless thumbnail cache retain their existing behavior.
