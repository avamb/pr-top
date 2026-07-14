<!-- audience: public -->
# Regression fixture — R23c lookbehind precision fix

This file is a **test fixture** for `node _t_assistant_kb_audit.js` section 12k.
It contains three ungated tier-restriction claims in compound hyphenated form.
The old R23b lookbehind excluded all hyphenated forms and missed these claims.
The R23c fix must flag all three as failures.

Do NOT add gate annotations to this file — it is the NEGATIVE case.

## Feature gating — compound form

The diary is Premium-only for all clients.

Pro-only voice queries let therapists search the knowledge base using natural language.

Basic-only clients have limited access to session history and cannot use advanced export.
