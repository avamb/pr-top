<!-- audience: user -->
# PR-TOP UI labels — English reference

_This page is regenerated on every release by_ `npm run docs:assistant`.
_Do not edit by hand — edits will be overwritten._

The tables below list every top-level i18n namespace shipped in the
React dashboard. Use them to look up the exact wording of a label,
button, or hint that a therapist sees on-screen.

_Sample keys are trimmed to a short summary per namespace to keep this
page under the RAG chunk budget. The full i18n JSON is still the source
of truth — see `src/frontend/src/i18n/en.json`._

## admin

- `admin.loadingAdmin` — Loading admin panel...
- `admin.dashboardTitle` — Admin Dashboard
- `admin.dashboardSubtitle` — Platform overview and management
- `admin.userStats` — User Statistics
- `admin.therapists` — Therapists
- `admin.clients` — Clients
- `admin.blockedTherapists` — Blocked Therapists
- `admin.auditLogEntries` — Audit Log Entries
- `admin.platformMetrics` — Platform Metrics
- `admin.sessions` — Sessions
- `admin.diaryEntries` — Diary Entries
- `admin.therapistNotes` — Therapist Notes
- `admin.sosEvents` — SOS Events
- `admin.subscriptionStats` — Subscription Statistics
- `admin.activeSubscriptions` — Active Subscriptions
- `admin.trial` — Trial
- `admin.basic` — Basic
- `admin.pro` — Pro
- `admin.premium` — Premium
- `admin.revenueMetrics` — Revenue Metrics
- _+ 197 more keys_

## adminPromos

- `adminPromos.title` — Promo Code Management
- `adminPromos.createTitle` — Create New Promo Code
- `adminPromos.code` — Code
- `adminPromos.codePlaceholder` — e.g. WELCOME2026
- `adminPromos.plan` — Plan
- `adminPromos.durationDays` — Duration (days)
- `adminPromos.maxUses` — Max Uses
- `adminPromos.maxUsesPlaceholder` — Leave empty for unlimited
- `adminPromos.expiresAt` — Expires At
- `adminPromos.createBtn` — Create Code
- `adminPromos.creating` — Creating...
- `adminPromos.active` — Active
- `adminPromos.inactive` — Inactive
- `adminPromos.expired` — Expired
- `adminPromos.maxed` — Max Used
- `adminPromos.used` — Used
- `adminPromos.deactivate` — Deactivate
- `adminPromos.deactivating` — ...
- `adminPromos.noPromos` — No promo codes yet. Create one above.
- `adminPromos.redemptionsTitle` — Pending Redemptions
- _+ 41 more keys_

## ai

- `ai.disclaimer.generatedWithAi` — Generated with AI
- `ai.disclaimer.basedOn` — based on
- `ai.disclaimer.sourcesUsed` — Sources used
- `ai.disclaimer.showSources` — Show sources
- `ai.disclaimer.hideSources` — Hide sources
- `ai.disclaimer.noSources` — No sources from your library were used for this generation.
- `ai.disclaimer.sourceLabel` — Source
- `ai.disclaimer.fromLibrary` — from your library
- `ai.disclaimer.similarity` — match
- `ai.disclaimer.exerciseGenerated` — This exercise was generated with AI assistance.
- `ai.disclaimer.summaryGenerated` — This summary was generated with AI assistance.
- `ai.disclaimer.transparencyNote` — Sources are listed for transparency. You can hide this block in Settings.
- `ai.disclaimer.settingsToggleTitle` — Show AI sources
- `ai.disclaimer.settingsToggleLabel` — Show "Sources used" disclaimers next to AI-generated summaries and exercises
- `ai.disclaimer.settingsToggleHint` — When enabled, AI-generated content shows which items from your personal knowledge base ...
- `ai.disclaimer.settingsToggleSave` — Save preference
- `ai.disclaimer.settingsToggleSaved` — AI sources preference saved

## aiUsage

- `aiUsage.title` — AI Usage & Costs
- `aiUsage.totalCost` — Total Cost
- `aiUsage.totalTokens` — Total Tokens
- `aiUsage.apiCalls` — API Calls
- `aiUsage.mostUsedModel` — Most Used Model
- `aiUsage.dailyCost` — Daily Cost
- `aiUsage.costByModel` — Cost by Model
- `aiUsage.costByTherapist` — Cost by Therapist
- `aiUsage.model` — Model
- `aiUsage.calls` — Calls
- `aiUsage.tokens` — Tokens
- `aiUsage.cost` — Cost
- `aiUsage.avgCost` — Avg/Call
- `aiUsage.therapist` — Therapist
- `aiUsage.noData` — No AI usage data yet.
- `aiUsage.today` — Today
- `aiUsage.last7Days` — 7 days
- `aiUsage.last30Days` — 30 days
- `aiUsage.last90Days` — 90 days
- `aiUsage.spendingLimit` — Spending Limit
- _+ 13 more keys_

## analytics

- `analytics.title` — Analytics
- `analytics.subtitle` — Client activity overview
- `analytics.totalActivity` — Total Activity
- `analytics.diaryEntries` — Diary Entries
- `analytics.sessions` — Sessions
- `analytics.notes` — Notes
- `analytics.lastDays` — Last {{days}} days
- `analytics.fromClients` — From clients
- `analytics.recorded` — Recorded
- `analytics.created` — Created
- `analytics.dailyActivity` — Daily Activity (Last {{days}} days)
- `analytics.noActivityPeriod` — No activity recorded in this period
- `analytics.diary` — Diary
- `analytics.clientBreakdown` — Client Activity Breakdown
- `analytics.noClientsLinked` — No clients linked yet
- `analytics.client` — Client
- `analytics.total` — Total
- `analytics.lastActive` — Last Active
- `analytics.retry` — Retry
- `analytics.exportCSV` — Export CSV
- _+ 45 more keys_

