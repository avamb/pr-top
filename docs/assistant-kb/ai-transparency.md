<!-- audience: public -->

# How AI processing works in PR-TOP

PR-TOP uses artificial intelligence to help therapists with session transcription,
note drafting, exercise generation, semantic search, and the between-session
chatbot assistant. This page gives a complete, factual account of every AI data
flow in the platform — which models are used, what data leaves PR-TOP, for what
purpose, where providers store it, what Data Processing Agreements (DPAs) cover
those flows, how long providers retain data, and how to disable AI features
entirely. All facts are anchored to the actual source code or to the provider's
published legal documents.

The dedicated public page at `/security/ai-processing` shows the same information
in a structured, localized format for therapists who want to share it with clients
or supervisors.

## 1. Which AI models are used

PR-TOP supports four configurable AI providers. The active provider and model are
chosen by the platform operator via environment variables — therapists do not
select a provider directly.

| Provider | Available models | Code reference |
|---|---|---|
| OpenAI | gpt-4o-mini, gpt-4.1-nano, gpt-4.1-mini, gpt-4o, gpt-4-turbo, o4-mini | `src/backend/src/services/aiProviders/openai.js:10` |
| Anthropic | claude-3.5-haiku, claude-4-sonnet | `src/backend/src/services/aiProviders/anthropic.js:11` |
| Google Gemini | gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro | `src/backend/src/services/aiProviders/google.js:10` |
| OpenRouter | Any of the above + deepseek, qwen, llama and hundreds of open-source models | `src/backend/src/services/aiProviders/openrouter.js:11` |

OpenRouter is a gateway that routes requests to the underlying provider, so when
OpenRouter is active the effective data residency depends on which provider
OpenRouter is configured to use.

The operator may deploy with a single provider or switch between providers without
changing the rest of the codebase. Ask the platform operator which provider is
currently active on your deployment.

## 2. What data leaves PR-TOP

Only the minimum data required to complete each AI task is sent to the provider.
No client names, Telegram user IDs, email addresses, or other personally
identifying fields are ever included in AI API calls.

**Session transcription.** Only the audio or video file is sent, for the duration
of the API call. No client identifiers, session notes, or diary entries accompany
the file.

**Session summarisation.** The decrypted transcript text is sent to the provider.
Decryption happens in memory immediately before the API call; the plaintext is
not written to any secondary location or log file.

**Exercise generation.** Only the therapist's plain-text instructions are sent.
No client diary entries, anamnesis records, or personal data are included.

**Semantic search.** Only the search query text is sent to generate a vector
embedding. No diary entries, session content, or personal data are included.

**Chatbot assistant.** The user's question and relevant excerpts from the PR-TOP
knowledge base are sent. The knowledge base contains product documentation
only — no client diary entries, session notes, or personal records.

In every case the data sent is the minimum required; no client identifiers are
attached to any AI request.

## 3. For what tasks AI is used

AI is invoked for the following discrete, therapist-initiated tasks only. Nothing
is sent to a provider unless the therapist explicitly triggers one of these tasks.

1. **Speech-to-text transcription.** Converts session audio or video recordings
   to text. Started manually by the therapist on each individual session.

2. **AI-draft session notes and summaries.** Produces a structured draft from the
   transcript. Requires explicit therapist review and editing before use; the draft
   is never surfaced to clients and is not stored as a final note without therapist
   confirmation. See `src/backend/src/services/aiUsageLogger.js` for usage logging.

3. **Exercise content generation.** Generates exercise descriptions based on
   therapist instructions. The result is editable before delivery to clients.

4. **Vector embedding generation.** Converts search queries into dense vectors
   for semantic similarity matching. Used to power the search index.

5. **Natural language query interface.** Allows therapists to ask questions in
   plain language on Pro and Premium plans. Sends only the query text and
   knowledge-base excerpts.

6. **Between-session chatbot assistant.** Answers therapist questions from the
   curated knowledge base. Never uses client diary data or personal records to
   generate responses.

## 4. Where providers store data

Data submitted to AI providers via REST API is processed transiently. Under
standard API terms, providers do not store submitted data in a persistent database
for their own purposes.

