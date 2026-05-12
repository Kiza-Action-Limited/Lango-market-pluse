// src/pages/AISourcingHub.jsx
import { useState } from 'react';
import { Search, Sparkles, Building2, Palette, BarChart3, Star, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const AI_API_ENDPOINT = '';

const TASKS = [
  { id: 'manufacturer', label: 'Verified manufacturer', icon: Building2, color: 'bg-blue-100 text-blue-700' },
  { id: 'design', label: 'Design with AI', icon: Palette, color: 'bg-purple-100 text-purple-700' },
  { id: 'product', label: 'Product search', icon: Search, color: 'bg-green-100 text-green-700' },
  { id: 'bestsellers', label: 'Analyze bestsellers', icon: BarChart3, color: 'bg-orange-100 text-orange-700' },
  { id: 'evaluate', label: 'Evaluate', icon: Star, color: 'bg-yellow-100 text-yellow-700' },
];

function autoSelectTask(query) {
  const lower = query.toLowerCase();
  if (lower.includes('manufacturer') || lower.includes('supplier') || lower.includes('factory')) return 'manufacturer';
  if (lower.includes('design') || lower.includes('create') || lower.includes('style')) return 'design';
  if (lower.includes('bestseller') || lower.includes('trend') || lower.includes('popular')) return 'bestsellers';
  if (lower.includes('evaluate') || lower.includes('review') || lower.includes('reliable')) return 'evaluate';
  return 'product';
}

async function mockAI(query, task) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const taskName = TASKS.find((t) => t.id === task)?.label || 'general';

  return {
    products:
      task === 'manufacturer' || task === 'product'
        ? [
            { name: 'EcoBottle 500ml', price: 4.5, supplier: 'GreenManufacturer Inc.' },
            { name: 'TravelSip Collapsible', price: 3.2, supplier: 'TravelGear Ltd.' },
          ]
        : undefined,
    analysis:
      task === 'bestsellers' ? `Top bestsellers in "${query}" are eco-friendly and under $20.` : undefined,
    designSuggestion:
      task === 'design' ? 'Create a minimalist bottle with bamboo lid and pastel colors.' : undefined,
    evaluation:
      task === 'evaluate' ? 'Top supplier has 4.7/5 stars from 1200 reviews. Reliable.' : undefined,
    answer: !['manufacturer', 'product', 'bestsellers', 'design', 'evaluate'].includes(task)
      ? `I can help with ${taskName} tasks. Please refine your query.`
      : undefined,
  };
}

export default function AISourcingHub() {
  const [input, setInput] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!input.trim()) {
      toast.error('Please describe your sourcing need.');
      return;
    }

    let taskToUse = selectedTask;

    if (!taskToUse) {
      taskToUse = autoSelectTask(input);
      setSelectedTask(taskToUse);
      toast(`Auto-selected: ${TASKS.find((t) => t.id === taskToUse)?.label}`, { icon: '??' });
    }

    setIsLoading(true);
    setResults(null);

    try {
      let data;

      if (AI_API_ENDPOINT) {
        const response = await fetch(AI_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: input, task: taskToUse }),
        });

        if (!response.ok) throw new Error('Backend error');
        data = await response.json();
      } else {
        data = await mockAI(input, taskToUse);
      }

      setResults(data);
      toast.success('AI analysis complete!');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Market Pulse AI Sourcing
        </h1>
        <p className="text-gray-600 mt-2">All tasks in one ask - smart sourcing with AI</p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center mb-6">
        {TASKS.map((task) => {
          const Icon = task.icon;
          const isSelected = selectedTask === task.id;

          return (
            <button
              key={task.id}
              onClick={() => setSelectedTask(isSelected ? null : task.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                isSelected ? 'bg-blue-600 text-white shadow-md' : `${task.color} hover:shadow hover:scale-105`
              }`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{task.label}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex items-start bg-white border border-gray-300 rounded-2xl shadow-lg focus-within:ring-2 focus-within:ring-blue-500">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your needs... e.g., 'Find me verified manufacturers for stainless steel water bottles under $5'"
            className="flex-1 p-4 rounded-2xl resize-none focus:outline-none"
            rows="3"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="m-2 p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-2 flex justify-between">
          <span>AI agentic engine | {AI_API_ENDPOINT ? 'Connected to backend' : 'Mock mode (no backend)'}</span>
          <span>Go beyond search - let AI handle your sourcing workflow</span>
        </div>
      </form>

      {results && (
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 animate-fadeIn">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
            <Sparkles size={20} className="text-blue-600" />
            AI Results
          </h3>

          {results.products && (
            <div className="mb-4">
              <h4 className="font-medium">Suggested Products</h4>
              <ul className="list-disc pl-5 mt-1">
                {results.products.map((p, idx) => (
                  <li key={idx}>
                    {p.name} - ${p.price} from {p.supplier}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.analysis && (
            <div className="mb-4">
              <h4 className="font-medium">Bestseller Analysis</h4>
              <p className="mt-1 text-gray-700">{results.analysis}</p>
            </div>
          )}

          {results.designSuggestion && (
            <div className="mb-4">
              <h4 className="font-medium">AI Design Ideas</h4>
              <p className="mt-1 text-gray-700">{results.designSuggestion}</p>
            </div>
          )}

          {results.evaluation && (
            <div className="mb-4">
              <h4 className="font-medium">Supplier Evaluation</h4>
              <p className="mt-1 text-gray-700">{results.evaluation}</p>
            </div>
          )}

          {results.answer &&
            !results.products &&
            !results.analysis &&
            !results.designSuggestion &&
            !results.evaluation && <p className="text-gray-700">{results.answer}</p>}
        </div>
      )}
    </div>
  );
}