## assignment

- `assignment.title` — Assignments
- `assignment.subtitleSession` — Homework attached to this session — visible to the client in their Telegram bot under /...
- `assignment.subtitleClient` — All homework you've assigned this client, across every session.
- `assignment.newButton` — New assignment
- `assignment.cancel` — Cancel
- `assignment.create` — Create assignment
- `assignment.creating` — Creating…
- `assignment.fieldTitle` — Title
- `assignment.fieldExercise` — Exercise (optional)
- `assignment.fieldDescription` — Description
- `assignment.fieldFrequency` — Report frequency
- `assignment.fieldFrequencyN` — Every N days
- `assignment.fieldDeadline` — Deadline (optional)
- `assignment.titlePlaceholder` — e.g. Breathing practice 5 min/day
- `assignment.descriptionPlaceholder` — Detailed instructions for the client — encrypted at rest.
- `assignment.exerciseNone` — — Freeform (no library exercise) —
- `assignment.exerciseHint` — Pick a library exercise OR leave empty and use the title/description as freeform instru...
- `assignment.linkedExercise` — Linked exercise
- `assignment.fromLibrary` — Library
- `assignment.orphan` — Detached session
- _+ 63 more keys_

## assistant

- `assistant.title` — Assistant
- `assistant.placeholder` — Type your question...
- `assistant.send` — Send
- `assistant.newChat` — New chat
- `assistant.history` — Chat history
- `assistant.typing` — Assistant is typing...
- `assistant.welcome` — How can I help you?
- `assistant.hint` — Ask me about using PR-TOP — navigation, features, workflows, and more.
- `assistant.tooltip` — Need help?
- `assistant.deleteConfirm` — Are you sure you want to delete this chat?
- `assistant.deleteChat` — Delete
- `assistant.empty` — No messages yet. Start a conversation!
- `assistant.noHistory` — No conversations yet
- `assistant.startFirst` — Start your first conversation
- `assistant.today` — Today
- `assistant.yesterday` — Yesterday
- `assistant.thisWeek` — This week
- `assistant.older` — Older
- `assistant.msgs` — msgs
- `assistant.archived` — archived

## auth

- `auth.loginTitle` — Log In
- `auth.loginSubtitle` — Sign in to your account
- `auth.registerTitle` — Create your therapist workspace
- `auth.registerSubtitle` — 14-day free trial. No credit card required.
- `auth.email` — Email
- `auth.password` — Password
- `auth.confirmPassword` — Confirm Password
- `auth.emailPlaceholder` — you@example.com
- `auth.passwordPlaceholder` — Your password
- `auth.passwordMinPlaceholder` — At least 6 characters
- `auth.confirmPasswordPlaceholder` — Confirm new password
- `auth.signIn` — Sign In
- `auth.signingIn` — Signing in...
- `auth.createAccount` — Create Account
- `auth.creatingAccount` — Creating account...
- `auth.noAccount` — Don't have an account?
- `auth.hasAccount` — Already have an account?
- `auth.networkError` — Network error. Please try again.
- `auth.emailPasswordRequired` — Email and password are required
- `auth.passwordMinLength` — Password must be at least 6 characters
- _+ 45 more keys_

## brand

- `brand` = "PR-TOP"

## bulkImport

- `bulkImport.title` — Import Clients
- `bulkImport.subtitle` — Upload a CSV or JSON file to import multiple clients at once
- `bulkImport.dropzone` — Click to select a CSV or JSON file
- `bulkImport.formatHint` — CSV columns: name, email, phone, notes | JSON: array of objects
- `bulkImport.clearFile` — Clear file
- `bulkImport.preview` — Preview
- `bulkImport.records` — records
- `bulkImport.colName` — Name
- `bulkImport.colEmail` — Email
- `bulkImport.colPhone` — Phone
- `bulkImport.colNotes` — Notes
- `bulkImport.invalidFormat` — Invalid file format
- `bulkImport.unsupportedType` — Unsupported file type. Use CSV or JSON.
- `bulkImport.noRecords` — No client records found in the file
- `bulkImport.tooMany` — Maximum 200 clients per import
- `bulkImport.parseError` — Could not parse file: 
- `bulkImport.confirmImport` — Import Clients
- `bulkImport.importing` — Importing...
- `bulkImport.importComplete` — Import Complete
- `bulkImport.importFailed` — Import Failed
- _+ 9 more keys_

## client

- `client.mode.solo` — Solo
- `client.mode.botConnected` — Bot-connected
- `client.mode.soloDash` — —
- `client.solo.title` — New solo client
- `client.solo.badge` — Solo
- `client.solo.badgeTooltip` — Therapist-only notebook — client is not connected to the bot.
- `client.solo.description` — A therapist-only notebook. The client never connects to the bot — useful when the clien...
- `client.solo.subtitle` — Therapist-only notebook · no bot connection
- `client.solo.btn` — Solo Client
- `client.solo.btnTooltip` — Create a therapist-only client (no bot connection).
- `client.solo.firstName` — First name
- `client.solo.lastName` — Last name
- `client.solo.emailOptional` — Email (optional)
- `client.solo.language` — Language
- `client.solo.noteOptional` — Initial note (optional)
- `client.solo.notePlaceholder` — Anything you want to remember about this client — encrypted, therapist-only.
- `client.solo.disclaimer` — Solo clients are invisible to the Telegram bot. Diary, exercises, and SOS alerts are no...
- `client.solo.creating` — Creating…
- `client.solo.create` — Create solo client
- `client.solo.errorNeedIdentifier` — Provide a first name, last name, or email.
- _+ 3 more keys_

