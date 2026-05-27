// Bot internationalization - message translations
// Default language is 'en', can be overridden per user

const messages = {
  en: {
    // BotFather About (120 chars max, shown before /start)
    botAbout: 'PR-TOP — platform for psychotherapists. Client context, diaries, exercises, SOS button. Encryption & GDPR.',
    // BotFather Description (profile, max 512 chars)
    botDescription: `PR-TOP — secure between-session platform for psychotherapists.

For therapists:
• Preserve context between sessions — no double documentation
• Client diaries (text, voice, video) with auto-transcription
• Assign exercises, track completion
• SOS notifications for crisis situations
• Web dashboard with analytics and timeline

Connect clients with one link — simple and secure.

🔒 Encryption · GDPR · Your data belongs only to you`,
    welcomeBack: (role) => `Welcome back! You are registered as a ${role}.\n\nUse /help to see available commands.`,
    chooseRoleIntro: '🧠 PR-TOP — your professional between-session assistant\n\nA secure platform that helps therapists and clients work more effectively between meetings.\n\n🔒 All data is protected with end-to-end encryption\n\nWho are you?',
    chooseRole: 'Welcome to PR-TOP! Please choose your role:',
    roleTherapist: '🧑‍⚕️ I am a Therapist',
    roleClient: '🙋 I am a Client',
    connectUsage: '📋 To connect with your therapist, use:\n`/connect YOUR_CODE`\n\nReplace YOUR_CODE with the invite code your therapist gave you.',
    foundTherapist: (name) => `🔗 Found therapist: *${name}*\n\nBy connecting, you consent to sharing your diary entries, exercise responses, and activity data with this therapist.\n\nDo you want to connect?`,
    consentYes: '✅ Yes, I consent',
    consentNo: '❌ No, cancel',
    connected: '✅ You are now connected to your therapist!\n\nYou can now:\n• Write diary entries by sending text messages\n• Send voice messages for your diary\n• Use /sos for emergency contact\n\nUse /help to see all available commands.',
    connectionCancelled: '❌ Connection cancelled. You can try again with /connect <code>.',
    alreadyRegistered: (role) => `You are already registered as a ${role}. Use /help to see available commands.`,
    welcomeTherapist: (code) => `✅ Welcome to PR-TOP!\n\nHere's what the platform gives you as a therapist:\n\n📊 *Context between sessions* — all client information in one place, no double documentation\n📝 *Client diaries* — text, voice and video with automatic transcription and AI summaries\n📋 *Exercises* — assign from the library or create your own, track completion\n🆘 *SOS notifications* — instant alert if a client needs urgent support\n🎤 *Smart search* — ask questions about a client by voice or text, AI finds the answer\n📈 *Web dashboard* — dashboard, timeline, analytics at pr-top.com\n\n*Your invite code:* \`${code}\`\n📎 Send the link to clients — they connect in one click.\n\nUse /help for the list of commands.`,
    welcomeClient: '✅ Welcome to PR-TOP!\n\nThis bot is your safe space for between-session work with your therapist.\n\nWhat you can do:\n📝 *Thought diary* — write text, voice or video at any time. Your therapist will see them before the next session\n📋 *Exercises* — complete assignments from your therapist at your own pace\n🆘 *SOS button* — instant contact with your therapist if you need urgent support\n🔒 *Privacy* — all data is encrypted, only you and your therapist have access\n\nTo get started, connect with your therapist:\n/connect INVITE\\_CODE\n\n💡 Your therapist will send you the code.',
    deepLinkClientWelcome: '✅ Welcome to PR-TOP!\n\nThis bot is your safe space for between-session work with your therapist.\n\n📝 Thought diary — text, voice, video\n📋 Exercises from your therapist\n🆘 SOS button for urgent contact\n🔒 All data is encrypted\n\nConnecting you to your therapist now...',
    registrationError: '❌ Sorry, there was an error during registration. Please try again with /start.',
    voiceSaved: '🎤 Voice diary entry saved! Your therapist will be able to listen to it.',
    videoSaved: '🎥 Video diary entry saved! Your therapist will be able to view it.',
    diarySaved: '📝 Diary entry saved!',
    failedVoiceDiary: 'Failed to save voice diary entry.',
    failedVideoDiary: 'Failed to save video diary entry.',
    failedDiary: 'Failed to save diary entry.',
    // T-12 — bot.comment.makePrivate: client can flip a freshly-saved diary
    // entry to private so the therapist will not see it. Default is shared.
    commentMakePrivate: '🔒 Make private',
    commentMadePrivate: '🔒 Marked private. Your therapist will not see this entry.',
    commentAlreadyPrivate: '🔒 This entry is already private.',
    commentMakePrivateFailed: 'Could not make this entry private. Please try again.',
    therapistFreeText: '💡 As a therapist, use the web dashboard to manage clients.\n\nType /help for available commands.',
    therapistVoiceText: '💡 Voice diary entries are for clients only.\n\nAs a therapist, use the web dashboard to manage your clients.\nType /help for available commands.',
    therapistVideoText: '💡 Video diary entries are for clients only.\n\nAs a therapist, use the web dashboard to manage your clients.\nType /help for available commands.',
    failedInviteCode: 'Failed to process invite code. Please try again.',
    failedConsent: 'Failed to process consent. Please try again.',
    // T-18 Extended consent disclaimer (multi-checkbox flow)
    // T-399: bumped to 6 points, added session_reminders
    consentDisclaimerHeader: (name, version) => `🔐 *Consent disclaimer (v${version}) — ${name}*\n\nBefore connecting, please review and agree to *all six* points below. You cannot skip this step — your therapist relies on your informed consent to work with you between sessions.`,
    consentDisclaimerStorage: '1. 📦 *Data storage*\nYour diary entries (text, voice, video), exercise responses, and SOS events are stored on our servers while you remain connected to your therapist. After you disconnect, the data is retained per legal requirements but no longer accessible via the app.',
    consentDisclaimerAi: '2. 🤖 *AI processing*\nVoice and video messages are sent to AI transcription services. Transcripts and text content may be summarized and indexed by AI so your therapist can navigate your history. Only your therapist sees AI output.',
    consentDisclaimerSupervision: '3. 👥 *Anonymized supervision*\nYour therapist may share an anonymized, read-only snapshot of your history with their clinical supervisor (no name, no contact info, fixed expiry). You will not be personally identified in supervision.',
    consentDisclaimerRevoke: '4. ↩️ *Right to revoke*\nYou can /disconnect at any time. This immediately revokes therapist access to your data. Stored data is retained per legal requirements but no longer accessible via the app.',
    consentDisclaimerEncryption: '5. 🔒 *Encryption*\nAll sensitive content (diary, transcripts, summaries, notes) is encrypted at rest with AES. Only your therapist\'s authenticated session, with your continuing consent, can decrypt your data.',
    consentDisclaimerSessionReminders: '6. 📅 *Session reminders*\nReminders about your upcoming sessions may be sent to you via Telegram and email. You can opt out at any time.',
    consentDisclaimerFooter: 'Tick *each* of the six boxes below, then press *I agree and connect*.',
    consentCheckboxStorage: 'I agree to data storage',
    consentCheckboxAi: 'I agree to AI processing',
    consentCheckboxSupervision: 'I agree to anonymized supervision',
    consentCheckboxRevoke: 'I understand my right to revoke',
    consentCheckboxEncryption: 'I understand encryption terms',
    consentCheckboxSessionReminders: 'I understand session reminders may be sent',
    consentBtnContinue: '✅ I agree and connect',
    consentBtnCancel: '❌ Cancel',
    consentNotAllChecked: '⚠️ Please tick all 6 boxes before continuing.',
    consentReprompt: '🔄 *Consent updated*\n\nOur consent disclaimer has been updated. To continue using the bot, please review and agree to the latest version below.',
    consentReconfirmed: '✅ Thank you for re-confirming consent. You can continue using the bot.',
    consentBlockedText: '⚠️ Please complete the consent confirmation above before sending other messages.',
    consentReconsentFailed: '❌ Failed to record re-consent. Please try again.',
    // /help command
    helpUnregistered: '👋 Welcome to *PR-TOP*!\n\nUse /start to register and get started.',
    helpClient: '📋 *Available Commands:*\n\n/start - Register or check your status\n/help - Show this help message\n/profile - View and edit your profile\n/connect `CODE` - Connect with your therapist\n/exercises - View your assigned exercises\n/sos - Emergency alert to your therapist\n/history - View your recent diary entries\n/timezone - View or change your timezone\n/disconnect - Disconnect from your therapist\n\n💡 *Diary:* Simply send a text, voice, or video message to save a diary entry.',
    helpTherapist: '📋 *Available Commands:*\n\n/start - Check your registration status\n/help - Show this help message\n/timezone - View or change your timezone\n/profile - View your profile\n\n💡 *Tip:* Use the web dashboard at pr-top.com to manage your clients, view diaries, and more.',
    // /sos command
    sosConfirmed: '🆘 *SOS alert sent!*\n\nYour therapist has been notified. If you are in immediate danger, please contact emergency services.\n\n🇺🇸 USA: 988 (Suicide & Crisis Lifeline)\n🌍 International: https://findahelpline.com',
    sosFailed: 'Failed to send SOS alert. Please try again or contact emergency services directly.',
    // /history command
    historyHeader: '📖 *Your Recent Diary Entries:*',
    historyEmpty: '📖 You have no diary entries yet.\n\nSend a text or voice message to start your diary!',
    historyFailed: 'Failed to load diary history. Please try again.',
    // /sessions command (T-02) — last 5 sessions with meeting dates
    sessionsHeader: '🎧 *Your recent sessions:*',
    sessionsEmpty: '🎧 You have no sessions recorded yet.\n\nYour therapist will upload session recordings after your meetings.',
    sessionsFailed: 'Failed to load session history. Please try again.',
    // /disconnect command
    disconnectConfirm: '⚠️ *Are you sure you want to disconnect?*\n\nThis will:\n• Revoke your therapist\'s access to your data\n• Remove your therapist connection\n\nYou can reconnect later with a new invite code.',
    disconnectYes: '✅ Yes, disconnect',
    disconnectNo: '❌ No, keep connection',
    disconnected: '✅ You have been disconnected from your therapist.\n\nYour therapist can no longer access your diary entries. Use /connect `CODE` to connect with a therapist again.',
    disconnectCancelled: '👍 Connection kept. Your therapist link is unchanged.',
    disconnectFailed: 'Failed to disconnect. Please try again.',
    // /timezone command
    timezoneCurrentAndChoose: (tz, time) => `🕐 *Your timezone:* ${tz}\n⏰ *Current time:* ${time}\n\nChoose a region to change your timezone:`,
    timezoneUpdated: (tz, time) => `✅ *Timezone updated!*\n\n🕐 *New timezone:* ${tz}\n⏰ *Current time:* ${time}`,
    timezoneFailed: 'Failed to update timezone. Please try again.',
    tzRegionEurope: 'Europe',
    tzRegionAsia: 'Asia',
    tzRegionAmerica: 'Americas',
    tzRegionAfrica: 'Africa',
    tzRegionPacific: 'Pacific / Oceania',
    tzBack: 'Back to regions',
    timezoneDetectedAfterReg: (tz) => `🕐 *Your timezone is set to:* ${tz}\n\nIf this is incorrect (e.g. you use a VPN), tap the button below to change it.`,
    tzChangeButton: '🔄 Change timezone',
    // /settings command
    settingsTherapistOnly: '⚙️ Settings are available only for therapists.',
    settingsTitle: 'Bot Settings',
    settingsForwardVoice: 'Forward client voice messages',
    settingsForwardVoiceDesc: 'When enabled, client voice and video diary messages will be forwarded to your Telegram chat with a caption showing client name and timestamp.',
    settingsEnableForward: 'Enable forwarding',
    settingsDisableForward: 'Disable forwarding',
    settingsForwardEnabled: '✅ Voice forwarding enabled',
    settingsForwardDisabled: '❌ Voice forwarding disabled',
    // /exercises command
    exercisesHeader: '📋 *Your Exercises:*\n',
    exercisesEmpty: '📋 You have no exercises assigned yet.\n\nYour therapist can send you exercises from the dashboard.',
    exercisesFailed: 'Failed to load exercises. Please try again.',
    exerciseStatusSent: '🆕 New',
    exerciseStatusAcknowledged: '▶️ In Progress',
    exerciseStatusCompleted: '✅ Completed',
    exerciseDetail: (title, category, instructions) => `📋 *${title}*\n${category ? `Category: ${category}\n` : ''}\n${instructions || 'No instructions provided.'}\n\nPress *Start* to begin this exercise.`,
    exerciseStarted: '▶️ Exercise started! You can now send your response as a text message.\n\nWhen you\'re ready, just type your answer.',
    exerciseStartFailed: 'Failed to start exercise. Please try again.',
    exerciseCompleted: '✅ Great job! Your exercise response has been recorded.\n\nYour therapist will review it.',
    exerciseCompleteFailed: 'Failed to submit your response. Please try again.',
    exerciseStartBtn: '▶️ Start Exercise',
    exerciseNotFound: 'Exercise not found or already completed.',
    exerciseAwaitingResponse: '✍️ Please type your response to the exercise now.',
    exerciseNoActiveExercise: 'You don\'t have an active exercise. Use /exercises to see your exercises.',
    // T-03: /assignments command — homework set by therapist
    assignmentsHeader: '📝 *Your Assignments:*',
    assignmentsEmpty: '📝 You have no active assignments.\n\nYour therapist will assign tasks at the end of sessions.',
    assignmentsFailed: 'Failed to load assignments. Please try again.',
    assignmentNotFound: 'Assignment not found.',
    assignmentDetail: (title, description, frequency, deadline) =>
      `📝 *${title}*\n\n` +
      (description ? `${description}\n\n` : '') +
      `⏱ *Report frequency:* ${frequency}\n` +
      (deadline ? `📅 *Deadline:* ${deadline}\n` : '') +
      `\nPress *Write report* to send a progress update, or *Mark complete* when finished.`,
    assignmentReportBtn: '✍️ Write report',
    assignmentCompleteBtn: '✅ Mark complete',
    assignmentReportPrompt: (id) => `✍️ Send your progress report for assignment #${id} — text or voice. Your therapist will see it in the assignment feed. You can send as many reports as you like.`,
    assignmentCompletedToast: '✅ Marked complete',
    assignmentCompletedMsg: '✅ Assignment marked as complete. Your therapist will be notified.',
    assignmentCompleteFailed: 'Failed to mark assignment complete. Please try again.',
    assignmentFrequency_daily: 'Daily',
    assignmentFrequency_every_n_days: 'Every few days',
    assignmentFrequency_weekly: 'Weekly',
    assignmentFrequency_on_demand: 'On demand',
    // T-04: freeform progress reports
    reportPickHeader: '📝 Pick an assignment to report on:',
    reportNoAssignments: 'You have no active assignments to report on. Use /assignments to see all your homework.',
    reportAssignmentNotActive: 'That assignment is not in your active list. Use /assignments to see your current homework.',
    reportSaved: '✅ Report sent. Your therapist will see it shortly.',
    reportVoiceSaved: '🎤 Voice report sent! Transcription in progress — your therapist will see the text once it lands.',
    reportFailed: 'Failed to send your report. Please try again.',
    // T-21: Photo attachments on reports
    reportPhotoSaved: '📸 Photo attached to your report. Your therapist will see it in the report feed.',
    reportPhotoFailed: 'Failed to attach the photo. Please try again.',
    reportPhotoMissing: '📸 I could not read the photo. Please try sending it again.',
    reportPhotoIdleHint: '📸 To attach a photo to a progress report, first use /report to pick an assignment, then send the photo.',
    reportPhotoTherapist: '📸 Photo handling is only available for clients in the progress-report flow.',
    reportPhotoStubContent: '[Photo report]',
    // Deep link connect
    deepLinkInvalidCode: 'Invite code not found or invalid.',
    deepLinkFallbackHint: 'You can also try manually with /connect YOUR_CODE',
    // Transcription status
    transcribing: '⏳ [Transcribing...]',
    voiceSavedTranscribing: '🎤 Voice diary entry saved! Transcription in progress...',
    videoSavedTranscribing: '🎥 Video diary entry saved! Transcription in progress...',
    // /profile command
    profileView: (firstName, lastName, phone, username) => `👤 *Your Profile:*\n\n*Name:* ${firstName || '-'} ${lastName || ''}\n*Phone:* ${phone || '-'}\n*Telegram:* ${username ? '@' + username : '-'}\n\nPress a button below to edit:`,
    profileEditName: '✏️ Edit Name',
    profileEditPhone: '📱 Edit Phone',
    profileEnterName: '✏️ Enter your name (First Last):',
    profileEnterPhone: '📱 Enter your phone number:',
    profileNameSaved: '✅ Name updated!',
    profilePhoneSaved: '✅ Phone updated!',
    profileSaveFailed: 'Failed to save profile. Please try again.',
    profileFailed: 'Failed to load profile. Please try again.',
    // Phone sharing during registration
    sharePhonePrompt: '📱 Would you like to share your phone number?\n\nThis helps clients verify your identity.',
    sharePhoneButton: '📱 Share phone number',
    sharePhoneSkip: '⏭ Skip',
    sharePhoneSaved: '✅ Phone number saved! Thank you.',
    sharePhoneSkipped: '⏭ Phone sharing skipped. You can add it later in /profile.',
    // Email during registration
    shareEmailPrompt: '📧 Please enter your email address.\n\nThis will be used for login to the web dashboard and notifications.',
    shareEmailSkip: '⏭ Skip',
    shareEmailSaved: '✅ Email saved! You can use it to log in at pr-top.com.',
    shareEmailSkipped: '⏭ Email skipped. You can add it later in /profile.',
    shareEmailInvalid: '❌ Invalid email format. Please enter a valid email (e.g. name@example.com):',
    shareEmailTaken: '❌ This email is already registered. Please enter a different email:',
    // Other info during registration
    shareOtherInfoPrompt: '📝 Enter additional information about yourself (specialization, experience, license number, etc.).\n\nThis helps clients learn more about you.',
    shareOtherInfoSkip: '⏭ Skip',
    shareOtherInfoSaved: '✅ Information saved! You can update it later in /profile.',
    shareOtherInfoSkipped: '⏭ Skipped. You can add this info later in /profile.',
    // Persistent keyboard buttons
    btnDiary: '📝 Diary',
    btnExercises: '📋 Exercises',
    btnHistory: '📖 History',
    btnSOS: '🆘 SOS',
    btnProfile: '👤 Profile',
    btnHelp: '❓ Help',
    btnOpenDashboard: '🌐 Open dashboard',
    diaryHint: '📝 Write a text, send a voice or video — it will become a diary entry. Your therapist will see it before the next session.',
    dashboardLink: '🌐 Open the web dashboard to manage clients, view diaries, and analytics.'
  },
  ru: {
    botAbout: 'PR-TOP — платформа для психотерапевтов. Контекст клиента, дневники, упражнения, SOS-кнопка. Шифрование и GDPR.',
    botDescription: `PR-TOP — безопасная платформа между сессиями для психотерапевтов.

Для терапевтов:
• Контекст между сессиями — без двойной документации
• Дневники клиентов (текст, голос, видео) с транскрипцией
• Упражнения из библиотеки или свои
• SOS-уведомления при кризисах
• Веб-панель с аналитикой и таймлайном

Подключайте клиентов одной ссылкой.

🔒 Шифрование · GDPR · Данные только ваши`,
    welcomeBack: (role) => {
      const roleLabel = role === 'therapist' ? 'Терапевт' : 'Клиент';
      return `С возвращением! Вы зарегистрированы как ${roleLabel}.\n\nИспользуйте /help для просмотра доступных команд.`;
    },
    chooseRoleIntro: '🧠 PR-TOP — ваш профессиональный помощник между сессиями\n\nБезопасная платформа, которая помогает терапевтам и клиентам работать эффективнее между встречами.\n\n🔒 Все данные защищены сквозным шифрованием\n\nКто вы?',
    chooseRole: 'Добро пожаловать в PR-TOP! Выберите вашу роль:',
    roleTherapist: '🧑‍⚕️ Я терапевт',
    roleClient: '🙋 Я клиент',
    connectUsage: '📋 Чтобы подключиться к терапевту, используйте:\n`/connect ВАШ_КОД`\n\nЗамените ВАШ_КОД кодом приглашения, который дал вам терапевт.',
    foundTherapist: (name) => `🔗 Найден терапевт: *${name}*\n\nПодключаясь, вы даёте согласие на передачу записей дневника, ответов на упражнения и данных активности вашему терапевту.\n\nХотите подключиться?`,
    consentYes: '✅ Да, я согласен(на)',
    consentNo: '❌ Нет, отмена',
    connected: '✅ Вы подключены к своему терапевту!\n\nТеперь вы можете:\n• Вести дневник, отправляя текстовые сообщения\n• Отправлять голосовые сообщения в дневник\n• Использовать /sos для экстренной связи\n\nИспользуйте /help для просмотра команд.',
    connectionCancelled: '❌ Подключение отменено. Попробуйте снова с /connect <код>.',
    alreadyRegistered: (role) => {
      const roleLabel = role === 'therapist' ? 'терапевт' : 'клиент';
      return `Вы уже зарегистрированы как ${roleLabel}. Используйте /help для просмотра команд.`;
    },
    welcomeTherapist: (code) => `✅ Добро пожаловать в PR-TOP!\n\nВот что платформа даёт вам как терапевту:\n\n📊 *Контекст между сессиями* — вся информация о клиенте в одном месте, без двойной документации\n📝 *Дневники клиентов* — текст, голос и видео с автоматической транскрипцией и AI-саммари\n📋 *Упражнения* — назначайте из библиотеки или создавайте свои, отслеживайте выполнение\n🆘 *SOS-уведомления* — мгновенный сигнал, если клиенту нужна экстренная поддержка\n🎤 *Умный поиск* — задавайте вопросы о клиенте голосом или текстом, AI найдёт ответ в контексте\n📈 *Веб-панель* — дашборд, таймлайн, аналитика на pr-top.com\n\n*Ваш код приглашения:* \`${code}\`\n📎 Отправьте ссылку клиентам — они подключатся в один клик.\n\nИспользуйте /help для списка команд.`,
    welcomeClient: '✅ Добро пожаловать в PR-TOP!\n\nЭтот бот — ваше безопасное пространство для работы между сессиями с терапевтом.\n\nЧто вы можете:\n📝 *Дневник мыслей* — записывайте текст, голосовые или видео в любое время. Терапевт увидит их к следующей сессии\n📋 *Упражнения* — выполняйте задания от терапевта в удобном темпе\n🆘 *SOS-кнопка* — мгновенная связь с терапевтом, если нужна срочная поддержка\n🔒 *Приватность* — все данные зашифрованы, доступ только у вас и вашего терапевта\n\nЧтобы начать, подключитесь к терапевту:\n/connect КОД\\_ПРИГЛАШЕНИЯ\n\n💡 Код вам отправит ваш терапевт.',
    deepLinkClientWelcome: '✅ Добро пожаловать в PR-TOP!\n\nЭтот бот — ваше безопасное пространство для работы между сессиями с терапевтом.\n\n📝 Дневник мыслей — текст, голос, видео\n📋 Упражнения от терапевта\n🆘 SOS-кнопка для экстренной связи\n🔒 Все данные зашифрованы\n\nСейчас подключим вас к терапевту...',
    registrationError: '❌ Произошла ошибка при регистрации. Попробуйте снова с /start.',
    voiceSaved: '🎤 Голосовая запись дневника сохранена! Ваш терапевт сможет её прослушать.',
    videoSaved: '🎥 Видеозапись дневника сохранена! Ваш терапевт сможет её просмотреть.',
    diarySaved: '📝 Запись дневника сохранена!',
    failedVoiceDiary: 'Не удалось сохранить голосовую запись дневника.',
    failedVideoDiary: 'Не удалось сохранить видеозапись дневника.',
    failedDiary: 'Не удалось сохранить запись дневника.',
    // T-12 — bot.comment.makePrivate: клиент может скрыть свежесохранённую
    // запись дневника от терапевта. По умолчанию запись общая.
    commentMakePrivate: '🔒 Сделать приватной',
    commentMadePrivate: '🔒 Запись помечена приватной. Терапевт её не увидит.',
    commentAlreadyPrivate: '🔒 Эта запись уже приватная.',
    commentMakePrivateFailed: 'Не удалось сделать запись приватной. Попробуйте ещё раз.',
    therapistFreeText: '💡 Как терапевт, используйте веб-панель для управления клиентами.\n\nВведите /help для просмотра доступных команд.',
    therapistVoiceText: '💡 Голосовые записи дневника доступны только клиентам.\n\nКак терапевт, используйте веб-панель для управления клиентами.\nВведите /help для просмотра команд.',
    therapistVideoText: '💡 Видеозаписи дневника доступны только клиентам.\n\nКак терапевт, используйте веб-панель для управления клиентами.\nВведите /help для просмотра команд.',
    failedInviteCode: 'Не удалось обработать код приглашения. Попробуйте снова.',
    failedConsent: 'Не удалось обработать согласие. Попробуйте снова.',
    // T-18 Extended consent disclaimer (multi-checkbox flow)
    // T-399: bumped to 6 points, added sessionReminders
    consentDisclaimerHeader: (name, version) => `🔐 *Информированное согласие (v${version}) — ${name}*\n\nПрежде чем подключиться, пожалуйста, ознакомьтесь и согласитесь со *всеми шестью* пунктами ниже. Этот шаг нельзя пропустить — ваш терапевт работает с вами между сессиями только при наличии вашего информированного согласия.`,
    consentDisclaimerStorage: '1. 📦 *Хранение данных*\nЗаписи дневника (текст, голос, видео), ответы на упражнения и SOS-события хранятся на наших серверах, пока вы подключены к терапевту. После отключения данные сохраняются согласно требованиям законодательства, но недоступны через приложение.',
    consentDisclaimerAi: '2. 🤖 *AI-обработка*\nГолосовые и видеосообщения отправляются в AI-сервисы для транскрипции. Транскрипты и текст могут быть проанализированы и проиндексированы AI, чтобы терапевт мог быстрее находить нужное в вашей истории. AI-результаты видны только вашему терапевту.',
    consentDisclaimerSupervision: '3. 👥 *Анонимизированная супервизия*\nВаш терапевт может поделиться обезличенным снимком вашей истории со своим клиническим супервизором (без имени, без контактов, с фиксированным сроком действия). В супервизии вас невозможно идентифицировать.',
    consentDisclaimerRevoke: '4. ↩️ *Право отозвать согласие*\nВы можете в любой момент использовать /disconnect. Это немедленно отзывает доступ терапевта к вашим данным. Сохранённые данные хранятся согласно законодательству, но больше недоступны через приложение.',
    consentDisclaimerEncryption: '5. 🔒 *Шифрование*\nВесь чувствительный контент (дневник, транскрипты, саммари, заметки) хранится в зашифрованном виде (AES). Только аутентифицированная сессия вашего терапевта, при сохранении вашего согласия, может расшифровать данные.',
    consentDisclaimerSessionReminders: '6. 📅 *Напоминания о сессиях*\nНапоминания о предстоящих сессиях могут отправляться вам через Telegram и электронную почту. Вы можете отказаться от них в любое время.',
    consentDisclaimerFooter: 'Отметьте *каждый* из шести пунктов ниже, затем нажмите *Согласен и подключиться*.',
    consentCheckboxStorage: 'Согласен на хранение данных',
    consentCheckboxAi: 'Согласен на AI-обработку',
    consentCheckboxSupervision: 'Согласен на анонимную супервизию',
    consentCheckboxRevoke: 'Понимаю право на отзыв',
    consentCheckboxEncryption: 'Принимаю условия шифрования',
    consentCheckboxSessionReminders: 'Понимаю, что могут отправляться напоминания о сессиях',
    consentBtnContinue: '✅ Согласен и подключиться',
    consentBtnCancel: '❌ Отмена',
    consentNotAllChecked: '⚠️ Пожалуйста, отметьте все 6 пунктов перед продолжением.',
    consentReprompt: '🔄 *Согласие обновлено*\n\nТекст согласия был обновлён. Чтобы продолжить пользоваться ботом, пожалуйста, ознакомьтесь и согласитесь с новой версией ниже.',
    consentReconfirmed: '✅ Спасибо за подтверждение согласия. Вы можете продолжать пользоваться ботом.',
    consentBlockedText: '⚠️ Пожалуйста, завершите подтверждение согласия выше, прежде чем отправлять другие сообщения.',
    consentReconsentFailed: '❌ Не удалось зафиксировать повторное согласие. Попробуйте снова.',
    // /help
    helpUnregistered: '👋 Добро пожаловать в *PR-TOP*!\n\nИспользуйте /start для регистрации.',
    helpClient: '📋 *Доступные команды:*\n\n/start - Регистрация или проверка статуса\n/help - Показать эту справку\n/profile - Просмотр и редактирование профиля\n/connect `КОД` - Подключиться к терапевту\n/exercises - Просмотр назначенных упражнений\n/sos - Экстренный сигнал терапевту\n/history - Просмотр последних записей дневника\n/timezone - Просмотр или изменение часового пояса\n/disconnect - Отключиться от терапевта\n\n💡 *Дневник:* Просто отправьте текстовое, голосовое или видеосообщение для записи в дневник.',
    helpTherapist: '📋 *Доступные команды:*\n\n/start - Проверка статуса регистрации\n/help - Показать эту справку\n/timezone - Просмотр или изменение часового пояса\n/profile - Просмотр профиля\n\n💡 *Совет:* Используйте веб-панель на pr-top.com для управления клиентами, просмотра дневников и многого другого.',
    // /sos
    sosConfirmed: '🆘 *SOS-сигнал отправлен!*\n\nВаш терапевт уведомлён. Если вы в непосредственной опасности, обратитесь в службу экстренной помощи.\n\n🇷🇺 Россия: 8-800-2000-122 (телефон доверия)\n🌍 Международный: https://findahelpline.com',
    sosFailed: 'Не удалось отправить SOS-сигнал. Попробуйте снова или обратитесь в экстренные службы.',
    // /history
    historyHeader: '📖 *Ваши последние записи дневника:*',
    historyEmpty: '📖 У вас пока нет записей в дневнике.\n\nОтправьте текстовое или голосовое сообщение, чтобы начать вести дневник!',
    historyFailed: 'Не удалось загрузить историю дневника. Попробуйте снова.',
    // /sessions (T-02)
    sessionsHeader: '🎧 *Ваши последние сессии:*',
    sessionsEmpty: '🎧 У вас пока нет записанных сессий.\n\nТерапевт загрузит записи после встреч.',
    sessionsFailed: 'Не удалось загрузить историю сессий. Попробуйте снова.',
    // /disconnect
    disconnectConfirm: '⚠️ *Вы уверены, что хотите отключиться?*\n\nЭто:\n• Отзовёт доступ терапевта к вашим данным\n• Удалит связь с терапевтом\n\nВы сможете подключиться снова с новым кодом приглашения.',
    disconnectYes: '✅ Да, отключиться',
    disconnectNo: '❌ Нет, оставить подключение',
    disconnected: '✅ Вы отключены от терапевта.\n\nВаш терапевт больше не имеет доступа к вашему дневнику. Используйте /connect `КОД` для нового подключения.',
    disconnectCancelled: '👍 Подключение сохранено. Связь с терапевтом не изменена.',
    disconnectFailed: 'Не удалось отключиться. Попробуйте снова.',
    // /timezone
    timezoneCurrentAndChoose: (tz, time) => `🕐 *Ваш часовой пояс:* ${tz}\n⏰ *Текущее время:* ${time}\n\nВыберите регион для изменения часового пояса:`,
    timezoneUpdated: (tz, time) => `✅ *Часовой пояс обновлён!*\n\n🕐 *Новый часовой пояс:* ${tz}\n⏰ *Текущее время:* ${time}`,
    timezoneFailed: 'Не удалось обновить часовой пояс. Попробуйте снова.',
    tzRegionEurope: 'Европа',
    tzRegionAsia: 'Азия',
    tzRegionAmerica: 'Америка',
    tzRegionAfrica: 'Африка',
    tzRegionPacific: 'Тихоокеанский регион',
    tzBack: 'Назад к регионам',
    timezoneDetectedAfterReg: (tz) => `🕐 *Ваш часовой пояс установлен:* ${tz}\n\nЕсли это неверно (например, вы используете VPN), нажмите кнопку ниже, чтобы изменить.`,
    tzChangeButton: '🔄 Изменить часовой пояс',
    // /settings
    settingsTherapistOnly: '⚙️ Настройки доступны только для терапевтов.',
    settingsTitle: 'Настройки бота',
    settingsForwardVoice: 'Пересылка голосовых сообщений клиентов',
    settingsForwardVoiceDesc: 'Когда включено, голосовые и видео дневниковые записи клиентов будут пересылаться в ваш Telegram с именем клиента и временем.',
    settingsEnableForward: 'Включить пересылку',
    settingsDisableForward: 'Отключить пересылку',
    settingsForwardEnabled: '✅ Пересылка голосовых включена',
    settingsForwardDisabled: '❌ Пересылка голосовых отключена',
    // /exercises
    exercisesHeader: '📋 *Ваши упражнения:*\n',
    exercisesEmpty: '📋 У вас пока нет назначенных упражнений.\n\nВаш терапевт может отправить вам упражнения из панели управления.',
    exercisesFailed: 'Не удалось загрузить упражнения. Попробуйте снова.',
    exerciseStatusSent: '🆕 Новое',
    exerciseStatusAcknowledged: '▶️ В процессе',
    exerciseStatusCompleted: '✅ Выполнено',
    exerciseDetail: (title, category, instructions) => `📋 *${title}*\n${category ? `Категория: ${category}\n` : ''}\n${instructions || 'Инструкции не указаны.'}\n\nНажмите *Начать* для выполнения упражнения.`,
    exerciseStarted: '▶️ Упражнение начато! Теперь отправьте ваш ответ текстовым сообщением.\n\nКогда будете готовы, просто напишите ответ.',
    exerciseStartFailed: 'Не удалось начать упражнение. Попробуйте снова.',
    exerciseCompleted: '✅ Отличная работа! Ваш ответ записан.\n\nВаш терапевт его просмотрит.',
    exerciseCompleteFailed: 'Не удалось отправить ответ. Попробуйте снова.',
    exerciseStartBtn: '▶️ Начать упражнение',
    exerciseNotFound: 'Упражнение не найдено или уже выполнено.',
    exerciseAwaitingResponse: '✍️ Напишите ваш ответ на упражнение.',
    exerciseNoActiveExercise: 'У вас нет активного упражнения. Используйте /exercises для просмотра упражнений.',
    // T-03: /assignments command — задания от терапевта
    assignmentsHeader: '📝 *Ваши задания:*',
    assignmentsEmpty: '📝 У вас нет активных заданий.\n\nТерапевт назначит задачи в конце сессии.',
    assignmentsFailed: 'Не удалось загрузить задания. Попробуйте снова.',
    assignmentNotFound: 'Задание не найдено.',
    assignmentDetail: (title, description, frequency, deadline) =>
      `📝 *${title}*\n\n` +
      (description ? `${description}\n\n` : '') +
      `⏱ *Частота отчётов:* ${frequency}\n` +
      (deadline ? `📅 *Срок:* ${deadline}\n` : '') +
      `\nНажмите *Написать отчёт* для отправки обновления или *Отметить выполненным* по завершении.`,
    assignmentReportBtn: '✍️ Написать отчёт',
    assignmentCompleteBtn: '✅ Отметить выполненным',
    assignmentReportPrompt: (id) => `✍️ Отправьте отчёт о прогрессе по заданию #${id} — текстом или голосовым. Терапевт увидит его в ленте задания. Можно отправлять сколько угодно отчётов.`,
    assignmentCompletedToast: '✅ Отмечено выполненным',
    assignmentCompletedMsg: '✅ Задание отмечено выполненным. Терапевт получит уведомление.',
    assignmentCompleteFailed: 'Не удалось отметить задание выполненным. Попробуйте снова.',
    assignmentFrequency_daily: 'Ежедневно',
    assignmentFrequency_every_n_days: 'Раз в несколько дней',
    assignmentFrequency_weekly: 'Раз в неделю',
    assignmentFrequency_on_demand: 'По запросу',
    // T-04: freeform progress reports
    reportPickHeader: '📝 Выберите задание для отчёта:',
    reportNoAssignments: 'У вас нет активных заданий для отчёта. Используйте /assignments чтобы посмотреть все задания.',
    reportAssignmentNotActive: 'Этого задания нет в вашем активном списке. Используйте /assignments чтобы посмотреть текущие задания.',
    reportSaved: '✅ Отчёт отправлен. Терапевт скоро его увидит.',
    reportVoiceSaved: '🎤 Голосовой отчёт отправлен! Транскрибирование выполняется — терапевт увидит текст после завершения.',
    reportFailed: 'Не удалось отправить отчёт. Попробуйте ещё раз.',
    // T-21: Photo attachments on reports
    reportPhotoSaved: '📸 Фото прикреплено к отчёту. Терапевт увидит его в ленте отчётов.',
    reportPhotoFailed: 'Не удалось прикрепить фото. Попробуйте ещё раз.',
    reportPhotoMissing: '📸 Не удалось прочитать фото. Попробуйте отправить его снова.',
    reportPhotoIdleHint: '📸 Чтобы прикрепить фото к отчёту, сначала используйте /report, выберите задание, затем отправьте фото.',
    reportPhotoTherapist: '📸 Загрузка фото доступна только клиентам в режиме отчёта.',
    reportPhotoStubContent: '[Фото-отчёт]',
    // Deep link connect
    deepLinkInvalidCode: 'Код приглашения не найден или недействителен.',
    deepLinkFallbackHint: 'Вы также можете попробовать вручную: /connect ВАШ_КОД',
    // Transcription status
    transcribing: '⏳ [Транскрибирование...]',
    voiceSavedTranscribing: '🎤 Голосовая запись дневника сохранена! Транскрибирование в процессе...',
    videoSavedTranscribing: '🎥 Видеозапись дневника сохранена! Транскрибирование в процессе...',
    // /profile command
    profileView: (firstName, lastName, phone, username) => `👤 *Ваш профиль:*\n\n*Имя:* ${firstName || '-'} ${lastName || ''}\n*Телефон:* ${phone || '-'}\n*Telegram:* ${username ? '@' + username : '-'}\n\nНажмите кнопку для редактирования:`,
    profileEditName: '✏️ Изменить имя',
    profileEditPhone: '📱 Изменить телефон',
    profileEnterName: '✏️ Введите ваше имя (Имя Фамилия):',
    profileEnterPhone: '📱 Введите номер телефона:',
    profileNameSaved: '✅ Имя обновлено!',
    profilePhoneSaved: '✅ Телефон обновлён!',
    profileSaveFailed: 'Не удалось сохранить профиль. Попробуйте ещё раз.',
    profileFailed: 'Не удалось загрузить профиль. Попробуйте ещё раз.',
    // Phone sharing during registration
    sharePhonePrompt: '📱 Хотите поделиться номером телефона?\n\nЭто поможет клиентам подтвердить вашу личность.',
    sharePhoneButton: '📱 Поделиться номером',
    sharePhoneSkip: '⏭ Пропустить',
    sharePhoneSaved: '✅ Номер телефона сохранён! Спасибо.',
    sharePhoneSkipped: '⏭ Отправка номера пропущена. Вы можете добавить его позже в /profile.',
    // Email during registration
    shareEmailPrompt: '📧 Введите ваш email.\n\nОн будет использоваться для входа в веб-панель и уведомлений.',
    shareEmailSkip: '⏭ Пропустить',
    shareEmailSaved: '✅ Email сохранён! Вы можете использовать его для входа на pr-top.com.',
    shareEmailSkipped: '⏭ Email пропущен. Вы можете добавить его позже в /profile.',
    shareEmailInvalid: '❌ Неверный формат email. Введите корректный email (например, name@example.com):',
    shareEmailTaken: '❌ Этот email уже зарегистрирован. Введите другой email:',
    // Other info during registration
    shareOtherInfoPrompt: '📝 Введите дополнительную информацию о себе (специализация, опыт, номер лицензии и т.д.).\n\nЭто поможет клиентам узнать о вас больше.',
    shareOtherInfoSkip: '⏭ Пропустить',
    shareOtherInfoSaved: '✅ Информация сохранена! Вы можете обновить её позже в /profile.',
    shareOtherInfoSkipped: '⏭ Пропущено. Вы можете добавить информацию позже в /profile.',
    // Persistent keyboard buttons
    btnDiary: '📝 Дневник',
    btnExercises: '📋 Упражнения',
    btnHistory: '📖 История',
    btnSOS: '🆘 SOS',
    btnProfile: '👤 Профиль',
    btnHelp: '❓ Помощь',
    btnOpenDashboard: '🌐 Открыть панель',
    diaryHint: '📝 Напишите текст, отправьте голосовое или видео — это станет записью в дневнике. Терапевт увидит её к следующей сессии.',
    dashboardLink: '🌐 Откройте веб-панель для управления клиентами, просмотра дневников и аналитики.'
  },
  es: {
    botAbout: 'PR-TOP — plataforma para psicoterapeutas. Contexto del cliente, diarios, ejercicios, botón SOS. Cifrado y RGPD.',
    botDescription: `PR-TOP — plataforma segura entre sesiones para psicoterapeutas.

Para terapeutas:
• Contexto entre sesiones — sin doble documentación
• Diarios de clientes (texto, voz, video) con transcripción
• Ejercicios de la biblioteca o propios
• Notificaciones SOS en crisis
• Panel web con analítica y línea temporal

Conecta clientes con un enlace — simple y seguro.

🔒 Cifrado · RGPD · Tus datos te pertenecen solo a ti`,
    welcomeBack: (role) => {
      const roleLabel = role === 'therapist' ? 'Terapeuta' : 'Cliente';
      return `¡Bienvenido de nuevo! Estás registrado como ${roleLabel}.\n\nUsa /help para ver los comandos disponibles.`;
    },
    chooseRoleIntro: '🧠 PR-TOP — tu asistente profesional entre sesiones\n\nUna plataforma segura que ayuda a terapeutas y clientes a trabajar de manera más efectiva entre reuniones.\n\n🔒 Todos los datos están protegidos con cifrado de extremo a extremo\n\n¿Quién eres?',
    chooseRole: '¡Bienvenido a PR-TOP! Elige tu rol:',
    roleTherapist: '🧑‍⚕️ Soy terapeuta',
    roleClient: '🙋 Soy cliente',
    connectUsage: '📋 Para conectarte con tu terapeuta, usa:\n`/connect TU_CÓDIGO`\n\nReemplaza TU_CÓDIGO con el código de invitación que te dio tu terapeuta.',
    foundTherapist: (name) => `🔗 Terapeuta encontrado: *${name}*\n\nAl conectarte, das tu consentimiento para compartir tus entradas de diario, respuestas a ejercicios y datos de actividad con este terapeuta.\n\n¿Quieres conectarte?`,
    consentYes: '✅ Sí, doy mi consentimiento',
    consentNo: '❌ No, cancelar',
    connected: '✅ ¡Estás conectado con tu terapeuta!\n\nAhora puedes:\n• Escribir entradas de diario enviando mensajes de texto\n• Enviar mensajes de voz para tu diario\n• Usar /sos para contacto de emergencia\n\nUsa /help para ver todos los comandos disponibles.',
    connectionCancelled: '❌ Conexión cancelada. Puedes intentar de nuevo con /connect <código>.',
    alreadyRegistered: (role) => {
      const roleLabel = role === 'therapist' ? 'terapeuta' : 'cliente';
      return `Ya estás registrado como ${roleLabel}. Usa /help para ver los comandos.`;
    },
    welcomeTherapist: (code) => `✅ ¡Bienvenido a PR-TOP!\n\nEsto es lo que la plataforma te ofrece como terapeuta:\n\n📊 *Contexto entre sesiones* — toda la información del cliente en un solo lugar, sin doble documentación\n📝 *Diarios de clientes* — texto, voz y video con transcripción automática y resúmenes IA\n📋 *Ejercicios* — asigna de la biblioteca o crea los tuyos, sigue el progreso\n🆘 *Notificaciones SOS* — alerta instantánea si un cliente necesita apoyo urgente\n🎤 *Búsqueda inteligente* — haz preguntas sobre un cliente por voz o texto, la IA encuentra la respuesta\n📈 *Panel web* — dashboard, línea temporal, analítica en pr-top.com\n\n*Tu código de invitación:* \`${code}\`\n📎 Envía el enlace a tus clientes — se conectan con un solo clic.\n\nUsa /help para la lista de comandos.`,
    welcomeClient: '✅ ¡Bienvenido a PR-TOP!\n\nEste bot es tu espacio seguro para el trabajo entre sesiones con tu terapeuta.\n\nLo que puedes hacer:\n📝 *Diario de pensamientos* — escribe texto, voz o video en cualquier momento. Tu terapeuta los verá antes de la próxima sesión\n📋 *Ejercicios* — completa las tareas de tu terapeuta a tu propio ritmo\n🆘 *Botón SOS* — contacto instantáneo con tu terapeuta si necesitas apoyo urgente\n🔒 *Privacidad* — todos los datos están cifrados, solo tú y tu terapeuta tienen acceso\n\nPara empezar, conéctate con tu terapeuta:\n/connect CÓDIGO\\_INVITACIÓN\n\n💡 Tu terapeuta te enviará el código.',
    deepLinkClientWelcome: '✅ ¡Bienvenido a PR-TOP!\n\nEste bot es tu espacio seguro para el trabajo entre sesiones con tu terapeuta.\n\n📝 Diario de pensamientos — texto, voz, video\n📋 Ejercicios de tu terapeuta\n🆘 Botón SOS para contacto urgente\n🔒 Todos los datos están cifrados\n\nConectándote con tu terapeuta ahora...',
    registrationError: '❌ Lo sentimos, hubo un error durante el registro. Intenta de nuevo con /start.',
    voiceSaved: '🎤 ¡Entrada de diario de voz guardada! Tu terapeuta podrá escucharla.',
    videoSaved: '🎥 ¡Entrada de diario de video guardada! Tu terapeuta podrá verla.',
    diarySaved: '📝 ¡Entrada de diario guardada!',
    // T-12 — bot.comment.makePrivate: el cliente puede ocultar al terapeuta
    // una entrada recién guardada del diario. Por defecto es compartida.
    commentMakePrivate: '🔒 Hacerla privada',
    commentMadePrivate: '🔒 Entrada marcada como privada. Tu terapeuta no la verá.',
    commentAlreadyPrivate: '🔒 Esta entrada ya es privada.',
    commentMakePrivateFailed: 'No se pudo marcar como privada. Inténtalo de nuevo.',
    failedVoiceDiary: 'No se pudo guardar la entrada de voz del diario.',
    failedVideoDiary: 'No se pudo guardar la entrada de video del diario.',
    failedDiary: 'No se pudo guardar la entrada del diario.',
    therapistFreeText: '💡 Como terapeuta, usa el panel web para gestionar clientes.\n\nEscribe /help para ver los comandos disponibles.',
    therapistVoiceText: '💡 Las entradas de diario de voz son solo para clientes.\n\nComo terapeuta, usa el panel web para gestionar tus clientes.\nEscribe /help para ver los comandos.',
    therapistVideoText: '💡 Las entradas de diario de video son solo para clientes.\n\nComo terapeuta, usa el panel web para gestionar tus clientes.\nEscribe /help para ver los comandos.',
    failedInviteCode: 'No se pudo procesar el código de invitación. Inténtalo de nuevo.',
    failedConsent: 'No se pudo procesar el consentimiento. Inténtalo de nuevo.',
    // T-18 Extended consent disclaimer (multi-checkbox flow)
    // T-399: bumped to 6 points, added sessionReminders
    consentDisclaimerHeader: (name, version) => `🔐 *Consentimiento informado (v${version}) — ${name}*\n\nAntes de conectarte, por favor lee y acepta *los seis* puntos siguientes. No puedes saltarte este paso — tu terapeuta confía en tu consentimiento informado para trabajar contigo entre sesiones.`,
    consentDisclaimerStorage: '1. 📦 *Almacenamiento de datos*\nTus entradas de diario (texto, voz, vídeo), respuestas a ejercicios y eventos SOS se guardan en nuestros servidores mientras estés conectado a tu terapeuta. Tras desconectarte, los datos se conservan según los requisitos legales pero ya no son accesibles desde la app.',
    consentDisclaimerAi: '2. 🤖 *Procesamiento por IA*\nLos mensajes de voz y vídeo se envían a servicios de transcripción por IA. Los transcritos y el texto pueden ser resumidos e indexados por IA para ayudar a tu terapeuta a navegar tu historial. Solo tu terapeuta ve los resultados de IA.',
    consentDisclaimerSupervision: '3. 👥 *Supervisión anonimizada*\nTu terapeuta puede compartir una instantánea anonimizada de tu historial con su supervisor clínico (sin nombre, sin datos de contacto, con caducidad fija). No serás identificado personalmente en supervisión.',
    consentDisclaimerRevoke: '4. ↩️ *Derecho a revocar*\nPuedes usar /disconnect en cualquier momento. Esto revoca de inmediato el acceso del terapeuta a tus datos. Los datos almacenados se conservan según la ley pero ya no son accesibles desde la app.',
    consentDisclaimerEncryption: '5. 🔒 *Cifrado*\nTodo el contenido sensible (diario, transcripciones, resúmenes, notas) se almacena cifrado con AES. Solo la sesión autenticada de tu terapeuta, con tu consentimiento vigente, puede descifrar tus datos.',
    consentDisclaimerSessionReminders: '6. 📅 *Recordatorios de sesiones*\nPueden enviarte recordatorios sobre tus próximas sesiones por Telegram y correo electrónico. Puedes darte de baja en cualquier momento.',
    consentDisclaimerFooter: 'Marca *cada* una de las seis casillas y pulsa *Acepto y conectar*.',
    consentCheckboxStorage: 'Acepto el almacenamiento de datos',
    consentCheckboxAi: 'Acepto el procesamiento por IA',
    consentCheckboxSupervision: 'Acepto la supervisión anonimizada',
    consentCheckboxRevoke: 'Comprendo mi derecho a revocar',
    consentCheckboxEncryption: 'Acepto los términos de cifrado',
    consentCheckboxSessionReminders: 'Entiendo que pueden enviarse recordatorios de sesiones',
    consentBtnContinue: '✅ Acepto y conectar',
    consentBtnCancel: '❌ Cancelar',
    consentNotAllChecked: '⚠️ Por favor marca las 6 casillas antes de continuar.',
    consentReprompt: '🔄 *Consentimiento actualizado*\n\nNuestro texto de consentimiento se ha actualizado. Para seguir usando el bot, por favor revisa y acepta la nueva versión a continuación.',
    consentReconfirmed: '✅ Gracias por reconfirmar tu consentimiento. Puedes seguir usando el bot.',
    consentBlockedText: '⚠️ Por favor completa la confirmación de consentimiento de arriba antes de enviar otros mensajes.',
    consentReconsentFailed: '❌ No se pudo registrar el reconsentimiento. Inténtalo de nuevo.',
    // /help
    helpUnregistered: '👋 ¡Bienvenido a *PR-TOP*!\n\nUsa /start para registrarte y comenzar.',
    helpClient: '📋 *Comandos disponibles:*\n\n/start - Registrarse o verificar tu estado\n/help - Mostrar esta ayuda\n/profile - Ver y editar tu perfil\n/connect `CÓDIGO` - Conectarte con tu terapeuta\n/exercises - Ver tus ejercicios asignados\n/sos - Alerta de emergencia a tu terapeuta\n/history - Ver tus entradas recientes del diario\n/timezone - Ver o cambiar tu zona horaria\n/disconnect - Desconectarte de tu terapeuta\n\n💡 *Diario:* Simplemente envía un mensaje de texto, voz o video para guardar una entrada de diario.',
    helpTherapist: '📋 *Comandos disponibles:*\n\n/start - Verificar tu estado de registro\n/help - Mostrar esta ayuda\n/timezone - Ver o cambiar tu zona horaria\n/profile - Ver tu perfil\n\n💡 *Consejo:* Usa el panel web en pr-top.com para gestionar tus clientes, ver diarios y más.',
    // /sos
    sosConfirmed: '🆘 *¡Alerta SOS enviada!*\n\nTu terapeuta ha sido notificado. Si estás en peligro inmediato, contacta a los servicios de emergencia.\n\n🇪🇸 España: 024 (Línea de Atención a la Conducta Suicida)\n🌍 Internacional: https://findahelpline.com',
    sosFailed: 'No se pudo enviar la alerta SOS. Inténtalo de nuevo o contacta directamente a los servicios de emergencia.',
    // /history
    historyHeader: '📖 *Tus entradas recientes del diario:*',
    historyEmpty: '📖 Aún no tienes entradas en el diario.\n\n¡Envía un mensaje de texto o voz para comenzar tu diario!',
    historyFailed: 'No se pudo cargar el historial del diario. Inténtalo de nuevo.',
    // /sessions (T-02)
    sessionsHeader: '🎧 *Tus sesiones recientes:*',
    sessionsEmpty: '🎧 Aún no tienes sesiones registradas.\n\nTu terapeuta cargará las grabaciones después de los encuentros.',
    sessionsFailed: 'No se pudo cargar el historial de sesiones. Inténtalo de nuevo.',
    // /disconnect
    disconnectConfirm: '⚠️ *¿Estás seguro de que quieres desconectarte?*\n\nEsto:\n• Revocará el acceso de tu terapeuta a tus datos\n• Eliminará tu conexión con el terapeuta\n\nPodrás reconectarte más tarde con un nuevo código de invitación.',
    disconnectYes: '✅ Sí, desconectar',
    disconnectNo: '❌ No, mantener conexión',
    disconnected: '✅ Te has desconectado de tu terapeuta.\n\nTu terapeuta ya no puede acceder a tus entradas de diario. Usa /connect `CÓDIGO` para conectarte con un terapeuta nuevamente.',
    disconnectCancelled: '👍 Conexión mantenida. Tu vínculo con el terapeuta no ha cambiado.',
    disconnectFailed: 'No se pudo desconectar. Inténtalo de nuevo.',
    // /timezone
    timezoneCurrentAndChoose: (tz, time) => `🕐 *Tu zona horaria:* ${tz}\n⏰ *Hora actual:* ${time}\n\nElige una región para cambiar tu zona horaria:`,
    timezoneUpdated: (tz, time) => `✅ *¡Zona horaria actualizada!*\n\n🕐 *Nueva zona horaria:* ${tz}\n⏰ *Hora actual:* ${time}`,
    timezoneFailed: 'No se pudo actualizar la zona horaria. Inténtalo de nuevo.',
    tzRegionEurope: 'Europa',
    tzRegionAsia: 'Asia',
    tzRegionAmerica: 'Américas',
    tzRegionAfrica: 'África',
    tzRegionPacific: 'Pacífico / Oceanía',
    tzBack: 'Volver a regiones',
    timezoneDetectedAfterReg: (tz) => `🕐 *Tu zona horaria está configurada como:* ${tz}\n\nSi esto es incorrecto (por ejemplo, si usas VPN), toca el botón de abajo para cambiarla.`,
    tzChangeButton: '🔄 Cambiar zona horaria',
    // /settings
    settingsTherapistOnly: '⚙️ La configuración solo está disponible para terapeutas.',
    settingsTitle: 'Configuración del bot',
    settingsForwardVoice: 'Reenviar mensajes de voz de clientes',
    settingsForwardVoiceDesc: 'Cuando está activado, los mensajes de voz y video del diario de clientes se reenviarán a tu chat de Telegram con el nombre del cliente y la hora.',
    settingsEnableForward: 'Activar reenvío',
    settingsDisableForward: 'Desactivar reenvío',
    settingsForwardEnabled: '✅ Reenvío de voz activado',
    settingsForwardDisabled: '❌ Reenvío de voz desactivado',
    // /exercises
    exercisesHeader: '📋 *Tus ejercicios:*\n',
    exercisesEmpty: '📋 Aún no tienes ejercicios asignados.\n\nTu terapeuta puede enviarte ejercicios desde el panel.',
    exercisesFailed: 'No se pudieron cargar los ejercicios. Inténtalo de nuevo.',
    exerciseStatusSent: '🆕 Nuevo',
    exerciseStatusAcknowledged: '▶️ En progreso',
    exerciseStatusCompleted: '✅ Completado',
    exerciseDetail: (title, category, instructions) => `📋 *${title}*\n${category ? `Categoría: ${category}\n` : ''}\n${instructions || 'No se proporcionaron instrucciones.'}\n\nPresiona *Iniciar* para comenzar este ejercicio.`,
    exerciseStarted: '▶️ ¡Ejercicio iniciado! Ahora puedes enviar tu respuesta como mensaje de texto.\n\nCuando estés listo, simplemente escribe tu respuesta.',
    exerciseStartFailed: 'No se pudo iniciar el ejercicio. Inténtalo de nuevo.',
    exerciseCompleted: '✅ ¡Buen trabajo! Tu respuesta ha sido registrada.\n\nTu terapeuta la revisará.',
    exerciseCompleteFailed: 'No se pudo enviar tu respuesta. Inténtalo de nuevo.',
    exerciseStartBtn: '▶️ Iniciar ejercicio',
    exerciseNotFound: 'Ejercicio no encontrado o ya completado.',
    exerciseAwaitingResponse: '✍️ Escribe tu respuesta al ejercicio ahora.',
    exerciseNoActiveExercise: 'No tienes un ejercicio activo. Usa /exercises para ver tus ejercicios.',
    // T-03: /assignments — tareas asignadas por el terapeuta
    assignmentsHeader: '📝 *Tus tareas:*',
    assignmentsEmpty: '📝 No tienes tareas activas.\n\nTu terapeuta te asignará tareas al final de las sesiones.',
    assignmentsFailed: 'No se pudieron cargar las tareas. Inténtalo de nuevo.',
    assignmentNotFound: 'Tarea no encontrada.',
    assignmentDetail: (title, description, frequency, deadline) =>
      `📝 *${title}*\n\n` +
      (description ? `${description}\n\n` : '') +
      `⏱ *Frecuencia de informes:* ${frequency}\n` +
      (deadline ? `📅 *Fecha límite:* ${deadline}\n` : '') +
      `\nPulsa *Escribir informe* para enviar una actualización o *Marcar como completada* cuando termines.`,
    assignmentReportBtn: '✍️ Escribir informe',
    assignmentCompleteBtn: '✅ Marcar como completada',
    assignmentReportPrompt: (id) => `✍️ Envía tu informe de progreso para la tarea #${id} — texto o nota de voz. Tu terapeuta lo verá en el hilo de la tarea. Puedes enviar tantos informes como quieras.`,
    assignmentCompletedToast: '✅ Marcada como completada',
    assignmentCompletedMsg: '✅ Tarea marcada como completada. Tu terapeuta será notificado.',
    assignmentCompleteFailed: 'No se pudo marcar la tarea como completada. Inténtalo de nuevo.',
    assignmentFrequency_daily: 'Diaria',
    assignmentFrequency_every_n_days: 'Cada pocos días',
    assignmentFrequency_weekly: 'Semanal',
    assignmentFrequency_on_demand: 'A demanda',
    // T-04: informes libres de progreso
    reportPickHeader: '📝 Elige una tarea para informar:',
    reportNoAssignments: 'No tienes tareas activas para informar. Usa /assignments para ver tus tareas.',
    reportAssignmentNotActive: 'Esa tarea no está en tu lista activa. Usa /assignments para ver tus tareas actuales.',
    reportSaved: '✅ Informe enviado. Tu terapeuta lo verá pronto.',
    reportVoiceSaved: '🎤 ¡Informe de voz enviado! Transcripción en progreso — tu terapeuta verá el texto en cuanto llegue.',
    reportFailed: 'No se pudo enviar el informe. Inténtalo de nuevo.',
    // T-21: Adjuntos de fotos en informes
    reportPhotoSaved: '📸 Foto adjuntada al informe. Tu terapeuta la verá en el hilo de informes.',
    reportPhotoFailed: 'No se pudo adjuntar la foto. Inténtalo de nuevo.',
    reportPhotoMissing: '📸 No pude leer la foto. Intenta enviarla de nuevo.',
    reportPhotoIdleHint: '📸 Para adjuntar una foto a un informe, primero usa /report, elige una tarea y luego envía la foto.',
    reportPhotoTherapist: '📸 La carga de fotos solo está disponible para clientes en el modo de informe.',
    reportPhotoStubContent: '[Informe con foto]',
    // Deep link connect
    deepLinkInvalidCode: 'Código de invitación no encontrado o no válido.',
    deepLinkFallbackHint: 'También puedes intentar manualmente con /connect TU_CÓDIGO',
    // Transcription status
    transcribing: '⏳ [Transcribiendo...]',
    voiceSavedTranscribing: '🎤 ¡Entrada de diario de voz guardada! Transcripción en progreso...',
    videoSavedTranscribing: '🎥 ¡Entrada de diario de video guardada! Transcripción en progreso...',
    // /profile command
    profileView: (firstName, lastName, phone, username) => `👤 *Tu perfil:*\n\n*Nombre:* ${firstName || '-'} ${lastName || ''}\n*Teléfono:* ${phone || '-'}\n*Telegram:* ${username ? '@' + username : '-'}\n\nPresiona un botón para editar:`,
    profileEditName: '✏️ Editar nombre',
    profileEditPhone: '📱 Editar teléfono',
    profileEnterName: '✏️ Ingresa tu nombre (Nombre Apellido):',
    profileEnterPhone: '📱 Ingresa tu número de teléfono:',
    profileNameSaved: '✅ ¡Nombre actualizado!',
    profilePhoneSaved: '✅ ¡Teléfono actualizado!',
    profileSaveFailed: 'No se pudo guardar el perfil. Inténtalo de nuevo.',
    profileFailed: 'No se pudo cargar el perfil. Inténtalo de nuevo.',
    // Phone sharing during registration
    sharePhonePrompt: '📱 ¿Te gustaría compartir tu número de teléfono?\n\nEsto ayuda a los clientes a verificar tu identidad.',
    sharePhoneButton: '📱 Compartir teléfono',
    sharePhoneSkip: '⏭ Omitir',
    sharePhoneSaved: '✅ ¡Número de teléfono guardado! Gracias.',
    sharePhoneSkipped: '⏭ Se omitió el envío del número. Puedes agregarlo después en /profile.',
    // Email during registration
    shareEmailPrompt: '📧 Ingresa tu correo electrónico.\n\nSe usará para iniciar sesión en el panel web y para notificaciones.',
    shareEmailSkip: '⏭ Omitir',
    shareEmailSaved: '✅ ¡Email guardado! Puedes usarlo para iniciar sesión en pr-top.com.',
    shareEmailSkipped: '⏭ Email omitido. Puedes agregarlo después en /profile.',
    shareEmailInvalid: '❌ Formato de email inválido. Ingresa un email válido (ej. name@example.com):',
    shareEmailTaken: '❌ Este email ya está registrado. Ingresa un email diferente:',
    // Other info during registration
    shareOtherInfoPrompt: '📝 Ingresa información adicional sobre ti (especialización, experiencia, número de licencia, etc.).\n\nEsto ayuda a los clientes a conocerte mejor.',
    shareOtherInfoSkip: '⏭ Omitir',
    shareOtherInfoSaved: '✅ ¡Información guardada! Puedes actualizarla después en /profile.',
    shareOtherInfoSkipped: '⏭ Omitido. Puedes agregar esta información después en /profile.',
    // Persistent keyboard buttons
    btnDiary: '📝 Diario',
    btnExercises: '📋 Ejercicios',
    btnHistory: '📖 Historial',
    btnSOS: '🆘 SOS',
    btnProfile: '👤 Perfil',
    btnHelp: '❓ Ayuda',
    btnOpenDashboard: '🌐 Abrir panel',
    diaryHint: '📝 Escribe un texto, envía una nota de voz o video — se guardará como entrada de diario. Tu terapeuta lo verá antes de la próxima sesión.',
    dashboardLink: '🌐 Abre el panel web para gestionar clientes, ver diarios y analítica.'
  },
  uk: {
    botAbout: 'PR-TOP — платформа для психотерапевтів. Контекст клієнта, щоденники, вправи, SOS-кнопка. Шифрування та GDPR.',
    botDescription: `PR-TOP — безпечна платформа між сесіями для психотерапевтів.

Для терапевтів:
• Контекст між сесіями — без подвійної документації
• Щоденники клієнтів (текст, голос, відео) з транскрипцією
• Вправи з бібліотеки або власні
• SOS-сповіщення при кризах
• Веб-панель з аналітикою та таймлайном

Під'єднуйте клієнтів одним посиланням.

🔒 Шифрування · GDPR · Дані тільки ваші`,
    welcomeBack: (role) => {
      const roleLabel = role === 'therapist' ? 'Терапевт' : 'Клієнт';
      return `З поверненням! Ви зареєстровані як ${roleLabel}.\n\nВикористовуйте /help для перегляду доступних команд.`;
    },
    chooseRoleIntro: '🧠 PR-TOP — ваш професійний помічник між сесіями\n\nБезпечна платформа, що допомагає терапевтам і клієнтам працювати ефективніше між зустрічами.\n\n🔒 Усі дані захищені наскрізним шифруванням\n\nХто ви?',
    chooseRole: 'Ласкаво просимо до PR-TOP! Оберіть вашу роль:',
    roleTherapist: '🧑‍⚕️ Я терапевт',
    roleClient: '🙋 Я клієнт',
    connectUsage: '📋 Щоб під\'єднатися до терапевта, використовуйте:\n`/connect ВАШ_КОД`\n\nЗамініть ВАШ_КОД кодом запрошення, який надав вам терапевт.',
    foundTherapist: (name) => `🔗 Знайдено терапевта: *${name}*\n\nПід'єднуючись, ви даєте згоду на передачу записів щоденника, відповідей на вправи та даних активності вашому терапевту.\n\nБажаєте під'єднатися?`,
    consentYes: '✅ Так, я згоден(на)',
    consentNo: '❌ Ні, скасувати',
    connected: '✅ Ви під\'єднані до свого терапевта!\n\nТепер ви можете:\n• Вести щоденник, надсилаючи текстові повідомлення\n• Надсилати голосові повідомлення до щоденника\n• Використовувати /sos для екстреного зв\'язку\n\nВикористовуйте /help для перегляду команд.',
    connectionCancelled: '❌ Під\'єднання скасовано. Спробуйте знову з /connect <код>.',
    alreadyRegistered: (role) => {
      const roleLabel = role === 'therapist' ? 'терапевт' : 'клієнт';
      return `Ви вже зареєстровані як ${roleLabel}. Використовуйте /help для перегляду команд.`;
    },
    welcomeTherapist: (code) => `✅ Ласкаво просимо до PR-TOP!\n\nОсь що платформа дає вам як терапевту:\n\n📊 *Контекст між сесіями* — вся інформація про клієнта в одному місці, без подвійної документації\n📝 *Щоденники клієнтів* — текст, голос і відео з автоматичною транскрипцією та AI-підсумками\n📋 *Вправи* — призначайте з бібліотеки або створюйте власні, відстежуйте виконання\n🆘 *SOS-сповіщення* — миттєвий сигнал, якщо клієнту потрібна екстрена підтримка\n🎤 *Розумний пошук* — задавайте питання про клієнта голосом або текстом, AI знайде відповідь\n📈 *Веб-панель* — дашборд, таймлайн, аналітика на pr-top.com\n\n*Ваш код запрошення:* \`${code}\`\n📎 Надішліть посилання клієнтам — вони під\'єднаються в один клік.\n\nВикористовуйте /help для списку команд.`,
    welcomeClient: '✅ Ласкаво просимо до PR-TOP!\n\nЦей бот — ваш безпечний простір для роботи між сесіями з терапевтом.\n\nЩо ви можете:\n📝 *Щоденник думок* — записуйте текст, голосові або відео в будь-який час. Терапевт побачить їх до наступної сесії\n📋 *Вправи* — виконуйте завдання від терапевта у зручному темпі\n🆘 *SOS-кнопка* — миттєвий зв\'язок з терапевтом, якщо потрібна термінова підтримка\n🔒 *Приватність* — всі дані зашифровані, доступ тільки у вас і вашого терапевта\n\nЩоб почати, під\'єднайтеся до терапевта:\n/connect КОД\\_ЗАПРОШЕННЯ\n\n💡 Код вам надішле ваш терапевт.',
    deepLinkClientWelcome: '✅ Ласкаво просимо до PR-TOP!\n\nЦей бот — ваш безпечний простір для роботи між сесіями з терапевтом.\n\n📝 Щоденник думок — текст, голос, відео\n📋 Вправи від терапевта\n🆘 SOS-кнопка для екстреного зв\'язку\n🔒 Усі дані зашифровані\n\nЗараз під\'єднаємо вас до терапевта...',
    registrationError: '❌ Виникла помилка під час реєстрації. Спробуйте знову з /start.',
    voiceSaved: '🎤 Голосовий запис щоденника збережено! Ваш терапевт зможе його прослухати.',
    videoSaved: '🎥 Відеозапис щоденника збережено! Ваш терапевт зможе його переглянути.',
    diarySaved: '📝 Запис щоденника збережено!',
    failedVoiceDiary: 'Не вдалося зберегти голосовий запис щоденника.',
    failedVideoDiary: 'Не вдалося зберегти відеозапис щоденника.',
    failedDiary: 'Не вдалося зберегти запис щоденника.',
    // T-12 — bot.comment.makePrivate: клієнт може зробити щойно збережений
    // запис щоденника приватним, щоб терапевт його не бачив. За замовчуванням
    // запис є спільним.
    commentMakePrivate: '🔒 Зробити приватним',
    commentMadePrivate: '🔒 Запис позначено приватним. Терапевт його не побачить.',
    commentAlreadyPrivate: '🔒 Цей запис уже приватний.',
    commentMakePrivateFailed: 'Не вдалося зробити запис приватним. Спробуйте ще раз.',
    therapistFreeText: '💡 Як терапевт, використовуйте веб-панель для керування клієнтами.\n\nВведіть /help для перегляду доступних команд.',
    therapistVoiceText: '💡 Голосові записи щоденника доступні лише клієнтам.\n\nЯк терапевт, використовуйте веб-панель для керування клієнтами.\nВведіть /help для перегляду команд.',
    therapistVideoText: '💡 Відеозаписи щоденника доступні лише клієнтам.\n\nЯк терапевт, використовуйте веб-панель для керування клієнтами.\nВведіть /help для перегляду команд.',
    failedInviteCode: 'Не вдалося обробити код запрошення. Спробуйте знову.',
    failedConsent: 'Не вдалося обробити згоду. Спробуйте знову.',
    // T-18 Extended consent disclaimer (multi-checkbox flow)
    // T-399: bumped to 6 points, added sessionReminders
    consentDisclaimerHeader: (name, version) => `🔐 *Інформована згода (v${version}) — ${name}*\n\nПеред підключенням, будь ласка, ознайомтеся та погодьтеся з *усіма шістьма* пунктами нижче. Цей крок неможливо пропустити — ваш терапевт працює з вами між сесіями лише за вашою інформованою згодою.`,
    consentDisclaimerStorage: '1. 📦 *Зберігання даних*\nЗаписи щоденника (текст, голос, відео), відповіді на вправи та SOS-події зберігаються на наших серверах, поки ви залишаєтеся підключеними до терапевта. Після відключення дані зберігаються згідно з вимогами законодавства, але недоступні через застосунок.',
    consentDisclaimerAi: '2. 🤖 *AI-обробка*\nГолосові та відеоповідомлення надсилаються до AI-сервісів транскрипції. Транскрипти та текст можуть бути проаналізовані та проіндексовані AI, щоб терапевт міг швидше орієнтуватися у вашій історії. Результати AI бачить лише ваш терапевт.',
    consentDisclaimerSupervision: '3. 👥 *Анонімізована супервізія*\nВаш терапевт може поділитися знеособленим знімком вашої історії зі своїм клінічним супервізором (без імені, без контактних даних, з фіксованим терміном дії). У супервізії вас неможливо ідентифікувати особисто.',
    consentDisclaimerRevoke: '4. ↩️ *Право відкликати згоду*\nВи можете в будь-який момент використати /disconnect. Це негайно відкликає доступ терапевта до ваших даних. Збережені дані зберігаються відповідно до законодавства, але більше недоступні через застосунок.',
    consentDisclaimerEncryption: '5. 🔒 *Шифрування*\nУвесь чутливий контент (щоденник, транскрипти, конспекти, нотатки) зберігається у зашифрованому вигляді (AES). Лише автентифікована сесія вашого терапевта, за наявності вашої чинної згоди, може розшифрувати дані.',
    consentDisclaimerSessionReminders: '6. 📅 *Нагадування про сесії*\nНагадування про майбутні сесії можуть надсилатися вам через Telegram та електронну пошту. Ви можете відмовитися від них у будь-який час.',
    consentDisclaimerFooter: 'Позначте *кожен* із шести пунктів нижче та натисніть *Згоден і підключитися*.',
    consentCheckboxStorage: 'Згоден на зберігання даних',
    consentCheckboxAi: 'Згоден на AI-обробку',
    consentCheckboxSupervision: 'Згоден на анонімну супервізію',
    consentCheckboxRevoke: 'Розумію право на відкликання',
    consentCheckboxEncryption: 'Приймаю умови шифрування',
    consentCheckboxSessionReminders: 'Розумію, що можуть надсилатися нагадування про сесії',
    consentBtnContinue: '✅ Згоден і підключитися',
    consentBtnCancel: '❌ Скасувати',
    consentNotAllChecked: '⚠️ Будь ласка, позначте всі 6 пунктів перед продовженням.',
    consentReprompt: '🔄 *Згоду оновлено*\n\nНаш текст згоди було оновлено. Щоб продовжити користуватися ботом, будь ласка, ознайомтеся та погодьтеся з новою версією нижче.',
    consentReconfirmed: '✅ Дякуємо за підтвердження згоди. Ви можете продовжувати користуватися ботом.',
    consentBlockedText: '⚠️ Будь ласка, завершіть підтвердження згоди вище, перш ніж надсилати інші повідомлення.',
    consentReconsentFailed: '❌ Не вдалося зафіксувати повторну згоду. Спробуйте знову.',
    // /help
    helpUnregistered: '👋 Ласкаво просимо до *PR-TOP*!\n\nВикористовуйте /start для реєстрації.',
    helpClient: '📋 *Доступні команди:*\n\n/start - Реєстрація або перевірка статусу\n/help - Показати цю довідку\n/profile - Переглянути та редагувати профіль\n/connect `КОД` - Під\'єднатися до терапевта\n/exercises - Переглянути призначені вправи\n/sos - Екстрений сигнал терапевту\n/history - Переглянути останні записи щоденника\n/timezone - Переглянути або змінити часовий пояс\n/disconnect - Від\'єднатися від терапевта\n\n💡 *Щоденник:* Просто надішліть текстове, голосове або відеоповідомлення для запису в щоденник.',
    helpTherapist: '📋 *Доступні команди:*\n\n/start - Перевірка статусу реєстрації\n/help - Показати цю довідку\n/timezone - Переглянути або змінити часовий пояс\n/profile - Переглянути профіль\n\n💡 *Порада:* Використовуйте веб-панель на pr-top.com для керування клієнтами, перегляду щоденників та іншого.',
    // /sos
    sosConfirmed: '🆘 *SOS-сигнал надіслано!*\n\nВашого терапевта сповіщено. Якщо ви в безпосередній небезпеці, зверніться до служби екстреної допомоги.\n\n🇺🇦 Україна: 7333 (гаряча лінія з питань психічного здоров\'я)\n🌍 Міжнародний: https://findahelpline.com',
    sosFailed: 'Не вдалося надіслати SOS-сигнал. Спробуйте знову або зверніться до екстрених служб.',
    // /history
    historyHeader: '📖 *Ваші останні записи щоденника:*',
    historyEmpty: '📖 У вас поки немає записів у щоденнику.\n\nНадішліть текстове або голосове повідомлення, щоб почати вести щоденник!',
    historyFailed: 'Не вдалося завантажити історію щоденника. Спробуйте знову.',
    // /sessions (T-02)
    sessionsHeader: '🎧 *Ваші останні сесії:*',
    sessionsEmpty: '🎧 У вас поки немає записаних сесій.\n\nТерапевт завантажить записи після зустрічей.',
    sessionsFailed: 'Не вдалося завантажити історію сесій. Спробуйте знову.',
    // /disconnect
    disconnectConfirm: '⚠️ *Ви впевнені, що хочете від\'єднатися?*\n\nЦе:\n• Відкличе доступ терапевта до ваших даних\n• Видалить зв\'язок з терапевтом\n\nВи зможете під\'єднатися знову з новим кодом запрошення.',
    disconnectYes: '✅ Так, від\'єднатися',
    disconnectNo: '❌ Ні, залишити під\'єднання',
    disconnected: '✅ Ви від\'єднані від терапевта.\n\nВаш терапевт більше не має доступу до вашого щоденника. Використовуйте /connect `КОД` для нового під\'єднання.',
    disconnectCancelled: '👍 Під\'єднання збережено. Зв\'язок з терапевтом не змінено.',
    disconnectFailed: 'Не вдалося від\'єднатися. Спробуйте знову.',
    // /timezone
    timezoneCurrentAndChoose: (tz, time) => `🕐 *Ваш часовий пояс:* ${tz}\n⏰ *Поточний час:* ${time}\n\nОберіть регіон для зміни часового поясу:`,
    timezoneUpdated: (tz, time) => `✅ *Часовий пояс оновлено!*\n\n🕐 *Новий часовий пояс:* ${tz}\n⏰ *Поточний час:* ${time}`,
    timezoneFailed: 'Не вдалося оновити часовий пояс. Спробуйте знову.',
    tzRegionEurope: 'Європа',
    tzRegionAsia: 'Азія',
    tzRegionAmerica: 'Америка',
    tzRegionAfrica: 'Африка',
    tzRegionPacific: 'Тихоокеанський регіон',
    tzBack: 'Назад до регіонів',
    timezoneDetectedAfterReg: (tz) => `🕐 *Ваш часовий пояс встановлено:* ${tz}\n\nЯкщо це невірно (наприклад, ви використовуєте VPN), натисніть кнопку нижче, щоб змінити.`,
    tzChangeButton: '🔄 Змінити часовий пояс',
    // /settings
    settingsTherapistOnly: '⚙️ Налаштування доступні лише для терапевтів.',
    settingsTitle: 'Налаштування бота',
    settingsForwardVoice: 'Пересилання голосових повідомлень клієнтів',
    settingsForwardVoiceDesc: "Коли увімкнено, голосові та відео щоденникові записи клієнтів будуть пересилатися у ваш Telegram з ім'ям клієнта та часом.",
    settingsEnableForward: 'Увімкнути пересилання',
    settingsDisableForward: 'Вимкнути пересилання',
    settingsForwardEnabled: '✅ Пересилання голосових увімкнено',
    settingsForwardDisabled: '❌ Пересилання голосових вимкнено',
    // /exercises
    exercisesHeader: '📋 *Ваші вправи:*\n',
    exercisesEmpty: '📋 У вас поки немає призначених вправ.\n\nВаш терапевт може надіслати вам вправи з панелі керування.',
    exercisesFailed: 'Не вдалося завантажити вправи. Спробуйте знову.',
    exerciseStatusSent: '🆕 Нова',
    exerciseStatusAcknowledged: '▶️ В процесі',
    exerciseStatusCompleted: '✅ Виконано',
    exerciseDetail: (title, category, instructions) => `📋 *${title}*\n${category ? `Категорія: ${category}\n` : ''}\n${instructions || 'Інструкції не надано.'}\n\nНатисніть *Почати* для виконання вправи.`,
    exerciseStarted: '▶️ Вправу розпочато! Тепер надішліть вашу відповідь текстовим повідомленням.\n\nКоли будете готові, просто напишіть відповідь.',
    exerciseStartFailed: 'Не вдалося розпочати вправу. Спробуйте знову.',
    exerciseCompleted: '✅ Чудова робота! Вашу відповідь записано.\n\nВаш терапевт її перегляне.',
    exerciseCompleteFailed: 'Не вдалося надіслати відповідь. Спробуйте знову.',
    exerciseStartBtn: '▶️ Почати вправу',
    exerciseNotFound: 'Вправу не знайдено або вже виконано.',
    exerciseAwaitingResponse: '✍️ Напишіть вашу відповідь на вправу.',
    exerciseNoActiveExercise: 'У вас немає активної вправи. Використовуйте /exercises для перегляду вправ.',
    // T-03: /assignments — завдання від терапевта
    assignmentsHeader: '📝 *Ваші завдання:*',
    assignmentsEmpty: '📝 У вас немає активних завдань.\n\nТерапевт призначить завдання наприкінці сесій.',
    assignmentsFailed: 'Не вдалося завантажити завдання. Спробуйте знову.',
    assignmentNotFound: 'Завдання не знайдено.',
    assignmentDetail: (title, description, frequency, deadline) =>
      `📝 *${title}*\n\n` +
      (description ? `${description}\n\n` : '') +
      `⏱ *Частота звітів:* ${frequency}\n` +
      (deadline ? `📅 *Термін:* ${deadline}\n` : '') +
      `\nНатисніть *Написати звіт*, щоб надіслати оновлення, або *Позначити виконаним*, коли завершите.`,
    assignmentReportBtn: '✍️ Написати звіт',
    assignmentCompleteBtn: '✅ Позначити виконаним',
    assignmentReportPrompt: (id) => `✍️ Надішліть звіт про прогрес із завдання #${id} — текст або голосове повідомлення. Терапевт побачить його у стрічці завдання. Можна надсилати скільки завгодно звітів.`,
    assignmentCompletedToast: '✅ Позначено виконаним',
    assignmentCompletedMsg: '✅ Завдання позначено виконаним. Терапевт отримає сповіщення.',
    assignmentCompleteFailed: 'Не вдалося позначити завдання виконаним. Спробуйте знову.',
    assignmentFrequency_daily: 'Щодня',
    assignmentFrequency_every_n_days: 'Раз на кілька днів',
    assignmentFrequency_weekly: 'Щотижня',
    assignmentFrequency_on_demand: 'За запитом',
    // T-04: вільні звіти прогресу
    reportPickHeader: '📝 Виберіть завдання для звіту:',
    reportNoAssignments: 'У вас немає активних завдань для звіту. Використовуйте /assignments щоб побачити всі завдання.',
    reportAssignmentNotActive: 'Цього завдання немає у вашому активному списку. Використовуйте /assignments щоб побачити поточні завдання.',
    reportSaved: '✅ Звіт надіслано. Терапевт скоро його побачить.',
    reportVoiceSaved: '🎤 Голосовий звіт надіслано! Транскрибування виконується — терапевт побачить текст після завершення.',
    reportFailed: 'Не вдалося надіслати звіт. Спробуйте ще раз.',
    // T-21: Фото-вкладення до звітів
    reportPhotoSaved: '📸 Фото додано до звіту. Терапевт побачить його у стрічці звітів.',
    reportPhotoFailed: 'Не вдалося додати фото. Спробуйте ще раз.',
    reportPhotoMissing: '📸 Не вдалося прочитати фото. Спробуйте надіслати його знову.',
    reportPhotoIdleHint: '📸 Щоб додати фото до звіту, спочатку використайте /report, виберіть завдання, потім надішліть фото.',
    reportPhotoTherapist: '📸 Завантаження фото доступне лише клієнтам у режимі звіту.',
    reportPhotoStubContent: '[Фото-звіт]',
    // Deep link connect
    deepLinkInvalidCode: 'Код запрошення не знайдено або недійсний.',
    deepLinkFallbackHint: 'Ви також можете спробувати вручну: /connect ВАШ_КОД',
    // Transcription status
    transcribing: '⏳ [Транскрибування...]',
    voiceSavedTranscribing: '🎤 Голосовий запис щоденника збережено! Транскрибування в процесі...',
    videoSavedTranscribing: '🎥 Відеозапис щоденника збережено! Транскрибування в процесі...',
    // /profile command
    profileView: (firstName, lastName, phone, username) => `👤 *Ваш профіль:*\n\n*Ім'я:* ${firstName || '-'} ${lastName || ''}\n*Телефон:* ${phone || '-'}\n*Telegram:* ${username ? '@' + username : '-'}\n\nНатисніть кнопку для редагування:`,
    profileEditName: '✏️ Змінити ім\'я',
    profileEditPhone: '📱 Змінити телефон',
    profileEnterName: '✏️ Введіть ваше ім\'я (Ім\'я Прізвище):',
    profileEnterPhone: '📱 Введіть номер телефону:',
    profileNameSaved: '✅ Ім\'я оновлено!',
    profilePhoneSaved: '✅ Телефон оновлено!',
    profileSaveFailed: 'Не вдалося зберегти профіль. Спробуйте ще раз.',
    profileFailed: 'Не вдалося завантажити профіль. Спробуйте ще раз.',
    // Phone sharing during registration
    sharePhonePrompt: '📱 Бажаєте поділитися номером телефону?\n\nЦе допоможе клієнтам підтвердити вашу особу.',
    sharePhoneButton: '📱 Поділитися номером',
    sharePhoneSkip: '⏭ Пропустити',
    sharePhoneSaved: '✅ Номер телефону збережено! Дякуємо.',
    sharePhoneSkipped: '⏭ Відправку номера пропущено. Ви можете додати його пізніше в /profile.',
    // Email during registration
    shareEmailPrompt: '📧 Введіть вашу електронну пошту.\n\nВона буде використовуватися для входу у веб-панель та сповіщень.',
    shareEmailSkip: '⏭ Пропустити',
    shareEmailSaved: '✅ Email збережено! Ви можете використовувати його для входу на pr-top.com.',
    shareEmailSkipped: '⏭ Email пропущено. Ви можете додати його пізніше в /profile.',
    shareEmailInvalid: '❌ Невірний формат email. Введіть коректний email (наприклад, name@example.com):',
    shareEmailTaken: '❌ Цей email вже зареєстрований. Введіть інший email:',
    // Other info during registration
    shareOtherInfoPrompt: '📝 Введіть додаткову інформацію про себе (спеціалізація, досвід, номер ліцензії тощо).\n\nЦе допоможе клієнтам дізнатися про вас більше.',
    shareOtherInfoSkip: '⏭ Пропустити',
    shareOtherInfoSaved: '✅ Інформацію збережено! Ви можете оновити її пізніше в /profile.',
    shareOtherInfoSkipped: '⏭ Пропущено. Ви можете додати цю інформацію пізніше в /profile.',
    // Persistent keyboard buttons
    btnDiary: '📝 Щоденник',
    btnExercises: '📋 Вправи',
    btnHistory: '📖 Історія',
    btnSOS: '🆘 SOS',
    btnProfile: '👤 Профіль',
    btnHelp: '❓ Допомога',
    btnOpenDashboard: '🌐 Відкрити панель',
    diaryHint: '📝 Напишіть текст, надішліть голосове або відео — це стане записом у щоденнику. Терапевт побачить його до наступної сесії.',
    dashboardLink: '🌐 Відкрийте веб-панель для керування клієнтами, перегляду щоденників та аналітики.'
  }
};

/**
 * Get a translated message for a given language
 * Falls back to English if translation not found
 */
function t(lang, key) {
  const langMessages = messages[lang] || messages['en'];
  return langMessages[key] || messages['en'][key];
}

module.exports = { messages, t };
