// Exercise Library Routes
const express = require('express');
const jwt = require('jsonwebtoken');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// Auth middleware
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Seed default exercises if table is empty
function seedDefaultExercises(db) {
  const count = db.exec("SELECT COUNT(*) FROM exercises");
  if (count[0].values[0][0] > 0) return; // already seeded

  const exercises = [
    // Breathing & Relaxation
    { category: 'breathing', title_ru: 'Диафрагмальное дыхание', title_en: 'Diaphragmatic Breathing', title_es: 'Respiracion diafragmatica',
      description_ru: 'Техника глубокого дыхания для снижения тревожности', description_en: 'Deep breathing technique to reduce anxiety and promote calm', description_es: 'Tecnica de respiracion profunda para reducir la ansiedad',
      instructions_ru: '1. Сядьте удобно\n2. Положите руку на живот\n3. Вдохните через нос на 4 счёта\n4. Задержите дыхание на 4 счёта\n5. Выдохните через рот на 6 счётов\n6. Повторите 5-10 раз',
      instructions_en: '1. Sit comfortably\n2. Place hand on abdomen\n3. Inhale through nose for 4 counts\n4. Hold for 4 counts\n5. Exhale through mouth for 6 counts\n6. Repeat 5-10 times',
      instructions_es: '1. Sientese comodamente\n2. Coloque la mano en el abdomen\n3. Inhale por la nariz durante 4 tiempos\n4. Mantenga durante 4 tiempos\n5. Exhale por la boca durante 6 tiempos\n6. Repita 5-10 veces' },
    { category: 'breathing', title_ru: 'Прогрессивная мышечная релаксация', title_en: 'Progressive Muscle Relaxation', title_es: 'Relajacion muscular progresiva',
      description_ru: 'Последовательное напряжение и расслабление групп мышц', description_en: 'Systematically tense and release muscle groups to reduce physical tension', description_es: 'Tensar y relajar sistematicamente los grupos musculares',
      instructions_ru: '1. Начните с мышц стоп\n2. Напрягите на 5 секунд\n3. Расслабьте на 10 секунд\n4. Продвигайтесь вверх по телу\n5. Завершите мышцами лица',
      instructions_en: '1. Start with feet muscles\n2. Tense for 5 seconds\n3. Release for 10 seconds\n4. Move upward through body\n5. End with facial muscles',
      instructions_es: '1. Comience con los musculos de los pies\n2. Tense durante 5 segundos\n3. Relaje durante 10 segundos\n4. Avance hacia arriba por el cuerpo\n5. Termine con los musculos faciales' },
    { category: 'breathing', title_ru: 'Дыхание 4-7-8', title_en: '4-7-8 Breathing', title_es: 'Respiracion 4-7-8',
      description_ru: 'Техника дыхания для быстрого засыпания и успокоения', description_en: 'Breathing pattern for quick relaxation and sleep aid', description_es: 'Patron de respiracion para relajacion rapida',
      instructions_ru: '1. Вдохните через нос на 4 счёта\n2. Задержите дыхание на 7 счётов\n3. Выдохните через рот на 8 счётов\n4. Повторите 3-4 цикла',
      instructions_en: '1. Inhale through nose for 4 counts\n2. Hold breath for 7 counts\n3. Exhale through mouth for 8 counts\n4. Repeat 3-4 cycles',
      instructions_es: '1. Inhale por la nariz durante 4 tiempos\n2. Mantenga la respiracion durante 7 tiempos\n3. Exhale por la boca durante 8 tiempos\n4. Repita 3-4 ciclos' },

    // Mindfulness
    { category: 'mindfulness', title_ru: 'Сканирование тела', title_en: 'Body Scan Meditation', title_es: 'Escaneo corporal',
      description_ru: 'Медитация осознанности для развития связи с телом', description_en: 'Mindfulness meditation to develop body awareness and release tension', description_es: 'Meditacion de atencion plena para desarrollar la conciencia corporal',
      instructions_ru: '1. Лягте удобно\n2. Закройте глаза\n3. Направьте внимание на макушку\n4. Медленно перемещайте внимание вниз по телу\n5. Отмечайте ощущения без оценки\n6. Уделите 15-20 минут',
      instructions_en: '1. Lie down comfortably\n2. Close your eyes\n3. Focus attention on top of head\n4. Slowly move attention down through body\n5. Notice sensations without judgment\n6. Allow 15-20 minutes',
      instructions_es: '1. Acuestese comodamente\n2. Cierre los ojos\n3. Enfoque la atencion en la parte superior de la cabeza\n4. Mueva lentamente la atencion hacia abajo\n5. Note las sensaciones sin juzgar\n6. Dedique 15-20 minutos' },
    { category: 'mindfulness', title_ru: 'Техника 5-4-3-2-1', title_en: '5-4-3-2-1 Grounding', title_es: 'Tecnica de anclaje 5-4-3-2-1',
      description_ru: 'Техника заземления через пять чувств', description_en: 'Grounding technique using five senses to anchor to the present moment', description_es: 'Tecnica de anclaje usando los cinco sentidos',
      instructions_ru: '1. Назовите 5 вещей, которые видите\n2. Назовите 4 вещи, которые можете потрогать\n3. Назовите 3 звука, которые слышите\n4. Назовите 2 запаха\n5. Назовите 1 вкус',
      instructions_en: '1. Name 5 things you can see\n2. Name 4 things you can touch\n3. Name 3 things you can hear\n4. Name 2 things you can smell\n5. Name 1 thing you can taste',
      instructions_es: '1. Nombre 5 cosas que puede ver\n2. Nombre 4 cosas que puede tocar\n3. Nombre 3 cosas que puede escuchar\n4. Nombre 2 cosas que puede oler\n5. Nombre 1 cosa que puede saborear' },
    { category: 'mindfulness', title_ru: 'Осознанное наблюдение', title_en: 'Mindful Observation', title_es: 'Observacion consciente',
      description_ru: 'Практика осознанного внимания к окружающему миру', description_en: 'Practice of mindful attention to surroundings and present experience', description_es: 'Practica de atencion plena al entorno',
      instructions_ru: '1. Выберите объект в окружении\n2. Наблюдайте его 2 минуты\n3. Отметьте цвет, текстуру, форму\n4. Отметьте свои мысли и чувства\n5. Вернитесь к наблюдению',
      instructions_en: '1. Choose an object in your environment\n2. Observe it for 2 minutes\n3. Note its color, texture, shape\n4. Notice your thoughts and feelings\n5. Return to observation',
      instructions_es: '1. Elija un objeto en su entorno\n2. Observelo durante 2 minutos\n3. Note su color, textura, forma\n4. Note sus pensamientos y sentimientos\n5. Vuelva a la observacion' },

    // Cognitive (CBT)
    { category: 'cognitive', title_ru: 'Дневник мыслей', title_en: 'Thought Record', title_es: 'Registro de pensamientos',
      description_ru: 'Запись и анализ автоматических мыслей по методу КПТ', description_en: 'CBT technique to identify and challenge automatic negative thoughts', description_es: 'Tecnica de TCC para identificar y desafiar pensamientos negativos',
      instructions_ru: '1. Опишите ситуацию\n2. Запишите автоматическую мысль\n3. Определите эмоцию (0-100%)\n4. Найдите когнитивное искажение\n5. Сформулируйте альтернативную мысль\n6. Переоцените эмоцию',
      instructions_en: '1. Describe the situation\n2. Write the automatic thought\n3. Rate the emotion (0-100%)\n4. Identify the cognitive distortion\n5. Formulate an alternative thought\n6. Re-rate the emotion',
      instructions_es: '1. Describa la situacion\n2. Escriba el pensamiento automatico\n3. Califique la emocion (0-100%)\n4. Identifique la distorsion cognitiva\n5. Formule un pensamiento alternativo\n6. Recalifique la emocion' },
    { category: 'cognitive', title_ru: 'Рефрейминг', title_en: 'Cognitive Reframing', title_es: 'Reestructuracion cognitiva',
      description_ru: 'Техника изменения перспективы на негативные события', description_en: 'Technique to change perspective on negative events and find alternative viewpoints', description_es: 'Tecnica para cambiar la perspectiva sobre eventos negativos',
      instructions_ru: '1. Запишите негативную ситуацию\n2. Определите свою интерпретацию\n3. Задайте вопрос: "Какие ещё объяснения возможны?"\n4. Запишите 3 альтернативных интерпретации\n5. Выберите наиболее реалистичную',
      instructions_en: '1. Write down the negative situation\n2. Identify your interpretation\n3. Ask: "What other explanations are possible?"\n4. Write 3 alternative interpretations\n5. Choose the most realistic one',
      instructions_es: '1. Escriba la situacion negativa\n2. Identifique su interpretacion\n3. Pregunte: "Que otras explicaciones son posibles?"\n4. Escriba 3 interpretaciones alternativas\n5. Elija la mas realista' },
    { category: 'cognitive', title_ru: 'Анализ доказательств', title_en: 'Evidence Examination', title_es: 'Examen de evidencia',
      description_ru: 'Проверка негативных убеждений через сбор доказательств', description_en: 'Examine evidence for and against negative beliefs to develop balanced thinking', description_es: 'Examinar evidencia a favor y en contra de creencias negativas',
      instructions_ru: '1. Запишите убеждение\n2. Соберите доказательства ЗА\n3. Соберите доказательства ПРОТИВ\n4. Оцените объективно\n5. Сформулируйте сбалансированное убеждение',
      instructions_en: '1. Write the belief\n2. Gather evidence FOR\n3. Gather evidence AGAINST\n4. Evaluate objectively\n5. Formulate a balanced belief',
      instructions_es: '1. Escriba la creencia\n2. Reuna evidencia A FAVOR\n3. Reuna evidencia EN CONTRA\n4. Evalue objetivamente\n5. Formule una creencia equilibrada' },

    // Journaling
    { category: 'journaling', title_ru: 'Дневник благодарности', title_en: 'Gratitude Journal', title_es: 'Diario de gratitud',
      description_ru: 'Ежедневная запись того, за что вы благодарны', description_en: 'Daily practice of recording things you are grateful for', description_es: 'Practica diaria de registrar cosas por las que esta agradecido',
      instructions_ru: '1. Каждый вечер запишите 3 вещи\n2. За что вы благодарны сегодня\n3. Будьте конкретны\n4. Объясните почему это важно\n5. Перечитайте за неделю',
      instructions_en: '1. Each evening write 3 things\n2. What are you grateful for today\n3. Be specific\n4. Explain why it matters\n5. Review weekly',
      instructions_es: '1. Cada noche escriba 3 cosas\n2. Por que esta agradecido hoy\n3. Sea especifico\n4. Explique por que es importante\n5. Revise semanalmente' },
    { category: 'journaling', title_ru: 'Свободное письмо', title_en: 'Free Writing', title_es: 'Escritura libre',
      description_ru: 'Непрерывное письмо без цензуры для самовыражения', description_en: 'Continuous uncensored writing for self-expression and emotional processing', description_es: 'Escritura continua sin censura para la autoexpresion',
      instructions_ru: '1. Установите таймер на 10 минут\n2. Пишите без остановки\n3. Не редактируйте и не перечитывайте\n4. Пишите всё, что приходит в голову\n5. По окончании отметьте ключевые темы',
      instructions_en: '1. Set timer for 10 minutes\n2. Write without stopping\n3. Do not edit or re-read\n4. Write whatever comes to mind\n5. After finishing, note key themes',
      instructions_es: '1. Configure el temporizador en 10 minutos\n2. Escriba sin detenerse\n3. No edite ni relea\n4. Escriba lo que venga a la mente\n5. Al terminar, note los temas clave' },
    { category: 'journaling', title_ru: 'Письмо к себе', title_en: 'Letter to Self', title_es: 'Carta a uno mismo',
      description_ru: 'Написание сострадательного письма самому себе', description_en: 'Writing a compassionate letter to yourself for self-kindness practice', description_es: 'Escribir una carta compasiva a uno mismo',
      instructions_ru: '1. Представьте, что пишете другу\n2. Обратитесь к себе с теплотой\n3. Признайте свои трудности\n4. Напишите слова поддержки\n5. Завершите добрым пожеланием',
      instructions_en: '1. Imagine writing to a friend\n2. Address yourself warmly\n3. Acknowledge your struggles\n4. Write words of support\n5. End with a kind wish',
      instructions_es: '1. Imagine que escribe a un amigo\n2. Dirijase a si mismo con calidez\n3. Reconozca sus dificultades\n4. Escriba palabras de apoyo\n5. Termine con un deseo amable' },

    // Behavioral
    { category: 'behavioral', title_ru: 'Поведенческая активация', title_en: 'Behavioral Activation', title_es: 'Activacion conductual',
      description_ru: 'Планирование приятных и значимых активностей', description_en: 'Planning pleasant and meaningful activities to counter depression', description_es: 'Planificacion de actividades agradables y significativas',
      instructions_ru: '1. Составьте список приятных активностей\n2. Оцените каждую по удовольствию (1-10)\n3. Оцените по значимости (1-10)\n4. Запланируйте 1-2 активности в день\n5. После выполнения оцените настроение',
      instructions_en: '1. List pleasant activities\n2. Rate each for pleasure (1-10)\n3. Rate for meaning (1-10)\n4. Schedule 1-2 activities daily\n5. After completion, rate mood',
      instructions_es: '1. Liste actividades agradables\n2. Califique cada una por placer (1-10)\n3. Califique por significado (1-10)\n4. Programe 1-2 actividades diarias\n5. Despues de completar, califique el estado de animo' },
    { category: 'behavioral', title_ru: 'Экспозиционная лестница', title_en: 'Exposure Hierarchy', title_es: 'Jerarquia de exposicion',
      description_ru: 'Постепенное приближение к пугающим ситуациям', description_en: 'Gradual approach to feared situations through systematic desensitization', description_es: 'Aproximacion gradual a situaciones temidas',
      instructions_ru: '1. Определите страх\n2. Создайте список ситуаций (от лёгкой до сложной)\n3. Оцените каждую по тревоге (0-100)\n4. Начните с самой лёгкой\n5. Практикуйте до снижения тревоги на 50%',
      instructions_en: '1. Identify the fear\n2. Create list of situations (easy to hard)\n3. Rate each for anxiety (0-100)\n4. Start with the easiest\n5. Practice until anxiety drops by 50%',
      instructions_es: '1. Identifique el miedo\n2. Cree una lista de situaciones (facil a dificil)\n3. Califique cada una por ansiedad (0-100)\n4. Comience con la mas facil\n5. Practique hasta que la ansiedad baje un 50%' },
    { category: 'behavioral', title_ru: 'Отслеживание привычек', title_en: 'Habit Tracking', title_es: 'Seguimiento de habitos',
      description_ru: 'Систематическое отслеживание формирования новых привычек', description_en: 'Systematic tracking of new habit formation for behavior change', description_es: 'Seguimiento sistematico de la formacion de nuevos habitos',
      instructions_ru: '1. Выберите одну привычку для формирования\n2. Определите триггер (после чего вы это делаете)\n3. Определите награду\n4. Отмечайте каждый день выполнения\n5. Стремитесь к 21-дневной серии',
      instructions_en: '1. Choose one habit to build\n2. Identify the trigger (what comes before)\n3. Define the reward\n4. Mark each day of completion\n5. Aim for a 21-day streak',
      instructions_es: '1. Elija un habito para formar\n2. Identifique el disparador\n3. Defina la recompensa\n4. Marque cada dia de cumplimiento\n5. Apunte a una racha de 21 dias' },

    // Self-compassion
    { category: 'self-compassion', title_ru: 'Самосострадание', title_en: 'Self-Compassion Break', title_es: 'Pausa de autocompasion',
      description_ru: 'Краткая практика самосострадания в трудные моменты', description_en: 'Brief self-compassion practice during difficult moments', description_es: 'Practica breve de autocompasion en momentos dificiles',
      instructions_ru: '1. Признайте: "Сейчас мне трудно"\n2. Напомните: "Все люди переживают трудности"\n3. Положите руку на сердце\n4. Скажите: "Пусть я буду добр к себе"\n5. Дышите спокойно 1 минуту',
      instructions_en: '1. Acknowledge: "This is a moment of difficulty"\n2. Remind: "Everyone experiences difficulty"\n3. Place hand on heart\n4. Say: "May I be kind to myself"\n5. Breathe calmly for 1 minute',
      instructions_es: '1. Reconozca: "Este es un momento dificil"\n2. Recuerde: "Todos experimentan dificultades"\n3. Coloque la mano en el corazon\n4. Diga: "Que pueda ser amable conmigo mismo"\n5. Respire con calma durante 1 minuto' },
  ];

  const stmt = "INSERT INTO exercises (category, title_ru, title_en, title_es, description_ru, description_en, description_es, instructions_ru, instructions_en, instructions_es, is_custom, therapist_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)";

  for (const ex of exercises) {
    db.run(stmt, [
      ex.category, ex.title_ru, ex.title_en, ex.title_es,
      ex.description_ru, ex.description_en, ex.description_es,
      ex.instructions_ru, ex.instructions_en, ex.instructions_es
    ]);
  }
  saveDatabase();
  logger.info(`Seeded ${exercises.length} default exercises`);
}

