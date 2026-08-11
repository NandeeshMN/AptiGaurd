import React, { useState } from 'react';
import { Search, Clock, MoreVertical } from 'lucide-react';

export const AvailableTestsView: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'available' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');

  // Static assessment cards matching the visual reference image
  const assessments = [
    {
      id: 1,
      title: 'Quantitative Aptitude Assessment',
      difficulty: 'Intermediate',
      status: 'AVAILABLE',
      questions: 30,
      duration: '30 Mins',
      marks: 100,
      scheduled: 'Today, 7:00 PM',
      borderColor: 'border-t-[#0952cc]',
      colorTheme: '#0952cc',
      actionText: 'START TEST',
    },
    {
      id: 2,
      title: 'Logical Reasoning Assessment',
      difficulty: 'Intermediate',
      status: 'UPCOMING',
      questions: 25,
      duration: '25 Mins',
      marks: 100,
      scheduled: 'Tmrw, 10:00 AM',
      borderColor: 'border-t-amber-600',
      colorTheme: '#b45309',
      actionText: 'VIEW DETAILS',
    },
    {
      id: 3,
      title: 'Verbal Ability Assessment',
      difficulty: 'Beginner',
      status: 'UPCOMING',
      questions: 30,
      duration: '20 Mins',
      marks: 100,
      scheduled: 'Aug 14, 2026',
      borderColor: 'border-t-slate-350',
      colorTheme: '#64748b',
      actionText: 'VIEW DETAILS',
    }
  ];

  // Filtering logic
  const filteredAssessments = assessments.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'all') return matchesSearch;
    return matchesSearch && item.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      
      {/* Title & Description Headers */}
      <div>
        <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">Available Tests</h2>
        <p className="text-xs text-slate-500 font-medium">Explore assessments assigned to you and start your next aptitude challenge.</p>
      </div>

      {/* Filters row section */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Search bar input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all"
          />
        </div>

        {/* Tab pills & Sort dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100/80 p-0.5 rounded-lg flex space-x-1 border border-slate-200/50">
            {(['all', 'available', 'upcoming', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all ${
                  filter === tab
                    ? 'bg-white text-[#0952cc] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none cursor-pointer"
          >
            <option value="date">Sort by: Date</option>
            <option value="questions">Sort by: Questions</option>
            <option value="duration">Sort by: Duration</option>
          </select>
        </div>

      </div>

      {/* Grid listing assessment cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredAssessments.map((test) => (
          <div
            key={test.id}
            className={`bg-white rounded-xl border border-slate-200/80 border-t-4 ${test.borderColor} shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden min-h-[380px]`}
          >
            {/* Header detail */}
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-4">
                <span 
                  className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border"
                  style={{
                    backgroundColor: test.status === 'AVAILABLE' ? '#eff6ff' : '#f8fafc',
                    color: test.status === 'AVAILABLE' ? '#0952cc' : '#475569',
                    borderColor: test.status === 'AVAILABLE' ? '#dbeafe' : '#e2e8f0',
                  }}
                >
                  {test.status}
                </span>
                <button className="p-1 rounded hover:bg-slate-100 text-slate-400 focus:outline-none">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-sm font-extrabold text-slate-900 leading-snug mb-1">
                {test.title}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mb-5">
                &bull; {test.difficulty}
              </p>

              {/* Grid properties */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Questions</span>
                  <span className="text-xs font-bold text-slate-800">{test.questions}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Duration</span>
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{test.duration}</span>
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Marks</span>
                  <span className="text-xs font-bold text-slate-800">{test.marks}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Scheduled</span>
                  <span className="text-xs font-bold text-[#0952cc] truncate">{test.scheduled}</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions CTA */}
            <div className="px-5 pb-5 pt-2">
              <button
                className={`w-full py-2.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors duration-250 ${
                  test.status === 'AVAILABLE'
                    ? 'bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white'
                    : 'bg-blue-50/50 hover:bg-blue-50 text-[#0952cc] border border-blue-100/50'
                }`}
              >
                {test.actionText}
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
export default AvailableTestsView;
