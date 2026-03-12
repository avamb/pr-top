import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatUserDateOnly } from '../utils/formatDate';

const PLAN_DETAILS = {
  trial: { name: 'Trial', price: 'Free', clients: 3, sessions: 5, features: ['Basic dashboard', 'Timeline view', 'SOS alerts'] },
  basic: { name: 'Basic', price: '$19/mo', clients: 10, sessions: 20, features: ['Full exercise library', 'Basic dashboard', 'Timeline view', 'SOS alerts'] },
  pro: { name: 'Pro', price: '$49/mo', clients: 30, sessions: 60, features: ['Custom exercises', 'Full analytics', 'NL queries (text + voice)', 'Timeline view', 'SOS alerts'] },
  premium: { name: 'Premium', price: '$99/mo', clients: 'Unlimited', sessions: 'Unlimited', features: ['Everything in Pro', 'Priority support', 'Full analytics + export', 'Unlimited usage'] }
};

const PLAN_ORDER = { trial: 0, basic: 1, pro: 2, premium: 3 };

export default function Subscription() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const token = localStorage.getItem('token');

  const isExpiredRedirect = location.state?.expired === true;

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSubscription();
    fetchPayments();

    if (location.pathname === '/subscription/success') {
      setSuccess(t('subscription.upgradeSuccess', { plan: '' }));
    }
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/subscription/current', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      const data = await res.json();
      setSubscription(data.subscription);
    } catch (err) {
      setError(t('subscription.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    setPaymentsLoading(true);
    try {
      const res = await fetch('/api/subscription/payments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (err) {
      // Non-critical - don't show error for payment history
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const formatAmount = (amount, currency) => {
    const val = (amount / 100).toFixed(2);
    const sym = currency === 'usd' ? '$' : currency?.toUpperCase() + ' ';
    return `${sym}${val}`;
  };

  const getStatusBadge = (status) => {
    const styles = {
      succeeded: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-amber-100 text-amber-800',
      pending: 'bg-blue-100 text-blue-800'
    };
    return styles[status] || 'bg-stone-100 text-stone-800';
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
        setError(data.error || t('subscription.failedCheckout'));
        return;
      }

      if (data.auto_completed) {
        setSuccess(t('subscription.upgradeSuccess', { plan: plan.charAt(0).toUpperCase() + plan.slice(1) }));
        fetchSubscription();
        fetchPayments();
      } else if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      setError(t('subscription.networkError'));
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm(t('subscription.cancelConfirm'))) {
      return;
    }
    setProcessing('cancel');
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('subscription.failedCancel'));
        return;
      }

      if (data.subscription?.access_until) {
        const accessDate = formatUserDateOnly(data.subscription.access_until);
        setSuccess(t('subscription.cancelSuccess', { date: accessDate }));
      } else {
        setSuccess(data.message);
      }

      fetchSubscription();
    } catch (err) {
      setError(t('subscription.networkError'));
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
        setError(data.error || t('subscription.failedChange'));
        return;
      }

      if (data.subscription?.scheduled) {
        const effectiveDate = formatUserDateOnly(data.subscription.effective_date);
        setSuccess(t('subscription.downgradeSuccess', { plan: plan.charAt(0).toUpperCase() + plan.slice(1), date: effectiveDate }));
      } else {
        setSuccess(data.message);
      }

      if (data.downgrade_warning) {
        setError(data.downgrade_warning.message);
      }

      fetchSubscription();
    } catch (err) {
      setError(t('subscription.networkError'));
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-500">{t('subscription.loadingSubscription')}</p>
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
          <h1 className="text-2xl font-bold text-stone-900">{t('subscription.title')}</h1>
          <p className="text-stone-500 text-sm">{t('subscription.subtitle')}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Expired Trial Banner */}
        {(isExpiredRedirect || subscription?.status === 'expired') && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <h3 className="text-amber-800 font-semibold text-lg">{t('subscription.trialExpiredTitle')}</h3>
            <p className="text-amber-700 mt-1">{t('subscription.trialExpiredDesc')}</p>
          </div>
        )}

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
          <h2 className="text-lg font-semibold text-stone-900 mb-2">{t('subscription.currentPlan')}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800 capitalize">
              {currentPlan}
            </span>
            <span className="text-stone-500">
              {t('subscription.status')}: <span className={`font-medium ${subscription?.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                {subscription?.status || 'N/A'}
              </span>
            </span>
            {subscription?.trial_ends_at && currentPlan === 'trial' && (
              <span className="text-stone-500">
                {t('subscription.trialEnds', { date: formatUserDateOnly(subscription.trial_ends_at) })}
              </span>
            )}
            {subscription?.current_period_end && currentPlan !== 'trial' && (
              <span className="text-stone-500">
                {t('subscription.periodEnds', { date: formatUserDateOnly(subscription.current_period_end) })}
              </span>
            )}
          </div>
          {pendingPlan && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              {t('subscription.downgradeScheduled', {
                plan: pendingPlan,
                date: subscription?.current_period_end ? formatUserDateOnly(subscription.current_period_end) : '',
                currentPlan: currentPlan
              })}
            </div>
          )}
          {subscription?.status === 'canceled' && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {t('subscription.subscriptionCanceled')}
              {subscription?.current_period_end && (
                <> {t('subscription.accessUntil', { date: formatUserDateOnly(subscription.current_period_end) })}</>
              )}
              {subscription?.canceled_at && (
                <> {t('subscription.canceledOn', { date: formatUserDateOnly(subscription.canceled_at) })}</>
              )}
            </div>
          )}
          {subscription?.status === 'active' && currentPlan !== 'trial' && !pendingPlan && (
            <div className="mt-3">
              <button
                onClick={handleCancel}
                disabled={processing === 'cancel'}
                className="text-sm text-red-600 hover:text-red-700 underline disabled:opacity-50"
              >
                {processing === 'cancel' && <LoadingSpinner size={14} className="mr-1" />}
                {processing === 'cancel' ? t('subscription.canceling') : t('subscription.cancelSubscription')}
              </button>
            </div>
          )}
        </div>

        {/* Plan Cards */}
        <h2 className="text-lg font-semibold text-stone-900 mb-4">{t('subscription.availablePlans')}</h2>
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
                  <p>{t('subscription.clients')}: <span className="font-medium">{plan.clients}</span></p>
                  <p>{t('subscription.sessionsPerMonth')}: <span className="font-medium">{plan.sessions}</span></p>
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
                      {t('subscription.currentPlanBtn')}
                    </button>
                  ) : isPending ? (
                    <button
                      disabled
                      className="w-full py-2 px-4 rounded-lg bg-amber-500 text-white font-medium opacity-70 cursor-not-allowed"
                    >
                      {t('subscription.downgradeScheduledBtn')}
                    </button>
                  ) : isUpgrade ? (
                    <button
                      onClick={() => handleUpgrade(planKey)}
                      disabled={processing === planKey}
                      className="w-full py-2 px-4 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                      {processing === planKey && <LoadingSpinner size={16} className="mr-2" />}
                      {processing === planKey ? t('subscription.processing') : t('subscription.upgradeTo', { plan: plan.name })}
                    </button>
                  ) : isDowngrade && planKey !== 'trial' ? (
                    <button
                      onClick={() => handleDowngrade(planKey)}
                      disabled={processing === planKey}
                      className="w-full py-2 px-4 rounded-lg border border-stone-300 text-stone-600 font-medium hover:bg-stone-50 transition-colors disabled:opacity-50"
                    >
                      {processing === planKey && <LoadingSpinner size={16} className="mr-2" />}
                      {processing === planKey ? t('subscription.processing') : t('subscription.downgradeTo', { plan: plan.name })}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment History */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Payment History</h2>
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            {paymentsLoading ? (
              <div className="p-6 text-center text-stone-500">Loading payment history...</div>
            ) : payments.length === 0 ? (
              <div className="p-6 text-center text-stone-400">No payments yet</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Payment ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-stone-50">
                      <td className="px-6 py-4 text-sm text-stone-900">
                        {formatUserDateOnly(payment.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-stone-900">
                        {formatAmount(payment.amount, payment.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-400 font-mono truncate max-w-[200px]">
                        {payment.stripe_payment_intent_id || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