// Allowed exercise categories
const ALLOWED_CATEGORIES = ['breathing', 'mindfulness', 'cognitive', 'journaling', 'behavioral', 'self-compassion'];

// GET /api/exercises - List all exercises, optionally filtered by category or filter=my
router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const { category, filter } = req.query;

    // Seed defaults on first access
    seedDefaultExercises(db);

    let query, params;
    if (filter === 'my') {
      // Return only therapist's own custom exercises
      if (category) {
        query = "SELECT id, category, title_ru, title_en, title_es, description_ru, description_en, description_es, instructions_ru, instructions_en, instructions_es, is_custom, therapist_id, created_at, updated_at FROM exercises WHERE therapist_id = ? AND is_custom = 1 AND category = ? ORDER BY category, id";
        params = [req.user.id, category];
      } else {
        query = "SELECT id, category, title_ru, title_en, title_es, description_ru, description_en, description_es, instructions_ru, instructions_en, instructions_es, is_custom, therapist_id, created_at, updated_at FROM exercises WHERE therapist_id = ? AND is_custom = 1 ORDER BY category, id";
        params = [req.user.id];
      }
    } else if (category) {
      // Filter by category: system exercises + own custom exercises
      query = "SELECT id, category, title_ru, title_en, title_es, description_ru, description_en, description_es, instructions_ru, instructions_en, instructions_es, is_custom, therapist_id, created_at, updated_at FROM exercises WHERE category = ? AND (is_custom = 0 OR therapist_id = ?) ORDER BY category, id";
      params = [category, req.user.id];
    } else {
      // Default: all system exercises + own custom exercises
      query = "SELECT id, category, title_ru, title_en, title_es, description_ru, description_en, description_es, instructions_ru, instructions_en, instructions_es, is_custom, therapist_id, created_at, updated_at FROM exercises WHERE is_custom = 0 OR therapist_id = ? ORDER BY category, id";
      params = [req.user.id];
    }

    const results = db.exec(query, params);

    if (!results.length) {
      return res.json({ exercises: [], categories: [], grouped: {} });
    }

    const columns = results[0].columns;
    const { language } = req.query;
    const validLangs = ['ru', 'en', 'es'];
    const lang = validLangs.includes(language) ? language : null;

    const exercises = results[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });

      // Add is_own boolean: true if this exercise belongs to the requesting therapist
      obj.is_own = obj.therapist_id === req.user.id;

      // If language specified, add convenience fields with localized content
      if (lang) {
        obj.title = obj[`title_${lang}`] || obj.title_en;
        obj.description = obj[`description_${lang}`] || obj.description_en;
        obj.instructions = obj[`instructions_${lang}`] || obj.instructions_en;
      }

      return obj;
    });

    // Group by category
    const grouped = {};
    const categories = [];
    for (const ex of exercises) {
      if (!grouped[ex.category]) {
        grouped[ex.category] = [];
        categories.push(ex.category);
      }
      grouped[ex.category].push(ex);
    }

    res.json({ exercises, categories, grouped, language: lang || 'all' });
  } catch (error) {
    logger.error('Get exercises error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

// GET /api/exercises/categories - List available categories
router.get('/categories', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    seedDefaultExercises(db);

    const results = db.exec("SELECT DISTINCT category FROM exercises ORDER BY category");
    const categories = results.length ? results[0].values.map(r => r[0]) : [];

    res.json({ categories });
  } catch (error) {
    logger.error('Get exercise categories error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/exercises/:id - Get single exercise by ID
router.get('/:id', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec("SELECT id, category, title_ru, title_en, title_es, description_ru, description_en, description_es, instructions_ru, instructions_en, instructions_es, is_custom, therapist_id, created_at FROM exercises WHERE id = ?", [req.params.id]);

    if (!results.length || !results[0].values.length) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    const columns = results[0].columns;
    const row = results[0].values[0];
    const exercise = {};
    columns.forEach((col, i) => { exercise[col] = row[i]; });

    // Add is_own boolean
    exercise.is_own = exercise.therapist_id === req.user.id;

    // Support language parameter
    const { language } = req.query;
    const validLangs = ['ru', 'en', 'es'];
    const lang = validLangs.includes(language) ? language : null;
    if (lang) {
      exercise.title = exercise[`title_${lang}`] || exercise.title_en;
      exercise.description = exercise[`description_${lang}`] || exercise.description_en;
      exercise.instructions = exercise[`instructions_${lang}`] || exercise.instructions_en;
    }

    res.json({ exercise });
  } catch (error) {
    logger.error('Get exercise error: ' + error.message);
    res.status(500).json({ error: 'Failed to fetch exercise' });
  }
});

// POST /api/exercises - Create a custom exercise
router.post('/', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const {
      category, title_ru, title_en, title_es,
      description_ru, description_en, description_es,
      instructions_ru, instructions_en, instructions_es
    } = req.body;

    // Validate: at least one title required
    if (!title_ru && !title_en && !title_es) {
      return res.status(400).json({ error: 'At least one title (title_ru or title_en or title_es) is required' });
    }

    // Validate: at least one instructions field required
    if (!instructions_ru && !instructions_en && !instructions_es) {
      return res.status(400).json({ error: 'At least one instructions field is required' });
    }

    // Validate category
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }
    // Allow standard categories + custom categories (alphanumeric, hyphens, underscores)
    if (!ALLOWED_CATEGORIES.includes(category) && !/^[a-zA-Z0-9_-]+$/.test(category)) {
      return res.status(400).json({ error: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')} or a custom alphanumeric category` });
    }

    // Only therapists/superadmins can create exercises
    if (req.user.role === 'client') {
      return res.status(403).json({ error: 'Only therapists can create exercises' });
    }

    db.run(
      `INSERT INTO exercises (category, title_ru, title_en, title_es, description_ru, description_en, description_es, instructions_ru, instructions_en, instructions_es, is_custom, therapist_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
      [
        category,
        title_ru || null, title_en || null, title_es || null,
        description_ru || null, description_en || null, description_es || null,
        instructions_ru || null, instructions_en || null, instructions_es || null,
        req.user.id
      ]
    );

    // Get the inserted ID
    const idResult = db.exec("SELECT last_insert_rowid()");
    const exerciseId = idResult[0].values[0][0];

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [req.user.id, 'exercise_created', 'exercise', exerciseId, JSON.stringify({ category, title_en: title_en || title_ru || title_es })]
    );

    saveDatabase();

    logger.info(`Exercise created: id=${exerciseId} by therapist=${req.user.id}`);

    // Return the created exercise
    const results = db.exec(
      "SELECT id, category, title_ru, title_en, title_es, description_ru, description_en, description_es, instructions_ru, instructions_en, instructions_es, is_custom, therapist_id, created_at, updated_at FROM exercises WHERE id = ?",
      [exerciseId]
    );
    const columns = results[0].columns;
    const row = results[0].values[0];
    const exercise = {};
    columns.forEach((col, i) => { exercise[col] = row[i]; });
    exercise.is_own = true;

    res.status(201).json({ message: 'Exercise created successfully', exercise });
  } catch (error) {
    logger.error('Create exercise error: ' + error.message);
    res.status(500).json({ error: 'Failed to create exercise' });
  }
});

// PUT /api/exercises/:id - Update a custom exercise (own only)
router.put('/:id', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const exerciseId = req.params.id;

    // Check exercise exists
    const results = db.exec("SELECT id, is_custom, therapist_id FROM exercises WHERE id = ?", [exerciseId]);
    if (!results.length || !results[0].values.length) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    const [id, is_custom, therapist_id] = results[0].values[0];

    // Check ownership: must be custom AND owned by this therapist
    if (!is_custom) {
      return res.status(403).json({ error: 'Cannot modify system exercises' });
    }
    if (therapist_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only modify your own exercises' });
    }

    const {
      category, title_ru, title_en, title_es,
      description_ru, description_en, description_es,
      instructions_ru, instructions_en, instructions_es
    } = req.body;

    // Validate category if provided
    if (category !== undefined) {
      if (!category) {
        return res.status(400).json({ error: 'Category cannot be empty' });
      }
      if (!ALLOWED_CATEGORIES.includes(category) && !/^[a-zA-Z0-9_-]+$/.test(category)) {
        return res.status(400).json({ error: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')} or a custom alphanumeric category` });
      }
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];

    const fields = {
      category, title_ru, title_en, title_es,
      description_ru, description_en, description_es,
      instructions_ru, instructions_en, instructions_es
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(value || null);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(exerciseId);

    db.run(`UPDATE exercises SET ${updates.join(', ')} WHERE id = ?`, params);

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [req.user.id, 'exercise_updated', 'exercise', exerciseId, JSON.stringify({ updated_fields: Object.keys(fields).filter(k => fields[k] !== undefined) })]
    );

    saveDatabase();

    logger.info(`Exercise updated: id=${exerciseId} by therapist=${req.user.id}`);

    // Return updated exercise
    const updated = db.exec(
      "SELECT id, category, title_ru, title_en, title_es, description_ru, description_en, description_es, instructions_ru, instructions_en, instructions_es, is_custom, therapist_id, created_at, updated_at FROM exercises WHERE id = ?",
      [exerciseId]
    );
    const columns = updated[0].columns;
    const row = updated[0].values[0];
    const exercise = {};
    columns.forEach((col, i) => { exercise[col] = row[i]; });
    exercise.is_own = true;

    res.json({ message: 'Exercise updated successfully', exercise });
  } catch (error) {
    logger.error('Update exercise error: ' + error.message);
    res.status(500).json({ error: 'Failed to update exercise' });
  }
});

