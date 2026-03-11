// Feature #93: AI summary avoids diagnosis language - Final verification
const summary = `Session Summary
Generated: 2026-03-11T19:09:47.234Z
Transcript length: 110 words, 8 lines

Key Topics Discussed:
  - anxiety management
  - breathing exercises
  - work-related concerns
  - therapeutic exercises
  - progress and improvements

Session Observations:
  - Client reported on their experiences since the previous session
  - Discussion covered anxiety management, breathing exercises, work-related concerns
  - Multiple areas of focus addressed during the session

Client-Reported Progress:
  - Client described engagement with previously assigned exercises
  - Noted areas where they observed changes in their daily experience

Suggested Follow-up Areas:
  - Continue monitoring the topics discussed
  - Review effectiveness of current therapeutic approach
  - Consider adjusting exercise assignments based on client feedback

Note: This summary is a supportive tool for session preparation.
It reflects observed themes and client-reported experiences only.`;

const lower = summary.toLowerCase();
let allPass = true;

// Step 1: No DSM/ICD labels
console.log('--- Step 1: No DSM/ICD labels ---');
const diagLabels = [
  'major depressive disorder', 'generalized anxiety disorder',
  'post-traumatic stress disorder', 'bipolar disorder',
  'schizophrenia', 'obsessive-compulsive disorder',
  'attention deficit', 'borderline personality',
  'anorexia nervosa', 'bulimia nervosa',
  'dysthymia', 'panic disorder', 'psychosis', 'dissociative disorder',
  'F32', 'F33', 'F41', 'F43', 'ICD-10', 'DSM-5', 'DSM-IV'
];
const foundLabels = diagLabels.filter(l => lower.includes(l.toLowerCase()));
if (foundLabels.length === 0) {
  console.log('PASS: No DSM/ICD labels found');
} else {
  console.log('FAIL:', foundLabels);
  allPass = false;
}

// Step 2: Uses "client reports" not "client has [diagnosis]"
console.log('\n--- Step 2: Uses descriptive language ---');
if (/client has (depression|anxiety|disorder|PTSD|bipolar|OCD|diagnosis)/i.test(summary)) {
  console.log('FAIL: Found "client has [diagnosis]"');
  allPass = false;
} else {
  console.log('PASS: No "client has [diagnosis]" language');
}

if (/client report/i.test(summary)) {
  console.log('PASS: Uses "client reported" language');
} else {
  console.log('FAIL: Missing "client reported" language');
  allPass = false;
}

// Step 3: No overclaiming
console.log('\n--- Step 3: No overclaiming ---');
const overclaim = [
  'suffers from', 'is diagnosed with', 'exhibits symptoms of',
  'meets criteria for', 'clearly has', 'definitely', 'certainly suffering',
  'patient presents with'
];
const foundOC = overclaim.filter(p => lower.includes(p));
if (foundOC.length === 0) {
  console.log('PASS: No overclaiming language');
} else {
  console.log('FAIL:', foundOC);
  allPass = false;
}

// Step 4: Has supportive disclaimer
console.log('\n--- Step 4: Supportive tone ---');
const hasDisclaimer = lower.includes('supportive tool') && lower.includes('session preparation');
const hasObserved = lower.includes('observed themes') || lower.includes('client-reported experiences');
if (hasDisclaimer) {
  console.log('PASS: Has supportive tool disclaimer');
} else {
  console.log('FAIL: Missing supportive tool disclaimer');
  allPass = false;
}
if (hasObserved) {
  console.log('PASS: Refers to observed/client-reported experiences');
} else {
  console.log('NOTE: No explicit "observed themes" reference');
}

// Step 5: Uses "client described" (not assertive claims)
console.log('\n--- Step 5: Non-assertive language ---');
if (/client describ/i.test(summary)) {
  console.log('PASS: Uses "client described" phrasing');
} else {
  console.log('NOTE: No "client described" but other descriptive terms present');
}

// Summary
console.log('\n' + (allPass ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='));