## clientDetail

- `clientDetail.timeline` — Timeline
- `clientDetail.diary` — Diary
- `clientDetail.notesTab` — Notes
- `clientDetail.sessionsTab` — Sessions
- `clientDetail.exercisesTab` — Exercises
- `clientDetail.contextTab` — Context
- `clientDetail.engagementTab` — Engagement
- `clientDetail.inquiriesTab` — Inquiries
- `clientDetail.language` — Language
- `clientDetail.consent` — Consent
- `clientDetail.consentGranted` — ✅ Granted
- `clientDetail.consentNotGranted` — ❌ Not granted
- `clientDetail.joined` — Joined
- `clientDetail.phone` — Phone
- `clientDetail.telegram` — Telegram
- `clientDetail.remindersLabel` — Reminders
- `clientDetail.remindersInherit` — Default ({{state}})
- `clientDetail.remindersOn` — On
- `clientDetail.remindersOff` — Off
- `clientDetail.remindersOverrideOn` — Force on
- _+ 114 more keys_

## clientList

- `clientList.title` — Clients
- `clientList.totalClients` — {{count}} client(s) total
- `clientList.planLimit` — (limit: {{limit}})
- `clientList.loadedIn` — loaded in {{ms}}ms
- `clientList.searchPlaceholder` — Search by email or Telegram ID...
- `clientList.client` — Client
- `clientList.telegram` — Telegram
- `clientList.languageCol` — Language
- `clientList.consent` — Consent
- `clientList.lastActivity` — Last Activity
- `clientList.joined` — Joined
- `clientList.consented` — Consented
- `clientList.noConsent` — No Consent
- `clientList.noActivity` — No activity
- `clientList.noClients` — No clients linked yet.
- `clientList.noClientsHint` — Share your invite code with clients so they can connect with you via the Telegram bot.
- `clientList.viewInviteCode` — View Invite Code
- `clientList.importClients` — Import Clients
- `clientList.noSearchResults` — No clients match your search.
- `clientList.noSearchResultsHint` — Try adjusting your search query.
- _+ 5 more keys_

## comments

- `comments.title` — Comments
- `comments.private` — Private
- `comments.shared` — Shared
- `comments.tabForMe` — For me
- `comments.tabForClient` — For client
- `comments.tabForTherapist` — For therapist
- `comments.addPrivate` — Add private comment
- `comments.addShared` — Add shared comment
- `comments.placeholderPrivate` — Private note — only you can see this
- `comments.placeholderShared` — Shared comment — visible to both you and the other party
- `comments.save` — Save
- `comments.saving` — Saving...
- `comments.edit` — Edit
- `comments.delete` — Delete
- `comments.cancel` — Cancel
- `comments.confirmDelete` — Delete this comment?
- `comments.loading` — Loading comments...
- `comments.emptyForYou` — No private notes yet. Use the form below to add one.
- `comments.emptyForClient` — No shared comments yet. Anything you write here is visible to the client.
- `comments.emptyForTherapist` — No shared comments yet. Anything you write here is visible to your therapist.
- _+ 13 more keys_

## common

- `common.loading` — Loading...
- `common.error` — Error
- `common.save` — Save
- `common.cancel` — Cancel
- `common.delete` — Delete
- `common.edit` — Edit
- `common.close` — Close
- `common.yes` — Yes
- `common.no` — No
- `common.ok` — OK

## dashboard

- `dashboard.title` — PR-TOP Dashboard
- `dashboard.quickStats` — Quick Stats
- `dashboard.clients` — Clients
- `dashboard.sessions` — Sessions
- `dashboard.notes` — Notes
- `dashboard.activeSos` — Active SOS
- `dashboard.recentActivity` — Recent Activity
- `dashboard.noActivity` — No recent activity
- `dashboard.noActivityHint` — Activity from your clients will appear here. Invite clients to get started!
- `dashboard.inviteCode` — Your Invite Code
- `dashboard.inviteCodeDesc` — Share this code with clients so they can connect to you via the Telegram bot.
- `dashboard.copy` — Copy
- `dashboard.copied` — ✓ Copied!
- `dashboard.copyInviteLink` — Copy Invite Link
- `dashboard.inviteLinkCopied` — Invite link copied to clipboard!
- `dashboard.shareInviteLink` — Share
- `dashboard.inviteLinkDesc` — Send this link to your client — they click it and connect to you automatically in Teleg...
- `dashboard.botNotConfigured` — Bot username not configured. Contact administrator.
- `dashboard.regenerate` — Regenerate
- `dashboard.regenerating` — Regenerating...
- _+ 18 more keys_

## diary

- `diary.transcribed` — Transcribed
- `diary.pendingTranscription` — Pending transcription
- `diary.transcriptionFailed` — Failed
- `diary.transcript` — Transcript
- `diary.noTranscript` — No transcript available
- `diary.retryTranscription` — Retry transcription
- `diary.expand` — Expand
- `diary.collapse` — Collapse

## exercise

- `exercise.templateBadge` — Template
- `exercise.templateTooltip` — This is a formatting example. You can use it or create your own exercise in My Exercises.
- `exercise.comments.running` — Running notes
- `exercise.comments.final` — Final
- `exercise.comments.finalBadge` — Final
- `exercise.comments.emptyRunning` — No running notes yet — the client hasn't shared step-by-step notes on this exercise.
- `exercise.comments.emptyFinal` — No final answer yet — the client hasn't submitted their final response.
- `exercise.comments.runningPlaceholder` — Add a running note (visible to the client during the exercise)
- `exercise.comments.addRunning` — Add running note

## exerciseLibrary

