import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = 'http://localhost:3001/api';

const categoryIcons = {
  breathing: '\u{1F32C}\uFE0F',
  mindfulness: '\u{1F9D8}',
  cognitive: '\u{1F9E0}',
  journaling: '\u{1F4D3}',
  behavioral: '\u{1F3AF}',
  'self-compassion': '\u{1F49C}'
};

const categoryColors = {
  breathing: 'bg-sky-50 border-sky-200 text-sky-700',
  mindfulness: 'bg-violet-50 border-violet-200 text-violet-700',
  cognitive: 'bg-amber-50 border-amber-200 text-amber-700',
  journaling: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  behavioral: 'bg-rose-50 border-rose-200 text-rose-700',
  'self-compassion': 'bg-purple-50 border-purple-200 text-purple-700'
};

const categoryI18nKeys = {
  breathing: 'exerciseLibrary.breathing',
  mindfulness: 'exerciseLibrary.mindfulness',
  cognitive: 'exerciseLibrary.cognitive',
  journaling: 'exerciseLibrary.journaling',
  behavioral: 'exerciseLibrary.behavioral',
  'self-compassion': 'exerciseLibrary.selfCompassion'
};

function getLocalizedField(exercise, field, lang) {
  return exercise[`${field}_${lang}`] || exercise[field] || exercise[`${field}_en`] || '';
}

function ExerciseCard({ exercise, onClick, lang }) {
  const title = getLocalizedField(exercise, 'title', lang);
  const description = getLocalizedField(exercise, 'description', lang);
  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <h3 className="font-semibold text-text text-base mb-1">{title}</h3>
      <p className="text-sm text-secondary line-clamp-2">{description}</p>
    </div>
  );
}

function ExerciseModal({ exercise, onClose, t, lang }) {
  if (!exercise) return null;

  const title = getLocalizedField(exercise, 'title', lang);
  const description = getLocalizedField(exercise, 'description', lang);
  const instructions = getLocalizedField(exercise, 'instructions', lang);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border mb-2 ${categoryColors[exercise.category] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
              {categoryIcons[exercise.category] || ''} {categoryI18nKeys[exercise.category] ? t(categoryI18nKeys[exercise.category]) : exercise.category}
            </span>
            <h2 className="text-xl font-bold text-text">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label={t('exerciseLibrary.close')}
          >
            &times;
          </button>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-1">{t('exerciseLibrary.description')}</h3>
          <p className="text-text">{description}</p>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-2">{t('exerciseLibrary.instructions')}</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            {instructions ? (
              instructions.split('\n').map((line, i) => (
                <p key={i} className="text-text text-sm mb-1 last:mb-0">{line}</p>
              ))
            ) : (
              <p className="text-secondary text-sm">{t('exerciseLibrary.noInstructions')}</p>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-2 bg-primary text-white rounded-lg py-2 hover:bg-primary/90 transition-colors"
        >
          {t('exerciseLibrary.close')}
        </button>
      </div>
    </div>
  );
}

function ExerciseLibrary() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'en';
  const [grouped, setGrouped] = useState({});
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchExercises(token);
  }, [selectedCategory, lang]);

  async function fetchExercises(tokenArg) {
    const token = tokenArg || localStorage.getItem('token');
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      params.set('language', lang);
      const url = `${API_URL}/exercises?${params.toString()}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch exercises');
      const data = await res.json();
      setGrouped(data.grouped || {});
      // Only update categories from unfiltered response
      if (!selectedCategory && data.categories) {
        setCategories(data.categories);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalExercises = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-text">{t('exerciseLibrary.title')}</h1>
          <span className="text-sm text-secondary">{t('exerciseLibrary.exerciseCount', { count: totalExercises })}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              !selectedCategory
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-secondary border-gray-300 hover:border-primary hover:text-primary'
            }`}
          >
            {t('exerciseLibrary.allCategories')}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-white border-primary'
                  : `${categoryColors[cat] || 'bg-white text-secondary border-gray-300'} hover:opacity-80`
              }`}
            >
              {categoryIcons[cat] || ''} {categoryI18nKeys[cat] ? t(categoryI18nKeys[cat]) : cat}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-secondary">{t('exerciseLibrary.loading')}</div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
            {error}
            <button onClick={() => fetchExercises()} className="ml-2 underline">{t('analytics.retry')}</button>
          </div>
        )}

        {/* Exercise groups */}
        {!loading && !error && Object.keys(grouped).length === 0 && (
          <div className="text-center py-12 text-secondary">{t('exerciseLibrary.noExercises')}</div>
        )}

        {!loading && Object.entries(grouped).map(([category, exercises]) => (
          <div key={category} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{categoryIcons[category] || ''}</span>
              <h2 className="text-lg font-bold text-text">
                {categoryI18nKeys[category] ? t(categoryI18nKeys[category]) : category}
              </h2>
              <span className="text-sm text-secondary">({exercises.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {exercises.map(ex => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  onClick={() => setSelectedExercise(ex)}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        ))}
      </main>

      {/* Detail modal */}
      <ExerciseModal
        exercise={selectedExercise}
        onClose={() => setSelectedExercise(null)}
        t={t}
        lang={lang}
      />
    </div>
  );
}

export default ExerciseLibrary;