// DELETE /api/exercises/:id - Delete a custom exercise (own only, no active deliveries)
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    const exerciseId = req.params.id;

    // Check exercise exists
    const results = db.exec("SELECT id, is_custom, therapist_id, title_en, title_ru FROM exercises WHERE id = ?", [exerciseId]);
    if (!results.length || !results[0].values.length) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    const [id, is_custom, therapist_id, title_en, title_ru] = results[0].values[0];

    // Check ownership
    if (!is_custom) {
      return res.status(403).json({ error: 'Cannot delete system exercises' });
    }
    if (therapist_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own exercises' });
    }

    // Check for active deliveries (status != 'completed')
    const activeDeliveries = db.exec(
      "SELECT COUNT(*) FROM exercise_deliveries WHERE exercise_id = ? AND status != 'completed'",
      [exerciseId]
    );
    const activeCount = activeDeliveries.length ? activeDeliveries[0].values[0][0] : 0;
    if (activeCount > 0) {
      return res.status(400).json({ error: 'Cannot delete exercise with active deliveries', active_deliveries: activeCount });
    }

    // Delete the exercise
    db.run("DELETE FROM exercises WHERE id = ?", [exerciseId]);

    // Audit log
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [req.user.id, 'exercise_deleted', 'exercise', exerciseId, JSON.stringify({ title_en: title_en || title_ru })]
    );

    saveDatabase();

    logger.info(`Exercise deleted: id=${exerciseId} by therapist=${req.user.id}`);

    res.json({ message: 'Exercise deleted successfully', id: parseInt(exerciseId) });
  } catch (error) {
    logger.error('Delete exercise error: ' + error.message);
    res.status(500).json({ error: 'Failed to delete exercise' });
  }
});

module.exports = router;
