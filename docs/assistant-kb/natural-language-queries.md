<!-- audience: public -->
# Natural-language queries over client history

Natural-language queries (NL queries) let a signed-in therapist ask a
plain-English question about a specific client — or the whole practice
— and get a grounded answer built from that client's own diary
entries, session summaries, and exercise responses. The feature is a
thin conversational layer over PR-TOP's vector semantic search. Labels
come from the `query` and `search` i18n namespaces on the dashboard.

## Prerequisites

- Pro or Premium subscription. Trial and Basic tiers see the query box
  but with a "Available on Pro" locked overlay that links to the
  pricing page.
- A client with at least a few weeks of diary entries or a couple of
  transcribed sessions — the more the client has written, the more
  substantial the answer.
- The client must have the diary-storage consent flag on. Consent-off
  clients are excluded from the vector index and the query engine
  will not surface them.

## Where to run a query

- **Client page → Query tab.** Scoped to that single client. Best for
  clinical questions like "when did she first mention exercise as
  helpful".
- **Analytics sidebar → Ask.** Scoped to your whole active roster
  (respecting consent flags). Best for cross-cutting questions like
  "which clients have mentioned insomnia in the last month".
- **Signed-in assistant panel.** Only answers about the platform
  itself, never about any particular client's content.

## Step-by-step

1. **Type a specific question.** Vector search rewards specificity.
   "What did the client say about her sister in October" beats
   "family issues".
2. **Send.** Answers stream in over 2–8 seconds depending on plan and
   how many entries the search touched.
3. **Read the citations.** Every answer ends with a "Sources" block
   listing the diary entries and session summaries the answer drew
   from, each linked to open the original.
4. **Refine.** If the answer is off-target, add a date range ("in the
   last 30 days") or an event type ("in voice diary only") and re-ask.
5. **Save or export.** Answers persist in the query history for 30
   days. Pro/Premium can export a query result to PDF alongside its
   sources for supervision.

## Example queries

- "Summarize how the client has talked about work in the last 90
  days."
- "Has the client mentioned any suicidal thoughts in the last month?"
- "Which exercises have led to the highest self-reported mood
  bumps?"
- "Compare mood trend between June and July."
- "List every mention of a specific medication name."
- "When did the client first say she wanted to start running again?"

## Edge cases

- **Zero results.** If the vector search finds no entries above a
  minimum similarity threshold, the model refuses to speculate and
  returns "I could not find anything about that in this client's
  history." This is by design.
- **Very broad question.** "How is the client doing" returns a
  bulleted summary of the last 30 days rather than a single sentence.
  Ask for a specific facet if you want a tighter answer.
- **Query about the therapist's own notes.** Private notes are
  excluded from the vector index by default. Turn on "Include notes"
  in the query controls to include them; this is a per-query,
  per-session flag and never leaves the therapist context.
- **Multilingual clients.** The vector embeddings are cross-lingual —
  you can query in English about a client whose diary is in Russian,
  Spanish, or Ukrainian, and the source excerpts render in the
  original language with an English gloss.

## Troubleshooting

- **"Available on Pro" overlay on Basic.** Upgrade to Pro to unlock.
  Existing diary and session data is already indexed and available
  the moment the upgrade goes through.
- **Slow first query.** The first query in a session warms the
  embedding cache; subsequent queries are noticeably faster. If the
  first query still takes more than 30 seconds, refresh the page.
- **Answer cites an entry that no longer exists.** Occasionally the
  index lags a deletion by up to five minutes. The query engine will
  simply skip the missing source and re-answer.
- **Answer contradicts what you remember.** Open the cited entries.
  If the citations really do support the answer, trust them; if they
  do not, submit feedback via the thumbs-down button so the model can
  be corrected on your account.
- **Language mismatch.** If you type a question in English and the
  answer comes back in the client's language, restart your browser
  session — the bot is inferring language from the previous chat and
  can be nudged back.

## FAQ

**Q: Does the model retain my client data?**
A: No. Every query is a one-shot call to your configured AI provider
with the retrieved excerpts inline. No data is used for provider-side
training on PR-TOP's account — the provider config disables training
on submitted data.

**Q: Can I include the client's real name in a query?**
A: You can type whatever you like into the query box; the query stays
inside your therapist context. However, PR-TOP encourages you to
identify clients by nickname or initials to reduce cross-context risk
if you ever share a query result.

**Q: Is there a rate limit on queries?**
A: Yes. Pro and Premium share a soft limit — a burst of 10 queries per
minute per therapist and a daily cap that is generous for normal
clinical use. If you hit it, the query button shows "please wait 60
seconds".

**Q: Can I use NL queries across supervision-shared clients?**
A: A supervisor with a shared client can run NL queries scoped to
that client, subject to their own plan. Cross-client queries are
scoped to the supervisor's own roster.

**Q: What if I ask a clinical question the model shouldn't answer,
like a diagnosis?**
A: The model is instructed to summarize what the client has said and
to explicitly refuse to diagnose. It will point out patterns and
citations but will not label the client with any DSM/ICD code.

**Q: Where do I turn off NL queries entirely for a client?**
A: Toggle the client's diary-storage consent flag off. That removes
their content from the vector index and NL queries can no longer see
them. Existing query history retains its citations but the links
become non-navigable.

**Q: Can I export query history?**
A: Individual query answers can be exported to PDF alongside their
sources. Bulk export of query history is not currently offered.
