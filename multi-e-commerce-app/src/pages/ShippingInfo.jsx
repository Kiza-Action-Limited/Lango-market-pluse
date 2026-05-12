import React from 'react';

const ShippingInfo = () => {
  return (
    <div className="bg-[#F9FAFB] min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-[#111827] mb-2">Shipping Information</h1>
        <p className="text-[#6B7280] mb-8">How deliveries are processed across the Lango Market Pulse network.</p>

        <div className="space-y-5">
          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Coverage Areas</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              Delivery availability depends on active sellers and logistics partners in your area. Coverage is strongest along main trade corridors and nearby urban centers.
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Processing Time</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              Most orders are prepared within 1-2 business days after payment confirmation. Larger wholesale orders may require extra handling time.
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Delivery Time</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              Standard deliveries usually arrive within 2-5 business days depending on destination, weather, and route activity. Shared-load logistics may affect arrival windows.
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Tracking & Confirmation</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              Order tracking and QR confirmation are used to validate pickup and delivery milestones before final settlement.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ShippingInfo;