- `exerciseLibrary.title` — Exercise Library
- `exerciseLibrary.exerciseCount` — {{count}} exercises
- `exerciseLibrary.allCategories` — All Categories
- `exerciseLibrary.breathing` — Breathing & Relaxation
- `exerciseLibrary.mindfulness` — Mindfulness
- `exerciseLibrary.cognitive` — Cognitive (CBT)
- `exerciseLibrary.journaling` — Journaling
- `exerciseLibrary.behavioral` — Behavioral
- `exerciseLibrary.selfCompassion` — Self-Compassion
- `exerciseLibrary.loading` — Loading exercises...
- `exerciseLibrary.noExercises` — No exercises found.
- `exerciseLibrary.noMyExercises` — You haven't created any exercises yet.
- `exerciseLibrary.description` — Description
- `exerciseLibrary.instructions` — Instructions
- `exerciseLibrary.instructionsRu` — Instructions (Russian)
- `exerciseLibrary.noInstructions` — No instructions available
- `exerciseLibrary.close` — Close
- `exerciseLibrary.libraryTab` — Sample Library
- `exerciseLibrary.libraryTabHint` — Pre-made examples for psychologists and therapists — use as templates or assign directl...
- `exerciseLibrary.myExercises` — My Exercises
- _+ 26 more keys_

## guide

