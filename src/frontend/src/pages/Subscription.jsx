import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PLAN_DETAILS = {
  trial: { name: 'Trial', price: 'Free', clients: 3, sessions: 5, features: ['Basic dashboard', 'Timeline view', 'SOS alerts'] },
  basic: { name: 'Basic', price: '$19/mo', clients: 10, sessions: 20, features: ['Full exercise library', 'Basic dashboard', 'Timeline view', 'SOS alerts'] },
  pro: { name: 'Pro', price: '$49/mo', clients: 30, sessions: 60, features: ['Custom exercises', 'Full analytics', 'NL queries (text + voice)', 'Timeline view', 'SOS alerts'] },
  premium: { name: 'Premium', price: '$99/mo', clients: 'Unlimited', sessions: 'Unlimited', features: ['Everything in Pro', 'Priority support', 'Full analytics + export', 'Unlimited usage'] }
};

const PLAN_ORDER = { trial: 0, basic: 1, pro: 2, premium: 3 };

export default function Subscription() {
  const navigate = useNavigate();
  const location = useLocation();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSubscription();

    if (location.pathname === '/subscription/success') {
      setSuccess('Your plan has been upgraded successfully!');
    }
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/subscription/current', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSubscription(data.subscription);
    } catch (err) {
      setError('Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan) => {
    setProcessing(plan);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create checkout session');
        return;
      }

      if (data.auto_completed) {
        setSuccess(`Successfully upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan!`);
        fetchSubscription();
      } else if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleDowngrade = async (plan) => {
    setProcessing(plan);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to change plan');
        return;
      }

      if (data.subscription?.scheduled) {
        const effectiveDate = new Date(data.subscription.effective_date).toLocaleDateString();
        setSuccess(`Downgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)} scheduled. Your current access continues until ${effectiveDate}.`);
      } else {
        setSuccess(data.message);
      }

      if (data.downgrade_warning) {
        setError(data.downgrade_warning.message);
      }

      fetchSubscription();
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-500">Loading subscription...</p>
      </div>
    );
  }

  const currentPlan = subscription?.plan || 'trial';
  const pendingPlan = subscription?.pending_plan;

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-stone-900">Subscription</h1>
          <p className="text-stone-500 text-sm">Manage your PsyLink plan</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Current Plan */}
        <div className="mb-8 p-6 bg-white rounded-xl border border-stone-200 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900 mb-2">Current Plan</h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800 capitalize">
              {currentPlan}
            </span>
            <span className="text-stone-500">
              Status: <span className={`font-medium ${subscription?.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                {subscription?.status || 'N/A'}
              </span>
            </span>
            {subscription?.trial_ends_at && currentPlan === 'trial' && (
              <span className="text-stone-500">
                Trial ends: {new Date(subscription.trial_ends_at).toLocaleDateString()}
              </span>
            )}
            {subscription?.current_period_end && currentPlan !== 'trial' && (
              <span className="text-stone-500">
                Period ends: {new Date(subscription.current_period_end).toLocaleDateString()}
              </span>
            )}
          </div>
          {pendingPlan && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              Downgrade to <span className="font-semibold capitalize">{pendingPlan}</span> scheduled for end of current billing period
              ({subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'end of period'}).
              Your current {currentPlan} access remains active until then.
            </div>
          )}
        </div>

        {/* Plan Cards */}
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(PLAN_DETAILS).map(([planKey, plan]) => {
            const isCurrent = planKey === currentPlan;
            const isUpgrade = PLAN_ORDER[planKey] > PLAN_ORDER[currentPlan];
            const isDowngrade = PLAN_ORDER[planKey] < PLAN_ORDER[currentPlan];
            const isPending = planKey === pendingPlan;

            return (
              <div
                key={planKey}
                className={`p-6 rounded-xl border-2 ${
                  isCurrent
                    ? 'border-teal-500 bg-teal-50'
                    : isPending
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                } shadow-sm transition-all`}
              >
                <h3 className="text-xl font-bold text-stone-900">{plan.name}</h3>
                <p className="text-3xl font-bold text-teal-600 mt-2">{plan.price}</p>
                <div className="mt-4 space-y-2 text-sm text-stone-600">
                  <p>Clients: <span className="font-medium">{plan.clients}</span></p>
                  <p>Sessions/mo: <span className="font-medium">{plan.sessions}</span></p>
                </div>
                <ul className="mt-4 space-y-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="text-sm text-stone-600 flex items-start gap-1">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 px-4 rounded-lg bg-teal-600 text-white font-medium opacity-50 cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : isPending ? (
                    <button
                      disabled
                      className="w-full py-2 px-4 rounded-lg bg-amber-500 text-white font-medium opacity-70 cursor-not-allowed"
                    >
                      Downgrade Scheduled
                    </button>
                  ) : isUpgrade ? (
                    <button
                      onClick={() => handleUpgrade(planKey)}
                      disabled={processing === planKey}
                      className="w-full py-2 px-4 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                      {processing === planKey ? 'Processing...' : `Upgrade to ${plan.name}`}
                    </button>
                  ) : isDowngrade && planKey !== 'trial' ? (
                    <button
                      onClick={() => handleDowngrade(planKey)}
                      disabled={processing === planKey}
                      className="w-full py-2 px-4 rounded-lg border border-stone-300 text-stone-600 font-medium hover:bg-stone-50 transition-colors disabled:opacity-50"
                    >
                      {processing === planKey ? 'Processing...' : `Downgrade to ${plan.name}`}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
