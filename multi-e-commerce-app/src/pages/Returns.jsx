import React from 'react';

const Returns = () => {
  return (
    <div className="bg-[#F9FAFB] min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-[#111827] mb-2">Returns & Refunds</h1>
        <p className="text-[#6B7280] mb-8">Guidelines for return requests, verification, and refund processing.</p>

        <div className="space-y-5">
          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Return Eligibility</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              Items must be returned in original condition, with proof of transaction and within the seller-approved return window.
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Non-Returnable Items</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              Perishable goods, used consumables, and customized items may not be eligible unless damaged or incorrectly fulfilled.
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Verification Process</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              Returns are reviewed using order details, delivery confirmation, and where applicable QR handshake verification.
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Refund Timelines</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              Approved refunds are processed back to the original payment method, typically within 5-10 business days.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Returns;
