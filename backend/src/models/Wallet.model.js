const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    balance: { type: Number, min: 0, default: 0 },
    lockedBalance: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'KES' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', WalletSchema);
