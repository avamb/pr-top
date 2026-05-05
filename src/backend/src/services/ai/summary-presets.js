// T-08: Custom summary prompts per modality
//
// Therapists work in different modalities (psychoanalysis, CBT, NLP, gestalt,
// generic supportive). Each modality emphasizes different aspects of a session
// — transference vs cognitive distortions vs reframing language vs here-and-now
// awareness — so the AI summary the therapist actually finds useful is
// modality-specific.
//
// Per the Misha Drozd / Alexey interview (alexey_*_2026-04-* p.227-269), the
// presets live in code (NOT in DB) so they can evolve with the product. The
// therapist picks one of these from the Settings page; an optional custom
// prompt is appended (or fully replaces) the preset to fine-tune their AI's
// focus.
//
// Each preset returns a SYSTEM-PROMPT FRAGMENT inserted into the summarization
// system prompt under a "## Modality Focus" section. Fragments are intentionally
// distinct enough that running the same transcript through two different
// presets produces noticeably different summaries (smoke-test step 9).

const PRESETS = Object.freeze({
  psychoanalysis: {
    id: 'psychoanalysis',
    // Short label shown next to the dropdown option (i18n provides display name).
    description:
      'Psychoanalysis / depth-oriented work. Surface unconscious dynamics, transference and counter-transference cues, repetitive relational patterns, defensive structures, dreams and free-association material, and the therapeutic alliance itself as an instrument of change.',
    promptFragment: [
      '## Modality Focus: Psychoanalytic / Depth-Oriented',
      '',
      'The therapist works in a psychoanalytic / psychodynamic frame. Tailor the summary to surface:',
      '- Unconscious dynamics, repetitive relational patterns, and characterological themes',
      '- Transference toward the therapist and any counter-transference cues the client reports',
      '- Defensive structures (idealization, denial, splitting, etc.) and how they show up in the material',
      '- Free-association content, slips, dreams, fantasies and bodily sensations as meaningful data',
      '- Movement (or stuckness) in the therapeutic alliance — alliance is itself an instrument of change',
      '- Avoid behavioral checklists, homework framing, or symptom-tracking language',
      '- DO NOT reframe distortions or suggest cognitive techniques — that is a different modality'
    ].join('\n')
  },

  cbt: {
    id: 'cbt',
    description:
      'Cognitive-Behavioral Therapy. Emphasize automatic thoughts, cognitive distortions, behavioral patterns, homework outcomes, exposure progress, and concrete between-session action items.',
    promptFragment: [
      '## Modality Focus: Cognitive-Behavioral Therapy (CBT)',
      '',
      'The therapist works in a CBT frame. Tailor the summary to surface:',
      '- Automatic thoughts, beliefs and cognitive distortions named or implied in the material',
      '- The cognitive triangle (thoughts ↔ feelings ↔ behaviors) — call out the links explicitly',
      '- Behavioral patterns: avoidance, safety behaviors, activation, exposure attempts',
      '- Homework results from prior sessions and concrete homework / behavioral experiments for next session',
      '- SUDS / 0-100 ratings of distress, anxiety or mood when the client provides them',
      '- Progress against measurable goals; quantify when possible',
      '- Skip lengthy unconscious-dynamic interpretations — the therapist is looking for actionable cognitive and behavioral data'
    ].join('\n')
  },

  nlp: {
    id: 'nlp',
    description:
      'NLP / strategic / brief therapy. Highlight outcome framing, representational systems, reframing moves, anchors, presuppositions in language, state changes, and ecology checks.',
    promptFragment: [
      '## Modality Focus: NLP / Strategic / Brief Therapy',
      '',
      'The therapist works in an NLP / strategic frame. Tailor the summary to surface:',
      '- Outcome framing — what the client wants instead of the problem (well-formed outcomes)',
      '- Representational systems and submodality shifts (visual, auditory, kinesthetic) when present',
      '- Reframing moves, presuppositions in the client\'s language, and meta-model violations the therapist responded to',
      '- State changes, anchors set or fired during the session',
      '- Ecology checks and secondary gains',
      '- Before / after states and the specific intervention that produced any shift',
      '- Avoid pathologizing language; track resourceful states and the strategy that produced them'
    ].join('\n')
  },

  gestalt: {
    id: 'gestalt',
    description:
      'Gestalt therapy. Emphasize here-and-now awareness, contact and contact-boundary disturbances, body cues, emerging figure / ground, unfinished business, polarities, and experiments at the contact boundary.',
    promptFragment: [
      '## Modality Focus: Gestalt Therapy',
      '',
      'The therapist works in a Gestalt frame. Tailor the summary to surface:',
      '- Here-and-now awareness — what was figural for the client during the session itself',
      '- Body cues, sensations, posture shifts, breath — as primary phenomena, not background',
      '- Contact and contact-boundary disturbances (introjection, projection, retroflection, deflection, confluence)',
      '- Emerging figure / ground, polarities and topdog–underdog dialogues',
      '- Unfinished business and where the client deflected from completion',
      '- Experiments proposed or run at the contact boundary, and what new awareness emerged',
      '- Avoid interpretation-heavy or homework-centric framing — the change happens in awareness, not insight'
    ].join('\n')
  },

  generic: {
    id: 'generic',
    description:
      'Generic / integrative supportive frame. Balanced themes, observations, client-reported progress and follow-up areas — modality-neutral. This is the default for new and unspecified therapists.',
    promptFragment: [
      '## Modality Focus: Generic / Integrative Supportive',
      '',
      'The therapist has not specified a single modality. Provide a balanced, modality-neutral summary:',
      '- Key themes and concerns the client raised',
      '- Observations the therapist might find useful regardless of orientation',
      '- Client-reported progress and changes since the last session',
      '- Follow-up areas the therapist might want to revisit',
      '- Use neutral, observational language; avoid committing to any single theoretical frame'
    ].join('\n')
  }
});

