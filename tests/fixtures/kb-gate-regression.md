<!-- audience: public -->
# Regression fixture — plan-gate bypass patterns (R23b)

This file is a **test fixture** for `node _t_assistant_kb_audit.js` section 12j.
It contains three ungated tier-restriction claims that bypassed the R23 detector
via three distinct evasion paths. The enhanced R23b detector (section 12i) must
flag all three as failures.

Do NOT add <!-- gate: ... --> annotations to this file — it is the NEGATIVE case.

## Plan downgrades

Trial, Basic, Pro, and Premium tiers all show the same dashboard
layout, but some cards (analytics, supervision share) are gated by plan.

If you downgrade from Pro or Premium to Basic
mid-cycle, the mood-trend strip stays visible until the end of the
billing period, then flips to a locked card.

Session transcript archive access is blocked on Basic
and Trial tiers after the billing period ends.
