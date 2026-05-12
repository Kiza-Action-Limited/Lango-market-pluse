import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="bg-[#F9FAFB] min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-[#111827] mb-2">Privacy Policy</h1>
        <p className="text-[#6B7280] mb-8">How Lango Market Pulse collects, uses, and protects your data.</p>

        <div className="space-y-5">
          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Information We Collect</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              We collect account details, transaction records, product data, order activity, and operational metadata needed to run platform services.
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">How We Use Data</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              Data is used to process orders, improve delivery coordination, generate analytics, detect abuse, and provide subscription-based intelligence features.
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Data Sharing</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              We only share data with relevant trading and logistics participants necessary for completing transactions, plus vetted service providers under strict safeguards.
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Data Security</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              We apply technical and organizational controls to protect account access, payment workflows, and business records from unauthorized use.
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Your Rights</h2>
            <p className="text-[#4B5563] mt-2 leading-7">
              You may request corrections to profile data and can contact your administrator regarding account access, data export, or deletion requests where applicable.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
