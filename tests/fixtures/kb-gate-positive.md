<!-- audience: public -->
# Positive fixture — correctly annotated tier claims through soft-wrap (R23b)

This file is a **test fixture** for `node _t_assistant_kb_audit.js` section 12j.
It contains the same three tier-restriction claims as the regression fixture, but each
is preceded by a valid `<!-- gate: nl-queries-pro -->` annotation. The enhanced R23b
sentence-level matcher must correctly identify all three as covered (0 failures).

The key test: annotations cover claims even when the gate word and tier name are split
across a soft-wrapped line break — something the old line-by-line scanner could not handle.

## Plan downgrades

<!-- gate: nl-queries-pro -->
Trial, Basic, Pro, and Premium tiers all show the same dashboard
layout, but some cards (analytics, supervision share) are gated by plan.

<!-- gate: nl-queries-pro -->
If you downgrade from Pro or Premium to Basic
mid-cycle, the mood-trend strip stays visible until the end of the
billing period, then flips to a locked card.

<!-- gate: nl-queries-pro -->
Session transcript archive access is blocked on Basic
and Trial tiers after the billing period ends.
