import React from 'react';

const faqs = [
  {
    question: 'What is Lango Market Pulse?',
    answer:
      'Lango Market Pulse is a commerce platform that helps traders, farmers, wholesalers, and logistics teams manage products, orders, payments, and operational intelligence in one place.',
  },
  {
    question: 'How do subscription plans work?',
    answer:
      'Solo plans provide core tools to record and run daily operations. Paid tiers unlock intelligence features like scarcity alerts, CFO insights, and automation.',
  },
  {
    question: 'Do you support secure payments?',
    answer:
      'Yes. Escrow-style payment flows are supported so order delivery and confirmation can happen before funds are fully released.',
  },
  {
    question: 'Can I switch my plan later?',
    answer:
      'Yes. You can review available tiers and switch plans from the Subscription Plans section in your account.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'Use the support channels listed by your account manager, or contact your platform administrator for technical and billing help.',
  },
];

const FAQ = () => {
  return (
    <div className="bg-[#F9FAFB] min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-[#111827] mb-2">Frequently Asked Questions</h1>
        <p className="text-[#6B7280] mb-8">Quick answers to common platform and subscription questions.</p>

        <div className="space-y-4">
          {faqs.map((item) => (
            <section key={item.question} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#111827]">{item.question}</h2>
              <p className="text-[#4B5563] mt-2 leading-7">{item.answer}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FAQ;
