// src/pages/SubscriptionPayment.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TRADER_PLANS, MIZIGO_PLANS } from '../config/subscriptionPlans';
import { useSubscription } from '../context/SubscriptionContext';

export const SubscriptionPayment = () => {
  const navigate = useNavigate();
  const { activateSubscription } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [processing, setProcessing] = useState(false);

  const allPlans = [...TRADER_PLANS, ...MIZIGO_PLANS];

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
  };

  const handlePayment = async () => {
    if (!selectedPlan) return;
    setProcessing(true);
    try {
      // Simulate payment – replace with actual M-Pesa / Stripe integration
      const paymentDetails = {
        method: 'mpesa',
        amount: selectedPlan.priceLabel,
        phone: '2547XXXXXXXX',
      };
      await activateSubscription(selectedPlan.id, paymentDetails);
      // After activation, redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      alert('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="subscription-payment">
      <h1>Choose a plan to access your dashboard</h1>
      <div className="plans-grid">
        {allPlans.map(plan => (
          <div
            key={plan.id}
            className={`plan-card ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
            onClick={() => handleSelectPlan(plan)}
          >
            <h3>{plan.name}</h3>
            <p className="price">{plan.priceLabel}</p>
            <p>{plan.description}</p>
            <ul>
              {plan.featureKeys.slice(0, 4).map(feature => (
                <li key={feature}>✓ {feature.replace(/-/g, ' ')}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {selectedPlan && (
        <button onClick={handlePayment} disabled={processing}>
          {processing ? 'Processing...' : `Pay ${selectedPlan.priceLabel}`}
        </button>
      )}
    </div>
  );
};