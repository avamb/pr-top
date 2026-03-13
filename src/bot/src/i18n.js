// Bot internationalization - message translations
// Default language is 'en', can be overridden per user

const messages = {
  en: {
    welcomeBack: (role) => `Welcome back! You are registered as a ${role}.\n\nUse /help to see available commands.`,
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
    welcomeTherapist: (code) => `✅ Welcome, Therapist! Your workspace has been set up.\n\nYour invite code: *${code}*\nShare this code with your clients so they can connect with you.\n\nUse /help to see available commands.`,
    welcomeClient: '✅ Welcome! You\'ve been registered as a client.\n\nPlease enter your therapist\'s invite code to get started:\nUse /connect <code> to link with your therapist.',
    registrationError: '❌ Sorry, there was an error during registration. Please try again with /start.',
    voiceSaved: '🎤 Voice diary entry saved! Your therapist will be able to listen to it.',
    diarySaved: '📝 Diary entry saved!',
    failedVoiceDiary: 'Failed to save voice diary entry.',
    failedDiary: 'Failed to save diary entry.',
    failedInviteCode: 'Failed to process invite code. Please try again.',
    failedConsent: 'Failed to process consent. Please try again.',
    // /help command
    helpUnregistered: '👋 Welcome to *PR-TOP*!\n\nUse /start to register and get started.',
    helpClient: '📋 *Available Commands:*\n\n/start - Register or check your status\n/help - Show this help message\n/connect `CODE` - Connect with your therapist\n/sos - Emergency alert to your therapist\n/history - View your recent diary entries\n/disconnect - Disconnect from your therapist\n\n💡 *Diary:* Simply send a text or voice message to save a diary entry.',
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
    disconnectFailed: 'Failed to disconnect. Please try again.'
  },
  ru: {
    welcomeBack: (role) => {
      const roleLabel = role === 'therapist' ? 'Терапевт' : 'Клиент';
      return `С возвращением! Вы зарегистрированы как ${roleLabel}.\n\nИспользуйте /help для просмотра доступных команд.`;
    },
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
    welcomeTherapist: (code) => `✅ Добро пожаловать, Терапевт! Ваше рабочее пространство настроено.\n\nВаш код приглашения: *${code}*\nПоделитесь этим кодом с клиентами для подключения.\n\nИспользуйте /help для просмотра команд.`,
    welcomeClient: '✅ Добро пожаловать! Вы зарегистрированы как клиент.\n\nВведите код приглашения терапевта:\nИспользуйте /connect <код> для подключения.',
    registrationError: '❌ Произошла ошибка при регистрации. Попробуйте снова с /start.',
    voiceSaved: '🎤 Голосовая запись дневника сохранена! Ваш терапевт сможет её прослушать.',
    diarySaved: '📝 Запись дневника сохранена!',
    failedVoiceDiary: 'Не удалось сохранить голосовую запись дневника.',
    failedDiary: 'Не удалось сохранить запись дневника.',
    failedInviteCode: 'Не удалось обработать код приглашения. Попробуйте снова.',
    failedConsent: 'Не удалось обработать согласие. Попробуйте снова.',
    // /help
    helpUnregistered: '👋 Добро пожаловать в *PR-TOP*!\n\nИспользуйте /start для регистрации.',
    helpClient: '📋 *Доступные команды:*\n\n/start - Регистрация или проверка статуса\n/help - Показать эту справку\n/connect `КОД` - Подключиться к терапевту\n/sos - Экстренный сигнал терапевту\n/history - Просмотр последних записей дневника\n/disconnect - Отключиться от терапевта\n\n💡 *Дневник:* Просто отправьте текстовое или голосовое сообщение для записи в дневник.',
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
    disconnectFailed: 'Не удалось отключиться. Попробуйте снова.'
  },
  es: {
    welcomeBack: (role) => {
      const roleLabel = role === 'therapist' ? 'Terapeuta' : 'Cliente';
      return `¡Bienvenido de nuevo! Estás registrado como ${roleLabel}.\n\nUsa /help para ver los comandos disponibles.`;
    },
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
    welcomeTherapist: (code) => `✅ ¡Bienvenido, Terapeuta! Tu espacio de trabajo está configurado.\n\nTu código de invitación: *${code}*\nComparte este código con tus clientes para que puedan conectarse contigo.\n\nUsa /help para ver los comandos disponibles.`,
    welcomeClient: '✅ ¡Bienvenido! Te has registrado como cliente.\n\nIngresa el código de invitación de tu terapeuta para comenzar:\nUsa /connect <código> para vincularte con tu terapeuta.',
    registrationError: '❌ Lo sentimos, hubo un error durante el registro. Intenta de nuevo con /start.',
    voiceSaved: '🎤 ¡Entrada de diario de voz guardada! Tu terapeuta podrá escucharla.',
    diarySaved: '📝 ¡Entrada de diario guardada!',
    failedVoiceDiary: 'No se pudo guardar la entrada de voz del diario.',
    failedDiary: 'No se pudo guardar la entrada del diario.',
    failedInviteCode: 'No se pudo procesar el código de invitación. Inténtalo de nuevo.',
    failedConsent: 'No se pudo procesar el consentimiento. Inténtalo de nuevo.',
    // /help
    helpUnregistered: '👋 ¡Bienvenido a *PR-TOP*!\n\nUsa /start para registrarte y comenzar.',
    helpClient: '📋 *Comandos disponibles:*\n\n/start - Registrarse o verificar tu estado\n/help - Mostrar esta ayuda\n/connect `CÓDIGO` - Conectarte con tu terapeuta\n/sos - Alerta de emergencia a tu terapeuta\n/history - Ver tus entradas recientes del diario\n/disconnect - Desconectarte de tu terapeuta\n\n💡 *Diario:* Simplemente envía un mensaje de texto o voz para guardar una entrada de diario.',
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
    disconnectFailed: 'No se pudo desconectar. Inténtalo de nuevo.'
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
