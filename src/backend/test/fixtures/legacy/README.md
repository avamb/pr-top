# Legacy module fixtures

Verbatim copies of two backend modules as they were before the wave-3 changes
(commit 03907e7, taken with `git show HEAD:<path>` on 2026-11-09):

- `encryption.head.js`    from `src/backend/src/services/encryption.js` (AES-CBC era, PBKDF2 salt "rotation")
- `backupService.head.js` from `src/backend/src/services/backupService.js` (sync gzip, AES-256-CBC backups)

They are NOT used by the application. The tests load them (`loadLegacy()` in
`test/helpers/wave3-o.js`) to produce ciphertext and backup files exactly as the
old code did, to prove the current code still reads and restores them. Do not
edit them and do not "modernise" them; if the legacy format ever stops being
supported, delete the fixtures together with the tests that use them.