- `guide.title` — Therapist Guide
- `guide.subtitle` — Step-by-step instructions for using all features of the service
- `guide.searchPlaceholder` — Search guide sections...
- `guide.searchResults` — {{count}} section(s) found
- `guide.noResults` — No sections match your search
- `guide.section1Title` — Dashboard Overview
- `guide.section1Body` — The dashboard is your main workspace. Here you can see key statistics at a glance, rece...
- `guide.section1Stat1` — Active Clients — the number of clients currently linked to you
- `guide.section1Stat2` — Sessions — total sessions recorded
- `guide.section1Stat3` — Notes — your private therapist notes count
- `guide.section1Stat4` — Active SOS — currently unresolved SOS alerts from clients
- `guide.section1Activity` — The activity feed shows recent diary entries, sessions, SOS events, and notes in chrono...
- `guide.section1Invite` — Your invite code is a unique code you share with clients so they can connect to you thr...
- `guide.section1Badge` — The subscription badge in the header shows your current plan (Trial, Basic, Pro, or Pre...
- `guide.section1ImgAlt` — Dashboard overview screenshot
- `guide.section2Title` — Client Management
- `guide.section2Body` — The Clients page displays all clients linked to your account. Use the search bar to fil...
- `guide.section2Dot1` — Green dot — client was active within the last day
- `guide.section2Dot2` — Teal dot — client was active within the last 7 days
- `guide.section2Dot3` — Amber dot — client was active within the last 30 days
- _+ 110 more keys_

## inquiry

- `inquiry.title` — Title
- `inquiry.description` — Description
- `inquiry.titlePlaceholder` — e.g. less reactive with family
- `inquiry.descriptionPlaceholder` — Optional context, goals, or progress notes
- `inquiry.create` — New Inquiry
- `inquiry.createSubmit` — Create Inquiry
- `inquiry.edit` — Edit
- `inquiry.save` — Save
- `inquiry.cancel` — Cancel
- `inquiry.close` — Close Inquiry
- `inquiry.reopen` — Reopen
- `inquiry.delete` — Delete
- `inquiry.confirmDelete` — Permanently delete this inquiry? Sessions linked to it will remain.
- `inquiry.empty` — No inquiries yet. Create one to track a long-running thread of work with this client.
- `inquiry.loading` — Loading inquiries...
- `inquiry.openedAt` — Opened
- `inquiry.closedAt` — Closed
- `inquiry.updatedAt` — Last updated
- `inquiry.filterAll` — All
- `inquiry.errorLoad` — Failed to load inquiries
- _+ 4 more keys_

## kb

- `kb.title` — Personal Knowledge Base
- `kb.desc` — Upload textbooks, articles, and reference material from your school of therapy. The AI ...
- `kb.empty` — No documents uploaded yet. Drop a file above to get started.
- `kb.loadError` — Could not load your knowledge base.
- `kb.delete` — Delete
- `kb.deleteConfirm` — Delete "{{title}}" and all of its embeddings? This cannot be undone.
- `kb.deleteSuccess` — Document removed from your knowledge base.
- `kb.uploadQueued` — Upload accepted. Processing begins in the background — refresh in a few seconds.
- `kb.chunkCount` — {{count}} chunks
- `kb.chunkCount_one` — {{count}} chunk
- `kb.chunkCount_other` — {{count}} chunks
- `kb.processing` — Processing in background…
- `kb.stats.documents` — Documents
- `kb.stats.ready` — Ready
- `kb.stats.chunks` — Indexed chunks
- `kb.status.queued` — Queued
- `kb.status.ingesting` — Processing
- `kb.status.ready` — Ready
- `kb.status.failed` — Failed
- `kb.upload.button` — Choose file…
- _+ 10 more keys_

## landing

- `landing.heroTitle1` — A unified workspace
- `landing.heroTitle2` — for therapists and their practice.
- `landing.heroSlogan` — Keep the full client context between sessions. Review every note. Maintain clear profes...
- `landing.heroImageAlt` — PR-TOP therapist dashboard — client list, upcoming sessions, and recent activity (demo ...
- `landing.heroDesc` — PR-TOP brings together client diaries, session notes, assignments, and secure communica...
- `landing.startTrial` — Start Free Trial
- `landing.learnMore` — See How It Works
- `landing.featuresTitle` — Your Practice, Simplified
- `landing.featuresDesc` — Six concrete changes to how your week runs — less administrative overhead, deeper conti...
- `landing.pricingTitle` — Simple, Transparent Pricing
- `landing.pricingDesc` — Start with a free trial. Upgrade as your practice grows.
- `landing.mostPopular` — Most Popular
- `landing.perMonth` — /month
- `landing.free` — Free
- `landing.days14` — 14 days
- `landing.tierFeat.clients3` — Up to 3 clients
- `landing.tierFeat.clients10` — Up to 10 clients
- `landing.tierFeat.clients30` — Up to 30 clients
- `landing.tierFeat.clientsUnlimited` — Unlimited clients
- `landing.tierFeat.sessions5` — 5 sessions / month
- _+ 145 more keys_

## landingConfirm

- `landingConfirm.hero.headline` — Zero No-Shows. Happy Clients.
- `landingConfirm.hero.subheadline` — Automated session reminders via Telegram — your clients confirm, reschedule, or release...
- `landingConfirm.hero.ctaBtn` — Start Free Trial
- `landingConfirm.hero.badge` — Telegram Session Reminders
- `landingConfirm.hero.trialNote` — 7-day free trial · No credit card required · Cancel anytime
- `landingConfirm.hero.mockBotName` — PR-TOP Reminder
- `landingConfirm.hero.mockBotType` — bot
- `landingConfirm.hero.mockMsgTitle` — Session reminder
- `landingConfirm.hero.mockMsgTime` — Tomorrow at 3:00 PM
- `landingConfirm.hero.mockMsgTherapist` — with Dr. Maria Ivanova
- `landingConfirm.hero.mockBtnConfirm` — ✅ Confirm session
- `landingConfirm.hero.mockBtnReschedule` — 🔄 Request reschedule
- `landingConfirm.hero.mockBtnRelease` — 🆓 Release slot
- `landingConfirm.pain.title` — Sound familiar?
- `landingConfirm.pain.card1Title` — Empty slot on Friday
- `landingConfirm.pain.card1Body` — Client forgot, you lose €80, and the time can't be filled last minute.
- `landingConfirm.pain.card2Title` — "Can we move it?" — the morning of
- `landingConfirm.pain.card2Body` — Late cancellations waste your day and break your focus before the next session.
- `landingConfirm.pain.card3Title` — Another reminder written by hand
- `landingConfirm.pain.card3Body` — Every week you copy-paste the same Telegram message. It's minutes that grind you down.
- _+ 83 more keys_

## nav

- `nav.dashboard` — Dashboard
- `nav.clients` — Clients
- `nav.analytics` — Analytics
- `nav.settings` — Settings
- `nav.exercises` — Exercise Library
- `nav.subscription` — Subscription
- `nav.guide` — Guide
- `nav.logout` — Log out
- `nav.login` — Log in
- `nav.register` — Get Started
- `nav.skipToContent` — Skip to main content
- `nav.backToClients` — ← Back to Clients
- `nav.backToDashboard` — ← Dashboard
- `nav.adminSection` — Administration
- `nav.adminOverview` — Overview
- `nav.adminTherapists` — Therapists
- `nav.adminSettings` — Settings
- `nav.adminLogs` — Audit Logs
- `nav.adminSystemLogs` — System Logs
- `nav.adminAIUsage` — AI Usage
- _+ 7 more keys_

## notifications

- `notifications.sosAlert` — SOS Alert from {{client}}!
- `notifications.newDiary` — New diary entry from {{client}}
- `notifications.exerciseCompleted` — {{client}} completed an exercise
- `notifications.sessionReady` — Session processing {{status}}
- `notifications.newEvent` — New notification
- `notifications.viewClient` — View Client
- `notifications.viewSession` — View Session
- `notifications.view` — View
- `notifications.dismiss` — Dismiss
- `notifications.unknownClient` — Unknown client
- `notifications.unreadCount` — {{count}} unread notification(s)

## player

- `player.play` — Play
- `player.pause` — Pause
- `player.volume` — Volume
- `player.speed` — Playback speed
- `player.loading` — Loading media...
- `player.error` — Playback Error
- `player.loadError` — Failed to load media file

## privacy

- `privacy.title` — Privacy Policy
- `privacy.lastUpdated` — Last updated: {{date}}
- `privacy.tableOfContents` — Table of Contents
- `privacy.dataCollection.title` — What Data We Collect
- `privacy.dataCollection.intro` — PR-TOP collects only the data necessary to provide the PR-TOP platform. We distinguish ...
- `privacy.dataCollection.personalTitle` — Personal Information
- `privacy.dataCollection.personalDesc` — When you register, we collect your email address, name, and chosen password (stored as ...
- `privacy.dataCollection.clinicalTitle` — Clinical & Session Data
- `privacy.dataCollection.clinicalDesc` — Clients may submit diary entries (text, voice messages, video messages), exercise respo...
- `privacy.dataCollection.usageTitle` — Usage Data
- `privacy.dataCollection.usageDesc` — We collect anonymized usage analytics through Umami, a privacy-first analytics platform...
- `privacy.dataUsage.title` — How We Use Your Data
- `privacy.dataUsage.intro` — Your data is used exclusively to provide and improve the PR-TOP platform:
- `privacy.dataUsage.item1` — Providing therapist-client workflows: diary access, session management, exercise delive...
- `privacy.dataUsage.item2` — AI-powered features: speech-to-text transcription, session summarization, semantic sear...
- `privacy.dataUsage.item3` — Account management: authentication, subscription billing, email notifications
- `privacy.dataUsage.item4` — Service improvement: anonymized aggregate analytics to understand feature usage patterns
- `privacy.dataUsage.noAds` — We never use your data for advertising, user profiling, or model training purposes.
- `privacy.dataStorage.title` — Data Storage & Encryption
- `privacy.dataStorage.intro` — PR-TOP employs multiple layers of protection to safeguard your data:
- _+ 27 more keys_

## publicChat

- `publicChat.title` — Ask about PR-TOP
- `publicChat.tooltip` — Ask us anything!
- `publicChat.placeholder` — Ask a question...
- `publicChat.send` — Send
- `publicChat.welcomeTitle` — Hi! I'm the PR-TOP assistant
- `publicChat.welcomeDesc` — Ask me anything about our therapist platform. I can help with features, pricing, securi...
- `publicChat.suggestion1` — What is PR-TOP?
- `publicChat.suggestion2` — How secure is client data?
- `publicChat.suggestion3` — What are the pricing plans?
- `publicChat.ctaTitle` — Your free messages have ended
- `publicChat.ctaEmailDesc` — To continue the conversation, register — it's free!
- `publicChat.emailPlaceholder` — your@email.com
- `publicChat.continueBtn` — Continue
- `publicChat.invalidEmail` — Please enter a valid email address
- `publicChat.existingAccount` — An account with this email already exists. Please log in.
- `publicChat.registrationError` — Something went wrong. Please try again.
- `publicChat.registrationSuccess` — Welcome! You can now continue chatting.
- `publicChat.ctaNoCard` — No credit card required
- `publicChat.leadWelcome` — Thanks! I've sent a verification email. Click the link in your inbox to confirm. Meanwh...
- `publicChat.verifyEmailHint` — Verify your email to unlock even more messages!
- _+ 1 more keys_

## pwa

- `pwa.installTitle` — Add PR-TOP to Home Screen
- `pwa.installDesc` — Install the app for a faster, native-like experience with offline support.
- `pwa.install` — Install
- `pwa.notNow` — Not now
- `pwa.updateAvailable` — A new version is available.
- `pwa.reload` — Refresh
- `pwa.offline` — You are offline. Some features may be unavailable.

## reminders

- `reminders.settings.sectionTitle` — Session Reminders
- `reminders.settings.sectionDesc` — Configure automated session reminders for your clients. Reminders are sent via Telegram...
- `reminders.settings.enableLabel` — Enable session reminders
- `reminders.settings.scheduleInfo` — Reminders are sent at 09:00 the day before and on the day of the session (no later than...
- `reminders.settings.toneLabel` — Message tone
- `reminders.settings.tone.neutral` — Neutral
- `reminders.settings.tone.warm` — Warm
- `reminders.settings.tone.brief` — Brief
- `reminders.settings.toneHint.neutral` — Balanced and professional.
- `reminders.settings.toneHint.warm` — Friendly and encouraging — good for CBT, humanistic approaches.
- `reminders.settings.toneHint.brief` — Short and to-the-point — good for structured approaches.
- `reminders.settings.rescheduleLeadLabel` — Allow client to request reschedule up to {{hours}}h before session
- `reminders.settings.releaseLeadLabel` — Allow client to release their slot up to {{hours}}h before session
- `reminders.settings.templateOverridesLabel` — Custom message templates (per language)
- `reminders.settings.templateOverridesHint` — Leave blank to use the built-in default. Supports {client_name}, {session_time}, {thera...
- `reminders.settings.templateKey.day_before` — Day-before reminder
- `reminders.settings.templateKey.day_of` — Day-of reminder
- `reminders.settings.templateKey.opt_in` — Opt-in prompt
- `reminders.settings.templatePlaceholder` — Leave blank to use default template…
- `reminders.settings.saving` — Saving…
- _+ 70 more keys_

## roles

- `roles.therapist` — Therapist
- `roles.client` — Client
- `roles.superadmin` — Super Admin
- `roles.viewer` — Lead
- `roles.viewerDescription` — Landing page visitor who registered with email

## security

- `security.backToHome` — Back to Home
- `security.heroSubtitle` — Learn how PR-TOP protects your clients' most sensitive data with industry-leading secur...
- `security.relatedPages` — Related Security Topics
- `security.encryptionTitle` — Encryption & Data Protection
- `security.gdprTitle` — GDPR Compliance
- `security.auditLogTitle` — Audit Logging
- `security.dataSovereigntyTitle` — Data Sovereignty
- `security.enc.atRestTitle` — Encryption at Rest (AES-256)
- `security.enc.atRestP1` — All sensitive client data stored in our database is encrypted using AES-256, the same s...
- `security.enc.atRestP2` — Database backups inherit the same encryption, so your data remains protected even in co...
- `security.enc.inTransitTitle` — Encryption in Transit (TLS 1.3)
- `security.enc.inTransitP1` — Every connection between your browser and PR-TOP servers is secured with TLS 1.3, the l...
- `security.enc.inTransitP2` — We enforce HSTS (HTTP Strict Transport Security) headers with a two-year duration to en...
- `security.enc.appLayerTitle` — Application-Layer Encryption (Class A Data)
- `security.enc.appLayerP1` — Beyond database-level encryption, PR-TOP applies a second layer of application-level en...
- `security.enc.appLayerItem1` — Client diary entries (text, voice transcripts, video transcripts)
- `security.enc.appLayerItem2` — Therapist session notes and summaries
- `security.enc.appLayerItem3` — Conversation messages between therapist and client
- `security.enc.appLayerItem4` — Therapist-entered anamnesis, contraindications, and clinical context fields
- `security.enc.appLayerItem5` — SOS alert content and exercise responses
- _+ 117 more keys_

## seo

- `seo.home.title` — PR-TOP — Practice Workspace for Therapists & Psychologists | Client Diary, Session Note...
- `seo.home.description` — PR-TOP — practice workspace for therapists: encrypted client diary, AI session notes, s...
- `seo.privacy.title` — Privacy Policy — PR-TOP
- `seo.privacy.description` — PR-TOP privacy policy: how we collect, encrypt, and delete therapist and client data — ...
- `seo.terms.title` — Terms of Service — PR-TOP
- `seo.terms.description` — PR-TOP terms of service: therapist obligations, acceptable use, subscription tiers, can...
- `seo.securityEncryption.title` — Encryption at Rest & In Transit — PR-TOP Security
- `seo.securityEncryption.description` — PR-TOP uses AES application-layer encryption for all client diary entries and session t...
- `seo.securityGdpr.title` — GDPR Compliance — PR-TOP Security
- `seo.securityGdpr.description` — PR-TOP is built GDPR-first: EU-hosted, no third-party trackers, consent enforcement for...
- `seo.securityAuditLog.title` — Audit Log & Access Trails — PR-TOP Security
- `seo.securityAuditLog.description` — PR-TOP keeps an immutable audit log of every access to encrypted client data. Therapist...
- `seo.securityDataSovereignty.title` — Data Sovereignty & Residency — PR-TOP Security
- `seo.securityDataSovereignty.description` — PR-TOP stores all client data on EU-only servers (Hetzner). No cross-border transfers, ...
- `seo.securityAiProcessing.title` — How AI Processing Works — PR-TOP Transparency
- `seo.securityAiProcessing.description` — Full transparency: which AI models PR-TOP uses, what data leaves the platform, for whic...

## session

- `session.upload.newSession` — + New Session
- `session.upload.consentNote` — Recording a session requires the client's prior consent (EU/GDPR).
- `session.upload.consentLearnMore` — Consent templates & guidance →
- `session.upload.dragDrop` — Drag & drop a session recording here
- `session.upload.dropHere` — Drop the file here to upload
- `session.upload.clickToBrowse` — or click to browse
- `session.upload.acceptedFormats` — Supported: mp3, m4a, wav, mp4, webm, ogg
- `session.upload.sizeLimit` — Max size: 100MB
- `session.upload.progress` — Uploading...
- `session.upload.tooLarge` — File too large. Maximum size is 100MB.
- `session.upload.invalidType` — Unsupported file type. Use mp3, m4a, wav, mp4, webm, or ogg.
- `session.upload.success` — Session uploaded! Transcription in progress...
- `session.upload.redirecting` — Opening session...
- `session.upload.meetingDate` — Meeting date
- `session.upload.titleLabel` — Title (optional)
- `session.upload.titlePlaceholder` — e.g. Follow-up about anxiety
- `session.upload.inquiryLabel` — Inquiry (optional)
- `session.upload.inquiryNone` — — No inquiry —
- `session.upload.singleTrack.label` — Keep only my voice (single-track)
- `session.upload.singleTrack.hint` — Use when the client did not consent to recording. After upload you'll pick which detect...
- _+ 85 more keys_

## sessionDetail

- `sessionDetail.loadingSession` — Loading session...
- `sessionDetail.sessionNotFound` — Session not found
- `sessionDetail.backToClient` — ← Back to Client
- `sessionDetail.sessionTitle` — Session #{{id}}
- `sessionDetail.clientId` — Client ID: {{id}}
- `sessionDetail.created` — Created: {{date}}
- `sessionDetail.scheduled` — Scheduled: {{date}}
- `sessionDetail.audioRecording` — Audio Recording
- `sessionDetail.audioAvailable` — Audio file available
- `sessionDetail.audioReference` — Reference: {{ref}}
- `sessionDetail.noAudioRecording` — No audio recording attached
- `sessionDetail.transcript` — Transcript
- `sessionDetail.transcriptDecryptFail` — Transcript available but could not be decrypted.
- `sessionDetail.noTranscriptYet` — No transcript available yet
- `sessionDetail.transcriptionInProgress` —  - transcription in progress
- `sessionDetail.sessionSummary` — Session Summary
- `sessionDetail.summaryDecryptFail` — Summary available but could not be decrypted.
- `sessionDetail.noSummaryYet` — No summary available yet

## settings

- `settings.title` — Profile Settings
- `settings.accountInfo` — Account Information
- `settings.email` — Email
- `settings.role` — Role
- `settings.memberSince` — Member since
- `settings.preferences` — Preferences
- `settings.language` — Language
- `settings.timezone` — Timezone
- `settings.saveChanges` — Save Changes
- `settings.saving` — Saving...
- `settings.settingsSaved` — Settings saved successfully!
- `settings.escalationTitle` — SOS Escalation Preferences
- `settings.escalationDesc` — Configure how you receive SOS alerts from clients.
- `settings.escalationSaved` — Escalation preferences saved!
- `settings.notificationChannels` — Notification Channels
- `settings.telegramNotifications` — Telegram notifications
- `settings.emailNotifications` — Email notifications
- `settings.webPushNotifications` — Web push notifications
- `settings.soundAlert` — Sound alert on dashboard
- `settings.quietHours` — Quiet Hours
- _+ 64 more keys_

## subscription

- `subscription.title` — Subscription
- `subscription.subtitle` — Manage your PR-TOP plan
- `subscription.loadingSubscription` — Loading subscription...
- `subscription.failedToLoad` — Failed to load subscription
- `subscription.trialExpiredTitle` — Your trial has expired
- `subscription.trialExpiredDesc` — Please select a plan below to continue using PR-TOP. Your data is safe and will be avai...
- `subscription.currentPlan` — Current Plan
- `subscription.status` — Status
- `subscription.trialEnds` — Trial ends: {{date}}
- `subscription.periodEnds` — Period ends: {{date}}
- `subscription.downgradeScheduled` — Downgrade to {{plan}} scheduled for end of current billing period ({{date}}). Your curr...
- `subscription.subscriptionCanceled` — Your subscription has been canceled.
- `subscription.accessUntil` — Your access continues until {{date}}.
- `subscription.canceledOn` — Canceled on {{date}}.
- `subscription.cancelSubscription` — Cancel subscription
- `subscription.canceling` — Canceling...
- `subscription.cancelConfirm` — Are you sure you want to cancel your subscription? Your access will continue until the ...
- `subscription.cancelSuccess` — Subscription canceled. Your access continues until {{date}}.
- `subscription.availablePlans` — Available Plans
- `subscription.currentPlanBtn` — Current Plan
- _+ 31 more keys_

## supervision

- `supervision.openModalBtn` — Share for supervision
- `supervision.openModalHint` — Generate a read-only share link for a supervisor
- `supervision.modalTitle` — Share for supervision
- `supervision.modalDescription` — Generate a read-only link a supervisor can open without an account. The link can be rev...
- `supervision.clientLabel` — Client
- `supervision.createTitle` — Create new share link
- `supervision.ttlLabel` — Link lifetime
- `supervision.ttl1d` — 1 day
- `supervision.ttl7d` — 7 days
- `supervision.ttl30d` — 30 days
- `supervision.anonymizeLabel` — Anonymize client identity
- `supervision.anonymizeHint` — Replace client name with "Client A" and redact emails/phone numbers in shared text.
- `supervision.noteLabel` — Internal note (optional)
- `supervision.notePlaceholder` — e.g. "Oct supervision with Dr. Ivanov"
- `supervision.createBtn` — Create share link
- `supervision.creating` — Creating...
- `supervision.existingTitle` — Existing share links
- `supervision.empty` — No share links yet.
- `supervision.statusActive` — Active
- `supervision.statusExpired` — Expired
- _+ 16 more keys_

## terms

- `terms.title` — Terms of Service
- `terms.lastUpdated` — Last updated: {{date}}
- `terms.tableOfContents` — Table of Contents
- `terms.acceptance.title` — Acceptance of Terms
- `terms.acceptance.p1` — By accessing or using PR-TOP (the "Service"), you agree to be bound by these Terms of S...
- `terms.acceptance.p2` — These Terms constitute a legally binding agreement between you and PR-TOP. By creating ...
- `terms.service.title` — Description of Service
- `terms.service.p1` — PR-TOP is a therapist-controlled between-session assistant platform designed for practi...
- `terms.service.p2` — The Service operates through a web dashboard for therapists and a Telegram bot interfac...
- `terms.service.p3` — PR-TOP strives to maintain reasonable uptime and availability. While we aim for high re...
- `terms.accounts.title` — User Accounts & Registration
- `terms.accounts.p1` — Therapist accounts are created through the web registration form. You are responsible f...
- `terms.accounts.p2` — Client access is granted exclusively through therapist-generated invite codes. Clients ...
- `terms.accounts.p3` — You must provide accurate and complete registration information. You agree to promptly ...
- `terms.acceptableUse.title` — Acceptable Use Policy
- `terms.acceptableUse.intro` — You agree to use the Service only for its intended purpose and in compliance with all a...
- `terms.acceptableUse.item1` — Use the Service for any unlawful purpose or to facilitate illegal activities
- `terms.acceptableUse.item2` — Attempt to gain unauthorized access to other users' accounts, data, or system resources
- `terms.acceptableUse.item3` — Upload malicious code, viruses, or any content designed to disrupt the Service
- `terms.acceptableUse.item4` — Use the Service to store or process data unrelated to legitimate therapeutic practice
- _+ 35 more keys_

## verifyLead

- `verifyLead.successTitle` — Email verified!
- `verifyLead.successDesc` — Your email has been confirmed. Return to the chat to continue the conversation with ext...
- `verifyLead.alreadyTitle` — Already verified
- `verifyLead.alreadyDesc` — Your email was already confirmed. Return to the chat to continue the conversation!
- `verifyLead.expiredTitle` — Link expired
- `verifyLead.expiredDesc` — This verification link has expired. Please return to the chat and register again.
- `verifyLead.errorTitle` — Verification failed
- `verifyLead.errorDesc` — Something went wrong during verification. Please try again later.
- `verifyLead.backToChat` — Return to PR-TOP

## viewerAnalytics

- `viewerAnalytics.title` — Lead Analytics
- `viewerAnalytics.subtitle` — Track anonymous visitors and lead conversion funnel
- `viewerAnalytics.today` — Today
- `viewerAnalytics.last7d` — 7 Days
- `viewerAnalytics.last30d` — 30 Days
- `viewerAnalytics.custom` — Custom
- `viewerAnalytics.totalSessions` — Anonymous Sessions
- `viewerAnalytics.registeredViewers` — Registered Leads
- `viewerAnalytics.therapistConversions` — Therapist Conversions
- `viewerAnalytics.aiCostPerSession` — AI Cost / Session
- `viewerAnalytics.totalTokens` — Total tokens
- `viewerAnalytics.conversionFunnel` — Conversion Funnel
- `viewerAnalytics.funnelAnonymous` — Anonymous Sessions
- `viewerAnalytics.funnelViewer` — Registered Leads (email)
- `viewerAnalytics.funnelTherapist` — Therapist (trial)
- `viewerAnalytics.anonToViewer` — Anonymous → Lead
- `viewerAnalytics.viewerToTherapist` — Lead → Therapist
- `viewerAnalytics.messagesPerSession` — Messages per Session
- `viewerAnalytics.anonymous` — Anonymous
- `viewerAnalytics.registered` — Registered
- _+ 8 more keys_

