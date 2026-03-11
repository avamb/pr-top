import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3001/api';

const categoryLabels = {
  breathing: 'Breathing & Relaxation',
  mindfulness: 'Mindfulness',
  cognitive: 'Cognitive (CBT)',
  journaling: 'Journaling',
  behavioral: 'Behavioral',
  'self-compassion': 'Self-Compassion'
};

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

function ExerciseCard({ exercise, onClick }) {
  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <h3 className="font-semibold text-text text-base mb-1">{exercise.title_en}</h3>
      {exercise.title_ru && (
        <p className="text-xs text-secondary mb-2 italic">{exercise.title_ru}</p>
      )}
      <p className="text-sm text-secondary line-clamp-2">{exercise.description_en}</p>
    </div>
  );
}

function ExerciseModal({ exercise, onClose }) {
  if (!exercise) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border mb-2 ${categoryColors[exercise.category] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
              {categoryIcons[exercise.category] || ''} {categoryLabels[exercise.category] || exercise.category}
            </span>
            <h2 className="text-xl font-bold text-text">{exercise.title_en}</h2>
            {exercise.title_ru && (
              <p className="text-sm text-secondary italic mt-1">{exercise.title_ru}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-1">Description</h3>
          <p className="text-text">{exercise.description_en}</p>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-2">Instructions</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            {exercise.instructions_en ? (
              exercise.instructions_en.split('\n').map((line, i) => (
                <p key={i} className="text-text text-sm mb-1 last:mb-0">{line}</p>
              ))
            ) : (
              <p className="text-secondary text-sm">No instructions available</p>
            )}
          </div>
        </div>

        {exercise.instructions_ru && (
          <details className="mb-4">
            <summary className="text-sm font-semibold text-secondary uppercase tracking-wide cursor-pointer">
              Instructions (Russian)
            </summary>
            <div className="bg-gray-50 rounded-lg p-4 mt-2">
              {exercise.instructions_ru.split('\n').map((line, i) => (
                <p key={i} className="text-text text-sm mb-1 last:mb-0">{line}</p>
              ))}
            </div>
          </details>
        )}

        <button
          onClick={onClose}
          className="w-full mt-2 bg-primary text-white rounded-lg py-2 hover:bg-primary/90 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function ExerciseLibrary() {
  const navigate = useNavigate();
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
  }, [selectedCategory]);

  async function fetchExercises(tokenArg) {
    const token = tokenArg || localStorage.getItem('token');
    setLoading(true);
    setError('');
    try {
      const url = selectedCategory
        ? `${API_URL}/exercises?category=${encodeURIComponent(selectedCategory)}`
        : `${API_URL}/exercises`;
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-secondary hover:text-text transition-colors"
              aria-label="Back to dashboard"
            >
              &larr; Dashboard
            </button>
            <h1 className="text-xl font-bold text-text">Exercise Library</h1>
          </div>
          <span className="text-sm text-secondary">{totalExercises} exercises</span>
        </div>
      </nav>

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
            All Categories
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
              {categoryIcons[cat] || ''} {categoryLabels[cat] || cat}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-secondary">Loading exercises...</div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
            {error}
            <button onClick={() => fetchExercises()} className="ml-2 underline">Retry</button>
          </div>
        )}

        {/* Exercise groups */}
        {!loading && !error && Object.keys(grouped).length === 0 && (
          <div className="text-center py-12 text-secondary">No exercises found.</div>
        )}

        {!loading && Object.entries(grouped).map(([category, exercises]) => (
          <div key={category} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{categoryIcons[category] || ''}</span>
              <h2 className="text-lg font-bold text-text">
                {categoryLabels[category] || category}
              </h2>
              <span className="text-sm text-secondary">({exercises.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {exercises.map(ex => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  onClick={() => setSelectedExercise(ex)}
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
      />
    </div>
  );
}

export default ExerciseLibrary;
