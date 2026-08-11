import React, { useState } from 'react';
import { Search, Trophy, CheckCircle, BarChart3, TrendingUp } from 'lucide-react';

export const ResultsView: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Static stats values matching visual references
  const stats = [
    {
      title: 'Average Score',
      value: '78%',
      subtitle: 'Across completed tests',
      icon: <BarChart3 className="w-5 h-5 text-[#0952cc]" />,
      progress: 78,
      progressColor: 'bg-[#0952cc]',
    },
    {
      title: 'Best Score',
      value: '92%',
      subtitle: 'Quantitative Aptitude',
      icon: <Trophy className="w-5 h-5 text-[#0952cc]" />,
      progress: 92,
      progressColor: 'bg-emerald-600',
    },
    {
      title: 'Tests Completed',
      value: '08',
      subtitle: 'This Semester',
      icon: <CheckCircle className="w-5 h-5 text-[#0952cc]" />,
      progress: 100,
      progressColor: 'bg-indigo-600',
    },
    {
      title: 'Pass Rate',
      value: '88%',
      subtitle: 'Passed assessments',
      icon: <TrendingUp className="w-5 h-5 text-[#0952cc]" />,
      progress: 88,
      progressColor: 'bg-[#0952cc]',
    }
  ];

  // Static results items matching reference image
  const resultsData = [
    {
      id: 1,
      test: 'Quantitative Aptitude',
      date: 'Aug 8, 2026',
      questions: 30,
      score: '84/100',
      percentage: '84%',
      status: 'PASSED',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    {
      id: 2,
      test: 'Logical Reasoning',
      date: 'Aug 5, 2026',
      questions: 25,
      score: '76/100',
      percentage: '76%',
      status: 'PASSED',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    {
      id: 3,
      test: 'Verbal Ability',
      date: 'Aug 2, 2026',
      questions: 30,
      score: '42/100',
      percentage: '42%',
      status: 'FAILED',
      statusColor: 'bg-red-50 text-red-700 border-red-100',
    }
  ];

  // Filtering table results
  const filteredResults = resultsData.filter(item => {
    const matchesSearch = item.test.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'all') return matchesSearch;
    return matchesSearch && item.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      
      {/* Title Headers */}
      <div>
        <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">My Results</h2>
        <p className="text-xs text-slate-500 font-medium">Review your completed assessments and track your performance.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between min-h-[140px] hover:border-blue-200 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.title}</p>
                <div className="flex items-baseline space-x-1">
                  <h3 className="text-2xl font-extrabold text-[#031b4e]">{stat.value.replace('%', '')}</h3>
                  {stat.value.includes('%') && <span className="text-xs text-slate-500 font-semibold">%</span>}
                </div>
              </div>
              <div className="p-2 bg-blue-50/50 rounded-lg">{stat.icon}</div>
            </div>
            
            <div className="mt-4 space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className={`${stat.progressColor} h-1.5 rounded-full`} style={{ width: `${stat.progress}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate leading-none pt-1">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Results Log Table Section */}
      <div className="space-y-4">
        
        {/* Table Filters header */}
        <div className="bg-slate-50/60 p-3 rounded-t-xl border border-slate-200/80 border-b-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search results..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all"
            />
          </div>

          <div className="bg-white p-0.5 rounded-lg flex space-x-1 border border-slate-200">
            {(['all', 'passed', 'failed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold capitalize transition-all ${
                  filter === tab
                    ? 'bg-slate-100 text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tabular data log card */}
        <div className="bg-white rounded-b-xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/20 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">
                  <th className="py-3.5 px-4">Test</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Questions</th>
                  <th className="py-3.5 px-4">Score</th>
                  <th className="py-3.5 px-4">%</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {filteredResults.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/30">
                    <td className="py-4 px-4 text-slate-800 font-bold">{item.test}</td>
                    <td className="py-4 px-4 text-slate-500">{item.date}</td>
                    <td className="py-4 px-4 text-slate-600">{item.questions}</td>
                    <td className="py-4 px-4 text-slate-900 font-extrabold">{item.score}</td>
                    <td className="py-4 px-4 text-slate-900 font-extrabold">{item.percentage}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${item.statusColor}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      {/* Empty column placeholder or view logs button matching design */}
                      <button className="text-[10px] font-bold text-[#0952cc] hover:underline focus:outline-none">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
export default ResultsView;
