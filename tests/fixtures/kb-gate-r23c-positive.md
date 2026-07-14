<!-- audience: public -->
# Positive fixture — R23c lookbehind precision (annotated claims + read-only exclusion)

This file is a **test fixture** for `node _t_assistant_kb_audit.js` section 12k.
It demonstrates that:
1. The same three `*-only` tier claims from the regression fixture PASS when each
   carries a valid `<!-- gate: <id> -->` annotation.
2. The compound "read-only" adjective is correctly excluded — a sentence containing
   "read-only" and a tier name does NOT need a gate annotation because "read-only"
   is not a plan-gating word.

## Annotated tier claims

<!-- gate: nl-queries-pro -->
The diary is Premium-only for all clients.

<!-- gate: voice-queries-pro -->
Pro-only voice queries let therapists search the knowledge base using natural language.

<!-- gate: data-export-pro -->
Basic-only clients have limited access to session history and cannot use advanced export.

## read-only — correctly excluded (no annotation needed)

Supervisors get a read-only view on Premium clients when Supervision Share is active.
