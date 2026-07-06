import React from 'react';
import { FaClock, FaShieldAlt, FaWallet } from 'react-icons/fa';
import SellerWalletConsole from '../components/SellerWalletConsole';

const InfoTile = ({ icon: Icon, label, value, detail }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#FFF7ED] text-[#F97316]">
        <Icon />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-1 text-lg font-bold text-[#111827]">{value}</p>
        <p className="mt-1 text-sm text-gray-500">{detail}</p>
      </div>
    </div>
  </div>
);

const SellerFinance = () => (
  <div className="min-h-full bg-gray-50 p-6">
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#F97316]">Seller finance</p>
          <h1 className="mt-2 text-3xl font-bold text-[#111827]">Wallet, Payouts and Withdrawals</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Track released escrow, queued withdrawals, locked balances, and wallet movements from the live backend ledger.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoTile
          icon={FaWallet}
          label="Available payout"
          value="Live wallet"
          detail="Withdrawable balance is calculated after locked escrow funds."
        />
        <InfoTile
          icon={FaClock}
          label="Withdrawal flow"
          value="M-Pesa queue"
          detail="Requests reserve the balance immediately and stay pending for payout processing."
        />
        <InfoTile
          icon={FaShieldAlt}
          label="Ledger control"
          value="Auditable"
          detail="Every wallet change records before and after balances."
        />
      </div>

      <SellerWalletConsole />
    </div>
  </div>
);

export default SellerFinance;
