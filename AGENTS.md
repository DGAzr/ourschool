Be concise and use plain language.

## Storage policy

- Keep school records completely exportable and restorable through the JSON backup.
- Do not add database blob storage or inline base64 files for assignments, lesson work, journals, reflections, or other new features. Do not replace it with a separate file store that makes JSON backups incomplete.
- Shop images and the school logo are the explicitly approved image exceptions. Preserve their JSON backup and restore support.
- The existing Paperless thumbnail cache is derived, regenerable data, not a canonical school record. Preserve that integration without extending this exception to student uploads.
- Student completion supports showing physical work to the teacher, optional text notes, and existing external links. Reflections support text and mood; no file or photo uploads.
- Rewrite unpublished feature migrations when removing an unpublished feature. Do not add a create-then-remove migration sequence for it. Preserve published migration history.
