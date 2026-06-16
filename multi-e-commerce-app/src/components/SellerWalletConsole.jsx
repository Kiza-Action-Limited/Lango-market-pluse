import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { paymentService } from '../services/paymentService';
import { formatCurrency } from '../utils/formatters';

const SellerWalletConsole = ({ className = '' }) => {
  const { isSeller } = useAuth();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [walletState, setWalletState] = useState({
    balance: null,
    details: null,
    transactions: [],
    statement: null,
  });
  const [forms, setForms] = useState({
    addAmount: '',
    addMethod: 'mpesa',
    withdrawAmount: '',
    withdrawPhone: '',
    transferTo: '',
    transferAmount: '',
    transferDescription: '',
  });

  const loadWallet = async () => {
    if (!isSeller) return;
    setLoading(true);
    try {
      const [balanceRes, detailsRes, txRes, statementRes] = await Promise.all([
        paymentService.getWalletBalance().catch((error) => ({ __error: error })),
        paymentService.getWalletDetails().catch((error) => ({ __error: error })),
        paymentService.getWalletTransactions({ page: 1, limit: 5 }).catch((error) => ({ __error: error })),
        paymentService.getWalletStatement({ page: 1, limit: 5 }).catch((error) => ({ __error: error })),
      ]);

      setWalletState({
        balance: balanceRes?.balance ?? balanceRes?.data?.balance ?? null,
        details: detailsRes?.__error ? null : (detailsRes?.wallet || detailsRes?.data || detailsRes || null),
        transactions: txRes?.transactions || txRes?.data?.transactions || [],
        statement: statementRes?.__error ? null : (statementRes?.statement || statementRes?.data || statementRes || null),
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, [isSeller]);

  const refreshWallet = async () => {
    await loadWallet();
  };

  const updateForm = (field, value) => {
    setForms((prev) => ({ ...prev, [field]: value }));
  };

  const runAction = async (actionKey, fn, successMessage) => {
    setActionLoading(actionKey);
    try {
      await fn();
      toast.success(successMessage);
      setForms((prev) => ({
        ...prev,
        addAmount: '',
        withdrawAmount: '',
        withdrawPhone: '',
        transferTo: '',
        transferAmount: '',
        transferDescription: '',
      }));
      await loadWallet();
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to ${actionKey.replace(/-/g, ' ')}`);
    } finally {
      setActionLoading('');
    }
  };

  if (!isSeller) return null;

  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#F97316]">Wallet center</p>
          <h3 className="mt-2 text-2xl font-bold text-[#111827]">Payment Wallet</h3>
          <p className="mt-2 text-sm text-gray-600">These controls call the backend wallet, statement, and transaction endpoints directly.</p>
        </div>
        <button
          type="button"
          onClick={refreshWallet}
          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Wallet'}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-[#FFF7ED] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9A3412]">Balance</p>
          <p className="mt-2 text-3xl font-bold text-[#111827]">{walletState.balance === null ? '-' : `KES ${Number(walletState.balance || 0).toLocaleString()}`}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Transactions</p>
          <p className="mt-2 text-3xl font-bold text-[#111827]">{walletState.transactions.length}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Statement</p>
          <p className="mt-2 text-sm text-gray-600">{walletState.statement ? 'Loaded from backend' : 'No statement loaded yet'}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <form
          className="rounded-xl border border-gray-200 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!forms.addAmount) return toast.error('Amount is required');
            return runAction(
              'add-funds',
              () => paymentService.addWalletFunds({
                amount: Number(forms.addAmount),
                paymentMethod: forms.addMethod,
                description: 'Wallet top-up from seller dashboard',
              }),
              'Wallet top-up sent'
            );
          }}
        >
          <h4 className="font-semibold text-[#111827]">Add Funds</h4>
          <div className="mt-3 space-y-3">
            <input
              type="number"
              min="10"
              value={forms.addAmount}
              onChange={(e) => updateForm('addAmount', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Amount"
            />
            <select
              value={forms.addMethod}
              onChange={(e) => updateForm('addMethod', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="mpesa">M-Pesa</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
            <button
              type="submit"
              disabled={actionLoading === 'add-funds'}
              className="w-full rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
            >
              {actionLoading === 'add-funds' ? 'Sending...' : 'Add Funds'}
            </button>
          </div>
        </form>

        <form
          className="rounded-xl border border-gray-200 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!forms.withdrawAmount || !forms.withdrawPhone) return toast.error('Amount and phone number are required');
            return runAction(
              'withdraw',
              () => paymentService.withdrawWalletFunds({
                amount: Number(forms.withdrawAmount),
                phoneNumber: forms.withdrawPhone,
              }),
              'Withdrawal request sent'
            );
          }}
        >
          <h4 className="font-semibold text-[#111827]">Withdraw</h4>
          <div className="mt-3 space-y-3">
            <input
              type="number"
              min="50"
              value={forms.withdrawAmount}
              onChange={(e) => updateForm('withdrawAmount', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Amount"
            />
            <input
              type="tel"
              value={forms.withdrawPhone}
              onChange={(e) => updateForm('withdrawPhone', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Phone number"
            />
            <button
              type="submit"
              disabled={actionLoading === 'withdraw'}
              className="w-full rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {actionLoading === 'withdraw' ? 'Sending...' : 'Withdraw to M-Pesa'}
            </button>
          </div>
        </form>

        <form
          className="rounded-xl border border-gray-200 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!forms.transferTo || !forms.transferAmount) return toast.error('Recipient and amount are required');
            return runAction(
              'transfer',
              () => paymentService.transferWalletFunds({
                toUserId: forms.transferTo,
                amount: Number(forms.transferAmount),
                description: forms.transferDescription || 'Wallet transfer',
              }),
              'Transfer sent'
            );
          }}
        >
          <h4 className="font-semibold text-[#111827]">Transfer</h4>
          <div className="mt-3 space-y-3">
            <input
              type="text"
              value={forms.transferTo}
              onChange={(e) => updateForm('transferTo', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Recipient user ID"
            />
            <input
              type="number"
              min="10"
              value={forms.transferAmount}
              onChange={(e) => updateForm('transferAmount', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Amount"
            />
            <input
              type="text"
              value={forms.transferDescription}
              onChange={(e) => updateForm('transferDescription', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Description"
            />
            <button
              type="submit"
              disabled={actionLoading === 'transfer'}
              className="w-full rounded-lg bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-60"
            >
              {actionLoading === 'transfer' ? 'Sending...' : 'Transfer Funds'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-4">
          <h4 className="font-semibold text-[#111827]">Recent Wallet Transactions</h4>
          <div className="mt-3 space-y-3">
            {walletState.transactions.length ? walletState.transactions.map((tx, index) => (
              <div key={tx._id || index} className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[#111827]">{tx.description || tx.type || 'Transaction'}</p>
                  <p className="font-semibold text-[#16A34A]">{formatCurrency(tx.amount || 0)}</p>
                </div>
                <p className="mt-1 text-xs text-gray-500">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'Recently'}</p>
              </div>
            )) : (
              <p className="text-sm text-gray-500">No wallet transactions loaded yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <h4 className="font-semibold text-[#111827]">Wallet Details</h4>
          <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-[#111827] p-4 text-xs leading-5 text-green-100">
            {JSON.stringify(walletState.details || walletState.statement, null, 2)}
          </pre>
        </div>
      </div>
    </section>
  );
};

export default SellerWalletConsole;