**OpenAI API** — processed in OpenAI's infrastructure in the United States.
API input and output are not used to train OpenAI models by default under
OpenAI's enterprise usage policy. See:
[OpenAI Data Processing Addendum](https://openai.com/policies/data-processing-addendum)

**Anthropic API** — processed in Anthropic's infrastructure in the United States.
API data is not used for model training under Anthropic's current usage policies.
See: [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)

**Google Generative Language API** — processed under Google Cloud terms.
Data submitted via the API is not used to train Google's models per Google Cloud's
Data Processing Addendum. See:
[Google Cloud DPA](https://cloud.google.com/terms/data-processing-addendum)

**OpenRouter** — acts as a gateway; forwards requests to the underlying provider.
Each underlying provider's own data-residency terms apply to their copy of the
request. See: [OpenRouter Privacy Policy](https://openrouter.ai/privacy)

**Note on EU data residency.** None of the above providers are headquartered in
the EU. PR-TOP's own data store (diary entries, session content, therapist notes)
is hosted on EU infrastructure (Hetzner). However, when a therapist triggers a
transcription or summary, the relevant content is sent to one of the above
providers' non-EU infrastructure for processing. If EU data residency for AI
processing is a hard requirement for a specific deployment, the platform operator
can configure the system without AI provider API keys; see section 7 below.

## 5. Data Processing Agreements

Each AI provider publishes a Data Processing Addendum or equivalent legal
document that covers how API data is handled.

| Provider | Document | URL |
|---|---|---|
| OpenAI | Data Processing Addendum | https://openai.com/policies/data-processing-addendum |
| Anthropic | Privacy Policy (API data section) | https://www.anthropic.com/legal/privacy |
| Google | Cloud Data Processing Addendum | https://cloud.google.com/terms/data-processing-addendum |
| OpenRouter | Privacy Policy | https://openrouter.ai/privacy |

If your practice requires a formally countersigned DPA between your clinic and
each AI provider, verify with the platform operator which providers have been
contracted and which DPAs have been signed. The links above are to each
provider's standard public policy.

## 6. Data retention at AI providers

Under standard API terms, AI providers do not retain submitted data beyond what
is required to complete the request and any mandatory safety-monitoring window.

**OpenAI API.** Inputs and outputs may be retained for up to 30 days for safety
monitoring, then permanently deleted. Data is not used to train OpenAI models.

**Anthropic API.** Under current usage policies, data is not retained beyond the
API call. Data is not used for model training.

**Google Generative Language API.** Data is not used to train Google's models.
Retention follows Google Cloud's data-processing terms.

**OpenRouter.** Forwards requests to providers; each provider's own retention
terms apply to their copy of the request data.

Provider policies may change. Always review the latest version of each provider's
DPA before making contractual commitments to clients about AI data retention.

## 7. Disabling or limiting AI

PR-TOP does not currently provide a global "AI off" toggle at the account level.
AI features are task-level opt-in — nothing is sent to an external provider unless
the therapist explicitly triggers a specific task:

- **Transcription** is started manually per session. If the therapist does not
  click "Transcribe", no audio or video is sent anywhere.
- **AI-draft summaries** are generated only when the therapist clicks
  "Generate summary" after a transcription is complete.
- **Exercise generation** is therapist-initiated via a button in the exercise
  editor.
- **Semantic search and the natural language query interface** are invoked only
  when the therapist types and submits a query.
- **The chatbot assistant** is only active when the therapist opens the chat
  panel and sends a message.

**Fully disabling AI at the deployment level.** If a practice requires that no
client data ever reaches an external AI provider, the platform operator can
configure the deployment without AI provider API keys. In that configuration:

- Session transcription is unavailable.
- AI-draft notes and summaries are unavailable.
- Exercise AI-generation is unavailable.
- Semantic search and natural language queries are unavailable.
- The chatbot assistant is unavailable.

All other PR-TOP features continue to function normally: client diary (text and
voice, stored encrypted), session records, manual notes, exercise assignment from
the library, SOS alerts, consent management, and analytics.

## Edge cases and known limitations

**OpenRouter as an intermediary.** When OpenRouter is the active provider, PR-TOP
has a single contractual relationship with OpenRouter; OpenRouter in turn routes
to an underlying provider. This means two DPAs are relevant — OpenRouter's and the
underlying provider's — and the therapist may not know which underlying provider
is used for a given request unless the operator configures a fixed target model.

**No model-training opt-out in the UI.** PR-TOP does not currently expose a
per-therapist setting to opt out of provider model training. Under the API terms
of OpenAI and Anthropic, API customers are not opted into training by default.
However, if your practice needs explicit contractual assurance, sign an
enterprise DPA with each provider directly.

**Whisper-compatible transcription.** PR-TOP uses the OpenAI Whisper-compatible
transcription endpoint. When OpenAI is the active provider, this is the same
data flow as the summarisation model; when another provider is used, the
operator may configure a separate Whisper-compatible endpoint (e.g., self-hosted
Whisper running within the EU).

## Frequently asked questions

**Q: Is my clients' diary data ever sent to an AI provider?**
A: No. Diary entries are stored encrypted in the PR-TOP database and are never
sent to an AI provider. Only session transcripts and the therapist's own
instructions are sent for summarisation and exercise generation.

**Q: Does PR-TOP use client data to train AI models?**
A: No. PR-TOP does not provide client data to any AI provider for training
purposes. Under the standard API terms of OpenAI, Anthropic, and Google, API
data submitted by customers is not used to train those providers' models.

**Q: Which AI provider is active on my deployment?**
A: This depends on how the platform operator has configured the deployment.
The operator can see the active provider in the environment configuration
(`AI_PROVIDER` environment variable). Ask the operator if you need to know.

**Q: Can I run PR-TOP without any AI features?**
A: Yes. The platform operator can configure the deployment without AI provider
API keys. Transcription, AI summaries, exercise generation, semantic search,
and the chatbot will be unavailable, but all other features work normally.

**Q: Are AI-generated session notes shown to clients?**
A: No. AI-draft notes and summaries are visible only to the therapist and require
explicit therapist review and editing. Clients do not see AI drafts.

**Q: Where can I find the detailed data flow for a specific feature?**
A: See the source code references listed in sections 1 and 3 above. The AI
provider adapters are in `src/backend/src/services/aiProviders/`. The usage
logger is in `src/backend/src/services/aiUsageLogger.js`.
