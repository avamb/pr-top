import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCsrfToken } from '../hooks/useCsrfToken';

const API_URL = '/api';

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

const STANDARD_CATEGORIES = ['breathing', 'mindfulness', 'cognitive', 'journaling', 'behavioral', 'self-compassion'];

function getLocalizedField(exercise, field, lang) {
  return exercise[`${field}_${lang}`] || exercise[field] || exercise[`${field}_en`] || '';
}

function ExerciseCard({ exercise, onClick, lang, t, onEdit, onDelete, showActions }) {
  const title = getLocalizedField(exercise, 'title', lang);
  const description = getLocalizedField(exercise, 'description', lang);
  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer relative"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-text text-base truncate">{title}</h3>
            {exercise.is_custom === 1 && (
              <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium shrink-0">
                {t('exerciseLibrary.myBadge')}
              </span>
            )}
          </div>
          <p className="text-sm text-secondary line-clamp-2">{description}</p>
        </div>
        {showActions && exercise.is_own && (
          <div className="flex gap-1 ml-2 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onEdit(exercise)}
              className="p-1.5 text-stone-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
              aria-label={t('exerciseLibrary.editExercise')}
              title={t('exerciseLibrary.editExercise')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(exercise)}
              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              aria-label={t('exerciseLibrary.deleteExercise')}
              title={t('exerciseLibrary.deleteExercise')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
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
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${categoryColors[exercise.category] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                {categoryIcons[exercise.category] || ''} {categoryI18nKeys[exercise.category] ? t(categoryI18nKeys[exercise.category]) : exercise.category}
              </span>
              {exercise.is_custom === 1 && (
                <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">
                  {t('exerciseLibrary.myBadge')}
                </span>
              )}
            </div>
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

// Exercise Form Modal (Create / Edit)
function ExerciseFormModal({ exercise, onClose, onSave, t, saving }) {
  const isEdit = !!exercise;
  const [formLang, setFormLang] = useState('en');
  const [category, setCategory] = useState(exercise?.category || 'breathing');
  const [customCategory, setCustomCategory] = useState('');
  const [titles, setTitles] = useState({
    en: exercise?.title_en || '',
    ru: exercise?.title_ru || '',
    es: exercise?.title_es || '',
    uk: exercise?.title_uk || ''
  });
  const [descriptions, setDescriptions] = useState({
    en: exercise?.description_en || '',
    ru: exercise?.description_ru || '',
    es: exercise?.description_es || '',
    uk: exercise?.description_uk || ''
  });
  const [instructions, setInstructions] = useState({
    en: exercise?.instructions_en || '',
    ru: exercise?.instructions_ru || '',
    es: exercise?.instructions_es || '',
    uk: exercise?.instructions_uk || ''
  });
  const [formError, setFormError] = useState('');

  const isCustomCategory = !STANDARD_CATEGORIES.includes(category) && category !== '';
  const useCustom = isCustomCategory || category === '__custom__';

  function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const effectiveCategory = useCustom ? customCategory : category;

    if (!titles.en && !titles.ru && !titles.es && !titles.uk) {
      setFormError(t('exerciseLibrary.titleRequired'));
      return;
    }
    if (!instructions.en && !instructions.ru && !instructions.es && !instructions.uk) {
      setFormError(t('exerciseLibrary.instructionsRequired'));
      return;
    }
    if (!effectiveCategory) {
      setFormError(t('exerciseLibrary.categoryRequired'));
      return;
    }

    onSave({
      category: effectiveCategory,
      title_en: titles.en || undefined,
      title_ru: titles.ru || undefined,
      title_es: titles.es || undefined,
      title_uk: titles.uk || undefined,
      description_en: descriptions.en || undefined,
      description_ru: descriptions.ru || undefined,
      description_es: descriptions.es || undefined,
      description_uk: descriptions.uk || undefined,
      instructions_en: instructions.en || undefined,
      instructions_ru: instructions.ru || undefined,
      instructions_es: instructions.es || undefined,
      instructions_uk: instructions.uk || undefined
    });
  }

  const langTabs = ['en', 'ru', 'es', 'uk'];
  const langLabels = { en: 'EN', ru: 'RU', es: 'ES', uk: 'UK' };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-stone-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-text">
              {isEdit ? t('exerciseLibrary.editExercise') : t('exerciseLibrary.createExercise')}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{formError}</div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t('exerciseLibrary.categoryLabel')}</label>
            <select
              value={useCustom ? '__custom__' : category}
              onChange={e => {
                if (e.target.value === '__custom__') {
                  setCategory('__custom__');
                  setCustomCategory(isCustomCategory ? category : '');
                } else {
                  setCategory(e.target.value);
                  setCustomCategory('');
                }
              }}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              {STANDARD_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {categoryIcons[cat]} {categoryI18nKeys[cat] ? t(categoryI18nKeys[cat]) : cat}
                </option>
              ))}
              <option value="__custom__">{t('exerciseLibrary.customCategory')}</option>
            </select>
            {useCustom && (
              <input
                type="text"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                placeholder={t('exerciseLibrary.customCategoryPlaceholder')}
                className="mt-2 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            )}
          </div>

          {/* Language tabs */}
          <div className="flex gap-1 border-b border-stone-200">
            {langTabs.map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setFormLang(l)}
                className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
                  formLang === l
                    ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {langLabels[l]}
                {titles[l] && <span className="ml-1 text-green-500">&#x2713;</span>}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              {t('exerciseLibrary.titleLabel')} ({langLabels[formLang]})
            </label>
            <input
              type="text"
              value={titles[formLang]}
              onChange={e => setTitles({ ...titles, [formLang]: e.target.value })}
              placeholder={t('exerciseLibrary.titlePlaceholder')}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              {t('exerciseLibrary.descriptionLabel')} ({langLabels[formLang]})
            </label>
            <textarea
              value={descriptions[formLang]}
              onChange={e => setDescriptions({ ...descriptions, [formLang]: e.target.value })}
              placeholder={t('exerciseLibrary.descriptionPlaceholder')}
              rows={2}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              {t('exerciseLibrary.instructionsLabel')} ({langLabels[formLang]})
            </label>
            <textarea
              value={instructions[formLang]}
              onChange={e => setInstructions({ ...instructions, [formLang]: e.target.value })}
              placeholder={t('exerciseLibrary.instructionsPlaceholder')}
              rows={5}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none font-mono"
            />
            <p className="text-xs text-stone-400 mt-1">{t('exerciseLibrary.instructionsHint')}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-teal-600 text-white rounded-lg py-2 font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? t('exerciseLibrary.saving') : t('exerciseLibrary.saveExercise')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
            >
              {t('exerciseLibrary.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Dialog
function DeleteConfirmDialog({ exercise, onClose, onConfirm, t, lang, deleting, deleteError }) {
  if (!exercise) return null;
  const title = getLocalizedField(exercise, 'title', lang);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-stone-800 mb-2">{t('exerciseLibrary.deleteExercise')}</h3>
        <p className="text-stone-600 mb-1">{t('exerciseLibrary.deleteConfirm')}</p>
        <p className="text-stone-800 font-medium mb-4">"{title}"</p>
        {deleteError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{deleteError}</div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 bg-red-600 text-white rounded-lg py-2 font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleting ? t('exerciseLibrary.deleting') : t('exerciseLibrary.confirmDelete')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-stone-300 text-stone-600 rounded-lg py-2 hover:bg-stone-50 transition-colors"
          >
            {t('exerciseLibrary.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExerciseLibrary() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const csrfToken = useCsrfToken();
  const lang = i18n.language || 'en';
  const [activeView, setActiveView] = useState('library'); // 'library' or 'my'
  const [grouped, setGrouped] = useState({});
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editExercise, setEditExercise] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchExercises(token);
  }, [selectedCategory, lang, activeView]);

  async function fetchExercises(tokenArg) {
    const token = tokenArg || localStorage.getItem('token');
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (activeView === 'my') {
        params.set('filter', 'my');
      }
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
      if (!selectedCategory && data.categories) {
        setCategories(data.categories);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveExercise(formData) {
    const token = localStorage.getItem('token');
    setSaving(true);
    try {
      const isEdit = !!editExercise;
      const url = isEdit ? `${API_URL}/exercises/${editExercise.id}` : `${API_URL}/exercises`;
      const method = isEdit ? 'PUT' : 'POST';

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const res = await fetch(url, { method, headers, body: JSON.stringify(formData) });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save exercise');
      }

      setShowForm(false);
      setEditExercise(null);
      setSuccessMsg(isEdit ? t('exerciseLibrary.exerciseUpdated') : t('exerciseLibrary.exerciseCreated'));
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchExercises(token);
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExercise() {
    if (!deleteTarget) return;
    const token = localStorage.getItem('token');
    setDeleting(true);
    setDeleteError('');
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const res = await fetch(`${API_URL}/exercises/${deleteTarget.id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete exercise');
      }

      setDeleteTarget(null);
      setSuccessMsg(t('exerciseLibrary.exerciseDeleted'));
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchExercises(token);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function handleEdit(exercise) {
    setEditExercise(exercise);
    setShowForm(true);
  }

  function handleDelete(exercise) {
    setDeleteTarget(exercise);
    setDeleteError('');
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
        {/* View Tabs: Library / My Exercises */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveView('library'); setSelectedCategory(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${
                activeView === 'library'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              {t('exerciseLibrary.libraryTab')}
            </button>
            <button
              onClick={() => { setActiveView('my'); setSelectedCategory(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${
                activeView === 'my'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              {t('exerciseLibrary.myExercises')}
            </button>
          </div>

          {activeView === 'my' && (
            <button
              onClick={() => { setEditExercise(null); setShowForm(true); }}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
            >
              + {t('exerciseLibrary.createExercise')}
            </button>
          )}
        </div>

        {/* Hint for library tab */}
        {activeView === 'library' && (
          <p className="text-xs text-stone-400 -mt-4 mb-4">{t('exerciseLibrary.libraryTabHint')}</p>
        )}

        {/* Success message */}
        {successMsg && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm font-medium">{successMsg}</div>
        )}

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

        {/* Empty states */}
        {!loading && !error && Object.keys(grouped).length === 0 && (
          <div className="text-center py-12">
            <p className="text-secondary mb-4">
              {activeView === 'my' ? t('exerciseLibrary.noMyExercises') : t('exerciseLibrary.noExercises')}
            </p>
            {activeView === 'my' && (
              <button
                onClick={() => { setEditExercise(null); setShowForm(true); }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
              >
                + {t('exerciseLibrary.createExercise')}
              </button>
            )}
          </div>
        )}

        {/* Exercise groups */}
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
                  t={t}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  showActions={activeView === 'my'}
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

      {/* Create/Edit form modal */}
      {showForm && (
        <ExerciseFormModal
          exercise={editExercise}
          onClose={() => { setShowForm(false); setEditExercise(null); }}
          onSave={handleSaveExercise}
          t={t}
          saving={saving}
        />
      )}

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        exercise={deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(''); }}
        onConfirm={handleDeleteExercise}
        t={t}
        lang={lang}
        deleting={deleting}
        deleteError={deleteError}
      />
    </div>
  );
}

export default ExerciseLibrary;
