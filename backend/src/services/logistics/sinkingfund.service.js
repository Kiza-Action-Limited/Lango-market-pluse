const SinkingFund = require('../../models/SinkingFund.model');
const Logistics = require('../../models/Logistics.model');

class SinkingFundService {
  async getOrCreateFund(driverId) {
    let fund = await SinkingFund.findOne({ driver: driverId });
    
    if (!fund) {
      fund = await SinkingFund.create({ driver: driverId });
    }

    return fund;
  }

  async contribute(driverId, amount, orderId = null, logisticsId = null) {
    const fund = await this.getOrCreateFund(driverId);

    // Calculate driver share
    const driverShare = amount * 0.2;

    fund.contributions.push({
      order: orderId,
      logistics: logisticsId,
      amount,
      driverShare,
      contributedAt: new Date(),
    });

    fund.balance += amount;
    fund.totalContributed += amount;

    await fund.save();
    return fund;
  }

  async updateMileage(driverId, mileageKm) {
    const fund = await this.getOrCreateFund(driverId);

    const oldMileage = fund.mileageKm;
    fund.mileageKm = mileageKm;

    // Check if service is due
    const mileageSinceLastService = mileageKm - (oldMileage % fund.nextServiceKm);
    if (mileageSinceLastService >= fund.nextServiceKm) {
      fund.lastServiceAlertAt = new Date();
      fund.nextServiceKm = mileageKm + 5000;
    }

    await fund.save();
    return fund;
  }

  async withdraw(driverId, amount) {
    const fund = await SinkingFund.findOne({ driver: driverId });

    if (!fund) {
      throw new Error('Sinking fund not found');
    }

    if (fund.balance < amount) {
      throw new Error('Insufficient balance');
    }

    fund.balance -= amount;
    await fund.save();

    return fund;
  }

  async getServiceAlerts() {
    return SinkingFund.find({
      $expr: { $gte: ['$mileageKm', '$nextServiceKm'] },
    }).populate('driver', 'name phone email');
  }

  async getAnalytics() {
    return SinkingFund.aggregate([
      {
        $group: {
          _id: null,
          totalFunds: { $sum: '$balance' },
          totalContributed: { $sum: '$totalContributed' },
          averageBalance: { $avg: '$balance' },
          maxBalance: { $max: '$balance' },
          minBalance: { $min: '$balance' },
          totalDrivers: { $sum: 1 },
          averageMileage: { $avg: '$mileageKm' },
        },
      },
    ]);
  }

  async getAllFunds(page = 1, limit = 20, sortBy = 'balance') {
    const skip = (page - 1) * limit;

    const [funds, total] = await Promise.all([
      SinkingFund.find()
        .populate('driver', 'name phone email')
        .sort({ [sortBy]: -1 })
        .skip(skip)
        .limit(limit),
      SinkingFund.countDocuments(),
    ]);

    return { funds, total };
  }

  async getContributions(driverId, page = 1, limit = 20) {
    const fund = await SinkingFund.findOne({ driver: driverId });

    if (!fund) {
      throw new Error('Sinking fund not found');
    }

    const skip = (page - 1) * limit;
    const contributions = fund.contributions
      .sort((a, b) => b.contributedAt - a.contributedAt)
      .slice(skip, skip + limit);

    return {
      contributions,
      total: fund.contributions.length,
    };
  }
}

module.exports = new SinkingFundService();
