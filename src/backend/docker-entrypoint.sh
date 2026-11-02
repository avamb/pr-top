#!/bin/sh
# Container entrypoint: fix volume ownership as root, then run node as the
# unprivileged "node" user (finding H16).
#
# Existing production volumes (backend-data, backend-uploads, backend-backups)
# were created by earlier root-running images, so they are root-owned. A bare
# `USER node` would make every write (SQLite save, uploads, backups) fail with
# EACCES. Instead the image starts as root, repairs ownership of the writable
# directories only when something in them is not yet owned by node, and then
# drops privileges with su-exec. After the first start the check is a cheap
# stat-only walk and no chown happens.
#
# Process tree (compose `init: true`): docker-init -> this script -> (exec)
# su-exec -> (exec) node, so node is a direct child of docker-init and
# healthcheck.sh (which runs as root via `docker exec`) can still SIGKILL it.
set -e

if [ "$(id -u)" = "0" ]; then
  for dir in /app/data /app/data/sessions /app/backups "${BACKUP_DIR:-}"; do
    [ -n "$dir" ] || continue
    mkdir -p "$dir"
    # -xdev: do not cross into a different mount (each volume is handled by its own entry).
    if [ -n "$(find "$dir" -xdev ! -user node -print -quit 2>/dev/null)" ]; then
      echo "entrypoint: fixing ownership of $dir"
      # -xdev is not available for chown -R; chown top dir, then every foreign
      # entry on the same filesystem.
      find "$dir" -xdev ! -user node -exec chown node:node {} +
    fi
  done
  exec su-exec node "$@"
fi

# Already running unprivileged (e.g. `docker run --user node`): just exec.
exec "$@"
