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
    therapistFreeText: '💡 As a therapist, use the web dashboard to manage clients.\n\nType /help for available commands.',
    therapistVoiceText: '💡 Voice diary entries are for clients only.\n\nAs a therapist, use the web dashboard to manage your clients.\nType /help for available commands.',
    therapistVideoText: '💡 Video diary entries are for clients only.\n\nAs a therapist, use the web dashboard to manage your clients.\nType /help for available commands.',
    failedInviteCode: 'Failed to process invite code. Please try again.',
    failedConsent: 'Failed to process consent. Please try again.',
    // /help command
    helpUnregistered: '👋 Welcome to *PR-TOP*!\n\nUse /start to register and get started.',
    helpClient: '📋 *Available Commands:*\n\n/start - Register or check your status\n/help - Show this help message\n/profile - View and edit your profile\n/connect `CODE` - Connect with your therapist\n/exercises - View your assigned exercises\n/sos - Emergency alert to your therapist\n/history - View your recent diary entries\n/disconnect - Disconnect from your therapist\n\n💡 *Diary:* Simply send a text, voice, or video message to save a diary entry.',
    helpTherapist: '📋 *Available Commands:*\n\n/start - Check your registration status\n/help - Show this help message\n\n💡 *Tip:* Use the web dashboard at pr-top.com to manage your clients, view diaries, and more.',
    // /sos command
    sosConfirmed: '🆘 *SOS alert sent!*\n\nYour therapist has been notified. If you are in immediate danger, please contact emergency services.\n\n🇺🇸 USA: 988 (Suicide & Crisis Lifeline)\n🌍 International: https://findahelpline.com',
    sosFailed: 'Failed to send SOS alert. Please try again or contact emergency services directly.',
    // /history command
    historyHeader: '📖 *Your Recent Diary Entries:*',
    historyEmpty: '📖 You have no diary entries yet.\n\nSend a text or voice message to start your diary!',
    historyFailed: 'Failed to load diary history. Please try again.',
    // /disconnect command
    disconnectConfirm: '⚠️ *Are you sure you want to disconnect?*\n\nThis will:\n• Revoke your therapist\'s access to your data\n• Remove your therapist connection\n\nYou can reconnect later with a new invite code.',
    disconnectYes: '✅ Yes, disconnect',
    disconnectNo: '❌ No, keep connection',
    disconnected: '✅ You have been disconnected from your therapist.\n\nYour therapist can no longer access your diary entries. Use /connect `CODE` to connect with a therapist again.',
    disconnectCancelled: '👍 Connection kept. Your therapist link is unchanged.',
    disconnectFailed: 'Failed to disconnect. Please try again.',
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
    profileFailed: 'Failed to load profile. Please try again.'
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
    therapistFreeText: '💡 Как терапевт, используйте веб-панель для управления клиентами.\n\nВведите /help для просмотра доступных команд.',
    therapistVoiceText: '💡 Голосовые записи дневника доступны только клиентам.\n\nКак терапевт, используйте веб-панель для управления клиентами.\nВведите /help для просмотра команд.',
    therapistVideoText: '💡 Видеозаписи дневника доступны только клиентам.\n\nКак терапевт, используйте веб-панель для управления клиентами.\nВведите /help для просмотра команд.',
    failedInviteCode: 'Не удалось обработать код приглашения. Попробуйте снова.',
    failedConsent: 'Не удалось обработать согласие. Попробуйте снова.',
    // /help
    helpUnregistered: '👋 Добро пожаловать в *PR-TOP*!\n\nИспользуйте /start для регистрации.',
    helpClient: '📋 *Доступные команды:*\n\n/start - Регистрация или проверка статуса\n/help - Показать эту справку\n/profile - Просмотр и редактирование профиля\n/connect `КОД` - Подключиться к терапевту\n/exercises - Просмотр назначенных упражнений\n/sos - Экстренный сигнал терапевту\n/history - Просмотр последних записей дневника\n/disconnect - Отключиться от терапевта\n\n💡 *Дневник:* Просто отправьте текстовое, голосовое или видеосообщение для записи в дневник.',
    helpTherapist: '📋 *Доступные команды:*\n\n/start - Проверка статуса регистрации\n/help - Показать эту справку\n\n💡 *Совет:* Используйте веб-панель на pr-top.com для управления клиентами, просмотра дневников и многого другого.',
    // /sos
    sosConfirmed: '🆘 *SOS-сигнал отправлен!*\n\nВаш терапевт уведомлён. Если вы в непосредственной опасности, обратитесь в службу экстренной помощи.\n\n🇷🇺 Россия: 8-800-2000-122 (телефон доверия)\n🌍 Международный: https://findahelpline.com',
    sosFailed: 'Не удалось отправить SOS-сигнал. Попробуйте снова или обратитесь в экстренные службы.',
    // /history
    historyHeader: '📖 *Ваши последние записи дневника:*',
    historyEmpty: '📖 У вас пока нет записей в дневнике.\n\nОтправьте текстовое или голосовое сообщение, чтобы начать вести дневник!',
    historyFailed: 'Не удалось загрузить историю дневника. Попробуйте снова.',
    // /disconnect
    disconnectConfirm: '⚠️ *Вы уверены, что хотите отключиться?*\n\nЭто:\n• Отзовёт доступ терапевта к вашим данным\n• Удалит связь с терапевтом\n\nВы сможете подключиться снова с новым кодом приглашения.',
    disconnectYes: '✅ Да, отключиться',
    disconnectNo: '❌ Нет, оставить подключение',
    disconnected: '✅ Вы отключены от терапевта.\n\nВаш терапевт больше не имеет доступа к вашему дневнику. Используйте /connect `КОД` для нового подключения.',
    disconnectCancelled: '👍 Подключение сохранено. Связь с терапевтом не изменена.',
    disconnectFailed: 'Не удалось отключиться. Попробуйте снова.',
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
    profileFailed: 'Не удалось загрузить профиль. Попробуйте ещё раз.'
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
    failedVoiceDiary: 'No se pudo guardar la entrada de voz del diario.',
    failedVideoDiary: 'No se pudo guardar la entrada de video del diario.',
    failedDiary: 'No se pudo guardar la entrada del diario.',
    therapistFreeText: '💡 Como terapeuta, usa el panel web para gestionar clientes.\n\nEscribe /help para ver los comandos disponibles.',
    therapistVoiceText: '💡 Las entradas de diario de voz son solo para clientes.\n\nComo terapeuta, usa el panel web para gestionar tus clientes.\nEscribe /help para ver los comandos.',
    therapistVideoText: '💡 Las entradas de diario de video son solo para clientes.\n\nComo terapeuta, usa el panel web para gestionar tus clientes.\nEscribe /help para ver los comandos.',
    failedInviteCode: 'No se pudo procesar el código de invitación. Inténtalo de nuevo.',
    failedConsent: 'No se pudo procesar el consentimiento. Inténtalo de nuevo.',
    // /help
    helpUnregistered: '👋 ¡Bienvenido a *PR-TOP*!\n\nUsa /start para registrarte y comenzar.',
    helpClient: '📋 *Comandos disponibles:*\n\n/start - Registrarse o verificar tu estado\n/help - Mostrar esta ayuda\n/profile - Ver y editar tu perfil\n/connect `CÓDIGO` - Conectarte con tu terapeuta\n/exercises - Ver tus ejercicios asignados\n/sos - Alerta de emergencia a tu terapeuta\n/history - Ver tus entradas recientes del diario\n/disconnect - Desconectarte de tu terapeuta\n\n💡 *Diario:* Simplemente envía un mensaje de texto, voz o video para guardar una entrada de diario.',
    helpTherapist: '📋 *Comandos disponibles:*\n\n/start - Verificar tu estado de registro\n/help - Mostrar esta ayuda\n\n💡 *Consejo:* Usa el panel web en pr-top.com para gestionar tus clientes, ver diarios y más.',
    // /sos
    sosConfirmed: '🆘 *¡Alerta SOS enviada!*\n\nTu terapeuta ha sido notificado. Si estás en peligro inmediato, contacta a los servicios de emergencia.\n\n🇪🇸 España: 024 (Línea de Atención a la Conducta Suicida)\n🌍 Internacional: https://findahelpline.com',
    sosFailed: 'No se pudo enviar la alerta SOS. Inténtalo de nuevo o contacta directamente a los servicios de emergencia.',
    // /history
    historyHeader: '📖 *Tus entradas recientes del diario:*',
    historyEmpty: '📖 Aún no tienes entradas en el diario.\n\n¡Envía un mensaje de texto o voz para comenzar tu diario!',
    historyFailed: 'No se pudo cargar el historial del diario. Inténtalo de nuevo.',
    // /disconnect
    disconnectConfirm: '⚠️ *¿Estás seguro de que quieres desconectarte?*\n\nEsto:\n• Revocará el acceso de tu terapeuta a tus datos\n• Eliminará tu conexión con el terapeuta\n\nPodrás reconectarte más tarde con un nuevo código de invitación.',
    disconnectYes: '✅ Sí, desconectar',
    disconnectNo: '❌ No, mantener conexión',
    disconnected: '✅ Te has desconectado de tu terapeuta.\n\nTu terapeuta ya no puede acceder a tus entradas de diario. Usa /connect `CÓDIGO` para conectarte con un terapeuta nuevamente.',
    disconnectCancelled: '👍 Conexión mantenida. Tu vínculo con el terapeuta no ha cambiado.',
    disconnectFailed: 'No se pudo desconectar. Inténtalo de nuevo.',
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
    profileFailed: 'No se pudo cargar el perfil. Inténtalo de nuevo.'
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
    therapistFreeText: '💡 Як терапевт, використовуйте веб-панель для керування клієнтами.\n\nВведіть /help для перегляду доступних команд.',
    therapistVoiceText: '💡 Голосові записи щоденника доступні лише клієнтам.\n\nЯк терапевт, використовуйте веб-панель для керування клієнтами.\nВведіть /help для перегляду команд.',
    therapistVideoText: '💡 Відеозаписи щоденника доступні лише клієнтам.\n\nЯк терапевт, використовуйте веб-панель для керування клієнтами.\nВведіть /help для перегляду команд.',
    failedInviteCode: 'Не вдалося обробити код запрошення. Спробуйте знову.',
    failedConsent: 'Не вдалося обробити згоду. Спробуйте знову.',
    // /help
    helpUnregistered: '👋 Ласкаво просимо до *PR-TOP*!\n\nВикористовуйте /start для реєстрації.',
    helpClient: '📋 *Доступні команди:*\n\n/start - Реєстрація або перевірка статусу\n/help - Показати цю довідку\n/profile - Переглянути та редагувати профіль\n/connect `КОД` - Під\'єднатися до терапевта\n/exercises - Переглянути призначені вправи\n/sos - Екстрений сигнал терапевту\n/history - Переглянути останні записи щоденника\n/disconnect - Від\'єднатися від терапевта\n\n💡 *Щоденник:* Просто надішліть текстове, голосове або відеоповідомлення для запису в щоденник.',
    helpTherapist: '📋 *Доступні команди:*\n\n/start - Перевірка статусу реєстрації\n/help - Показати цю довідку\n\n💡 *Порада:* Використовуйте веб-панель на pr-top.com для керування клієнтами, перегляду щоденників та іншого.',
    // /sos
    sosConfirmed: '🆘 *SOS-сигнал надіслано!*\n\nВашого терапевта сповіщено. Якщо ви в безпосередній небезпеці, зверніться до служби екстреної допомоги.\n\n🇺🇦 Україна: 7333 (гаряча лінія з питань психічного здоров\'я)\n🌍 Міжнародний: https://findahelpline.com',
    sosFailed: 'Не вдалося надіслати SOS-сигнал. Спробуйте знову або зверніться до екстрених служб.',
    // /history
    historyHeader: '📖 *Ваші останні записи щоденника:*',
    historyEmpty: '📖 У вас поки немає записів у щоденнику.\n\nНадішліть текстове або голосове повідомлення, щоб почати вести щоденник!',
    historyFailed: 'Не вдалося завантажити історію щоденника. Спробуйте знову.',
    // /disconnect
    disconnectConfirm: '⚠️ *Ви впевнені, що хочете від\'єднатися?*\n\nЦе:\n• Відкличе доступ терапевта до ваших даних\n• Видалить зв\'язок з терапевтом\n\nВи зможете під\'єднатися знову з новим кодом запрошення.',
    disconnectYes: '✅ Так, від\'єднатися',
    disconnectNo: '❌ Ні, залишити під\'єднання',
    disconnected: '✅ Ви від\'єднані від терапевта.\n\nВаш терапевт більше не має доступу до вашого щоденника. Використовуйте /connect `КОД` для нового під\'єднання.',
    disconnectCancelled: '👍 Під\'єднання збережено. Зв\'язок з терапевтом не змінено.',
    disconnectFailed: 'Не вдалося від\'єднатися. Спробуйте знову.',
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
    profileFailed: 'Не вдалося завантажити профіль. Спробуйте ще раз.'
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