const VALID_SPECIALIZATIONS = Object.freeze(Object.keys(PRESETS));
const DEFAULT_SPECIALIZATION = 'generic';

// Hard cap on therapist-supplied custom prompt size. ~2000 chars per the spec
// keeps system-prompt token budget predictable and prevents abuse / prompt
// injection of an arbitrarily large payload.
const CUSTOM_PROMPT_MAX_LENGTH = 2000;

/**
 * Look up a preset by id. Falls back to the generic preset on unknown / null.
 * Always returns a non-null preset so callers never have to null-check.
 *
 * @param {string|null|undefined} specialization
 * @returns {{id: string, description: string, promptFragment: string}}
 */
function getPreset(specialization) {
  if (!specialization || !PRESETS[specialization]) {
    return PRESETS[DEFAULT_SPECIALIZATION];
  }
  return PRESETS[specialization];
}

/**
 * Validate a candidate specialization id.
 * @param {string} specialization
 * @returns {boolean}
 */
function isValidSpecialization(specialization) {
  return typeof specialization === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, specialization);
}

/**
 * Build the modality-focus section that gets appended to the summarization
 * system prompt. The therapist's custom prompt (if any) is layered on top.
 *
 * mode='append'  (default): preset fragment + custom prompt as additional notes
 * mode='replace': custom prompt replaces the preset fragment entirely
 *
 * Always returns a string (possibly empty) — never null.
 *
 * @param {object} options
 * @param {string} [options.specialization] - one of VALID_SPECIALIZATIONS
 * @param {string|null} [options.customPrompt] - therapist-supplied prompt (<=2000 chars)
 * @param {'append'|'replace'} [options.customPromptMode='append']
 * @returns {string}
 */
function buildModalitySection({ specialization, customPrompt, customPromptMode } = {}) {
  const preset = getPreset(specialization);
  const mode = customPromptMode === 'replace' ? 'replace' : 'append';
  const trimmedCustom = typeof customPrompt === 'string'
    ? customPrompt.trim().slice(0, CUSTOM_PROMPT_MAX_LENGTH)
    : '';

  if (mode === 'replace' && trimmedCustom.length > 0) {
    return [
      '## Modality Focus: Custom (therapist-defined)',
      '',
      trimmedCustom
    ].join('\n');
  }

  // Append mode (default): preset fragment, optionally followed by custom prompt.
  if (trimmedCustom.length === 0) {
    return preset.promptFragment;
  }

  return [
    preset.promptFragment,
    '',
    '### Therapist\'s additional summarization notes',
    trimmedCustom
  ].join('\n');
}

/**
 * Convenience: list of presets for the Settings UI dropdown. The frontend
 * adds its own i18n labels — this just exposes the canonical id list and
 * the (English) description for use as a fallback / hint string.
 *
 * @returns {Array<{id:string, description:string}>}
 */
function listPresets() {
  return VALID_SPECIALIZATIONS.map(id => ({
    id,
    description: PRESETS[id].description
  }));
}

module.exports = {
  PRESETS,
  VALID_SPECIALIZATIONS,
  DEFAULT_SPECIALIZATION,
  CUSTOM_PROMPT_MAX_LENGTH,
  getPreset,
  isValidSpecialization,
  buildModalitySection,
  listPresets
};
