import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';

export default function AdminAIModels() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null); // provider name being tested
  const [testResult, setTestResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Data from API
  const [summarizationProviders, setSummarizationProviders] = useState([]);
  const [transcriptionProviders, setTranscriptionProviders] = useState([]);
  const [assistantProviders, setAssistantProviders] = useState([]);

  // Form state
  const [sumProvider, setSumProvider] = useState('openai');
  const [sumModel, setSumModel] = useState('gpt-4o-mini');
  const [transProvider, setTransProvider] = useState('openai');
  const [transModel, setTransModel] = useState('whisper-1');
  const [assistProvider, setAssistProvider] = useState('openai');
  const [assistModel, setAssistModel] = useState('gpt-4o-mini');

  // Track what was originally loaded to detect changes
  const [original, setOriginal] = useState({});

  // Knowledge base state
  const [kbStats, setKbStats] = useState(null);
  const [reindexing, setReindexing] = useState(false);
  const [kbMessage, setKbMessage] = useState(null);

  useEffect(() => {
    loadModels();
    loadKBStats();
  }, []);

  const loadModels = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/ai/models`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSummarizationProviders(data.summarization_providers || []);
        setTranscriptionProviders(data.transcription_providers || []);
        setAssistantProviders(data.assistant_providers || []);
        if (data.current) {
          setSumProvider(data.current.summarization?.provider || 'openai');
          setSumModel(data.current.summarization?.model || 'gpt-4o-mini');
          setTransProvider(data.current.transcription?.provider || 'openai');
          setTransModel(data.current.transcription?.model || 'whisper-1');
          setAssistProvider(data.current.assistant?.provider || data.current.summarization?.provider || 'openai');
          setAssistModel(data.current.assistant?.model || data.current.summarization?.model || 'gpt-4o-mini');
          setOriginal({
            sumProvider: data.current.summarization?.provider || 'openai',
            sumModel: data.current.summarization?.model || 'gpt-4o-mini',
            transProvider: data.current.transcription?.provider || 'openai',
            transModel: data.current.transcription?.model || 'whisper-1',
            assistProvider: data.current.assistant?.provider || data.current.summarization?.provider || 'openai',
            assistModel: data.current.assistant?.model || data.current.summarization?.model || 'gpt-4o-mini'
          });
        }
      }
    } catch (err) {
      console.error('Failed to load AI models:', err);
      setError('Failed to load AI model configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/ai/models`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summarization: { provider: sumProvider, model: sumModel },
          transcription: { provider: transProvider, model: transModel },
          assistant: { provider: assistProvider, model: assistModel }
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || t('admin.ai.saved'));
        if (data.current) {
          setOriginal({
            sumProvider: data.current.summarization?.provider,
            sumModel: data.current.summarization?.model,
            transProvider: data.current.transcription?.provider,
            transModel: data.current.transcription?.model,
            assistProvider: data.current.assistant?.provider,
            assistModel: data.current.assistant?.model
          });
        }
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (providerName) => {
    setTesting(providerName);
    setTestResult(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/ai/test?provider=${providerName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ provider: providerName, success: false, message: 'Network error: ' + err.message });
    } finally {
      setTesting(null);
    }
  };

  const loadKBStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/assistant/knowledge-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKbStats(data);
      }
    } catch (err) {
      // Non-critical, ignore
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setKbMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/assistant/reindex`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setKbMessage({ type: 'success', text: `${t('admin.ai.reindexSuccess')}: ${data.indexed} files, ${data.chunks} chunks (${data.elapsed_ms}ms)` });
        loadKBStats();
      } else {
        setKbMessage({ type: 'error', text: data.error || 'Failed to re-index' });
      }
    } catch (err) {
      setKbMessage({ type: 'error', text: 'Network error: ' + err.message });
    } finally {
      setReindexing(false);
    }
  };

  // Model pricing per 1M input tokens (for price hints)
  const modelPricing = {
    'gpt-4o-mini': 0.15, 'gpt-4.1-nano': 0.10, 'gpt-4.1-mini': 0.40, 'gpt-4o': 2.50,
    'gpt-4-turbo': 10.00, 'o4-mini': 1.10, 'whisper-1': 0.006,
    'claude-3.5-haiku': 0.80, 'claude-4-sonnet': 3.00,
    'gemini-2.0-flash': 0.10, 'gemini-2.5-flash': 0.15, 'gemini-2.5-pro': 1.25,
    'deepseek/deepseek-chat-v3': 0.27, 'deepseek/deepseek-r1': 0.55, 'qwen/qwen-2.5-72b': 0.30
  };

  // Recommended models with badges
  const recommendedModels = {
    'gpt-4.1-nano': 'Cheapest',
    'gemini-2.0-flash': 'Cheapest',
    'claude-3.5-haiku': 'Best Balance',
    'deepseek/deepseek-chat-v3': 'Best Value'
  };

  const getModelPriceHint = (model) => {
    const price = modelPricing[model];
    if (price == null) return '';
    if (price < 0.01) return `~$${price}/min`;
    return `~$${price.toFixed(2)}/1M tokens`;
  };

  // Get models for selected provider
  const getModelsForProvider = (providers, provName) => {
    const prov = providers.find(p => p.provider === provName);
    return prov ? prov.models : [];
  };

  const providerDisplayName = (name) => {
    const names = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google Gemini', openrouter: 'OpenRouter' };
    return names[name] || name;
  };

  const providerEnvHint = (name) => {
    const hints = {
      openai: 'AI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GOOGLE_AI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY'
    };
    return hints[name] || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-lg">{t('admin.ai.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <a href="#main-content" className="skip-to-content">
        {t('nav.skipToContent')}
      </a>

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-text">{t('admin.ai.title')}</h2>
          <p className="text-secondary mt-1">{t('admin.ai.subtitle')}</p>
        </div>

        {message && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
            {error}
          </div>
        )}

        {/* Test Result Banner */}
        {testResult && (
          <div className={`mb-6 p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className="flex items-center gap-2 font-medium">
              <span>{testResult.success ? '\u2705' : '\u274C'}</span>
              <span>{providerDisplayName(testResult.provider)}: {testResult.message}</span>
            </div>
            {testResult.response_time_ms && (
              <p className="text-sm mt-1">{t('admin.ai.responseTime')}: {testResult.response_time_ms}ms | {t('admin.ai.modelUsed')}: {testResult.model_used}</p>
            )}
          </div>
        )}

        <div className="space-y-8">
          {/* Summarization Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-text mb-1">{t('admin.ai.summarization')}</h3>
            <p className="text-sm text-secondary mb-4">{t('admin.ai.summarizationDesc')}</p>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {summarizationProviders.map(prov => {
                const isSelected = sumProvider === prov.provider;
                return (
                  <div
                    key={prov.provider}
                    onClick={() => {
                      setSumProvider(prov.provider);
                      setSumModel(prov.models[0] || '');
                    }}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-text">{providerDisplayName(prov.provider)}</span>
                      <div className="flex items-center gap-2">
                        {prov.configured ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            {t('admin.ai.configured')}
                          </span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            {t('admin.ai.notConfigured')}
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-medium">
                            {t('admin.ai.active')}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-secondary">
                      {prov.models.length} {t('admin.ai.modelsAvailable')}
                      {!prov.configured && ` \u2022 ${t('admin.ai.setEnvVar')}: ${providerEnvHint(prov.provider)}`}
                    </p>
                    {/* Test Connection Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTestConnection(prov.provider); }}
                      disabled={testing === prov.provider}
                      className="mt-2 text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      {testing === prov.provider ? t('admin.ai.testing') : t('admin.ai.testConnection')}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Model Dropdown */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">{t('admin.ai.selectModel')}</label>
              <select
                value={sumModel}
                onChange={(e) => setSumModel(e.target.value)}
                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                {getModelsForProvider(summarizationProviders, sumProvider).map(m => {
                  const hint = getModelPriceHint(m);
                  const badge = recommendedModels[m];
                  return (
                    <option key={m} value={m}>
                      {m}{hint ? ` (${hint})` : ''}{badge ? ` \u2B50 ${badge}` : ''}
                    </option>
                  );
                })}
              </select>
              {original.sumProvider === sumProvider && original.sumModel === sumModel && (
                <p className="text-xs text-green-600 mt-1">{t('admin.ai.currentActive')}</p>
              )}
              {recommendedModels[sumModel] && (
                <p className="text-xs text-amber-600 mt-1">\u2B50 {t('admin.ai.recommended')}: {recommendedModels[sumModel]}</p>
              )}
              {getModelPriceHint(sumModel) && (
                <p className="text-xs text-secondary mt-0.5">{t('admin.ai.pricing')}: {getModelPriceHint(sumModel)}</p>
              )}
            </div>
          </div>

          {/* Transcription Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-text mb-1">{t('admin.ai.transcription')}</h3>
            <p className="text-sm text-secondary mb-4">{t('admin.ai.transcriptionDesc')}</p>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {transcriptionProviders.map(prov => {
                const isSelected = transProvider === prov.provider;
                return (
                  <div
                    key={prov.provider}
                    onClick={() => {
                      setTransProvider(prov.provider);
                      setTransModel(prov.models[0] || '');
                    }}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-text">{providerDisplayName(prov.provider)}</span>
                      <div className="flex items-center gap-2">
                        {prov.configured ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            {t('admin.ai.configured')}
                          </span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            {t('admin.ai.notConfigured')}
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-medium">
                            {t('admin.ai.active')}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-secondary">
                      {prov.models.length} {t('admin.ai.modelsAvailable')}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Model Dropdown */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">{t('admin.ai.selectModel')}</label>
              <select
                value={transModel}
                onChange={(e) => setTransModel(e.target.value)}
                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                {getModelsForProvider(transcriptionProviders, transProvider).map(m => {
                  const hint = getModelPriceHint(m);
                  return <option key={m} value={m}>{m}{hint ? ` (${hint})` : ''}</option>;
                })}
              </select>
              {original.transProvider === transProvider && original.transModel === transModel && (
                <p className="text-xs text-green-600 mt-1">{t('admin.ai.currentActive')}</p>
              )}
            </div>
          </div>

          {/* Assistant Chat Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-text mb-1">{t('admin.ai.assistant')}</h3>
            <p className="text-sm text-secondary mb-4">{t('admin.ai.assistantDesc')}</p>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {assistantProviders.map(prov => {
                const isSelected = assistProvider === prov.provider;
                return (
                  <div
                    key={prov.provider}
                    onClick={() => {
                      setAssistProvider(prov.provider);
                      setAssistModel(prov.models[0] || '');
                    }}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-text">{providerDisplayName(prov.provider)}</span>
                      <div className="flex items-center gap-2">
                        {prov.configured ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            {t('admin.ai.configured')}
                          </span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            {t('admin.ai.notConfigured')}
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-medium">
                            {t('admin.ai.active')}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-secondary">
                      {prov.models.length} {t('admin.ai.modelsAvailable')}
                      {!prov.configured && ` \u2022 ${t('admin.ai.setEnvVar')}: ${providerEnvHint(prov.provider)}`}
                    </p>
                    {/* Test Connection Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTestConnection(prov.provider); }}
                      disabled={testing === prov.provider}
                      className="mt-2 text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      {testing === prov.provider ? t('admin.ai.testing') : t('admin.ai.testConnection')}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Model Dropdown */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">{t('admin.ai.selectModel')}</label>
              <select
                value={assistModel}
                onChange={(e) => setAssistModel(e.target.value)}
                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                {getModelsForProvider(assistantProviders, assistProvider).map(m => {
                  const hint = getModelPriceHint(m);
                  const badge = recommendedModels[m];
                  return (
                    <option key={m} value={m}>
                      {m}{hint ? ` (${hint})` : ''}{badge ? ` \u2B50 ${badge}` : ''}
                    </option>
                  );
                })}
              </select>
              {original.assistProvider === assistProvider && original.assistModel === assistModel && (
                <p className="text-xs text-green-600 mt-1">{t('admin.ai.currentActive')}</p>
              )}
              {recommendedModels[assistModel] && (
                <p className="text-xs text-amber-600 mt-1">\u2B50 {t('admin.ai.recommended')}: {recommendedModels[assistModel]}</p>
              )}
              {getModelPriceHint(assistModel) && (
                <p className="text-xs text-secondary mt-0.5">{t('admin.ai.pricing')}: {getModelPriceHint(assistModel)}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
          >
            {saving ? t('admin.ai.saving') : t('admin.ai.save')}
          </button>
        </div>

        {/* Knowledge Base Section */}
        <div className="mt-10 border-t pt-8">
          <h3 className="text-lg font-semibold text-heading mb-2">{t('admin.ai.knowledgeBase')}</h3>
          <p className="text-sm text-secondary mb-4">{t('admin.ai.knowledgeBaseDesc')}</p>

          {kbStats && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-secondary">{t('admin.ai.kbFiles')}:</span>
                  <span className="ml-1 font-medium">{kbStats.total_files}</span>
                </div>
                <div>
                  <span className="text-secondary">{t('admin.ai.kbChunks')}:</span>
                  <span className="ml-1 font-medium">{kbStats.total_chunks}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-secondary">{t('admin.ai.kbLastUpdated')}:</span>
                  <span className="ml-1 font-medium">
                    {kbStats.last_updated ? new Date(kbStats.last_updated + 'Z').toLocaleString() : t('admin.ai.kbNever')}
                  </span>
                </div>
              </div>
              {kbStats.by_type && Object.keys(kbStats.by_type).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(kbStats.by_type).map(([type, count]) => (
                    <span key={type} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                      {type}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {kbMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${kbMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {kbMessage.text}
            </div>
          )}

          <button
            onClick={handleReindex}
            disabled={reindexing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center gap-2"
          >
            {reindexing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('admin.ai.reindexing')}
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('admin.ai.reindexKnowledgeBase')}
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
