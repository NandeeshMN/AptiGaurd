import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/auth/Logo';
import {
  LayoutDashboard,
  ClipboardList,
  History,
  BarChart3,
  User,
  Settings,
  LogOut,
  Bell,
  HelpCircle,
  Clock,
  BookOpen,
  TrendingUp,
  Menu,
  X,
  Plus,
  HelpCircle as QuestionIcon,
  Users,
  Search,
  CheckSquare
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
      setIsLoggingOut(false);
    }
  };

  // Determine user role (Bypass based on email structure)
  const isAdmin = currentUser?.email?.toLowerCase() === 'nandeeshmn12@gmail.com';

  const studentName = currentUser?.displayName || 'Nandesh M N';
  const userEmail = currentUser?.email || 'student@example.com';
  const initials = isAdmin ? 'A' : studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  /* ==========================================
     ADMIN DASHBOARD VIEW
     ========================================== */
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#f3f6fc] flex text-[#0f172a] font-sans">
        
        {/* 1. LEFT SIDEBAR (Desktop) */}
        <aside className="hidden md:flex w-[260px] bg-white border-r border-slate-200/80 flex-col justify-between flex-shrink-0 relative select-none">
          <div className="p-6">
            
            {/* Branding headers */}
            <div className="flex items-center space-x-3 mb-6">
              <Logo className="w-10 h-10 shadow-none border-none p-0 flex items-center justify-center bg-transparent" />
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">AptiGuard</h1>
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                  Assessment Management
                </p>
              </div>
            </div>

            {/* Sidebar prominent Create Button */}
            <button className="w-full mb-6 py-2.5 px-4 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white font-semibold text-xs rounded-lg flex items-center justify-center space-x-2 transition-colors duration-255 shadow-xs focus:outline-none uppercase tracking-wider">
              <Plus className="w-4 h-4" />
              <span>Create New Test</span>
            </button>

            {/* Navigation links */}
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4.5 h-4.5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('tests')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'tests'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-4.5 h-4.5" />
                <span>Tests</span>
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'questions'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <QuestionIcon className="w-4.5 h-4.5" />
                <span>Questions</span>
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'students'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Users className="w-4.5 h-4.5" />
                <span>Students</span>
              </button>
              <button
                onClick={() => setActiveTab('attempts')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'attempts'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <History className="w-4.5 h-4.5" />
                <span>Test Attempts</span>
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'results'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-4.5 h-4.5" />
                <span>Results</span>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'analytics'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-4.5 h-4.5" />
                <span>Analytics</span>
              </button>
            </nav>
          </div>

          {/* Bottom profile info block */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                A
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">AptiGuard Admin</p>
                <p className="text-[10px] text-slate-500 truncate">{userEmail}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-red-200/60 bg-red-50/40 hover:bg-red-50 active:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </div>
        </aside>

        {/* Mobile menu trigger */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
            <aside className="relative flex w-[260px] max-w-xs flex-col bg-white p-6 shadow-xl z-10">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3 mb-6">
                <Logo className="w-9 h-9 shadow-none border-none p-0 flex items-center justify-center bg-transparent" />
                <div>
                  <h1 className="text-base font-bold text-slate-900 leading-tight">AptiGuard</h1>
                  <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Assessment Management</p>
                </div>
              </div>
              <nav className="space-y-1.5 flex-1">
                <button
                  onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                    activeTab === 'dashboard' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                  }`}
                >
                  <LayoutDashboard className="w-4.5 h-4.5" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => { setActiveTab('tests'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                    activeTab === 'tests' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                  }`}
                >
                  <ClipboardList className="w-4.5 h-4.5" />
                  <span>Tests</span>
                </button>
              </nav>
              <div className="pt-4 border-t border-slate-100 mt-auto">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-red-200/60 bg-red-50/40 text-red-600 text-xs font-bold rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* 2. MAIN CONTENT WRAPPER */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
          
          {/* Header row (Desktop Search & actions) */}
          <header className="bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between sticky top-0 z-35 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none"
              >
                <Menu className="w-6 h-6" />
              </button>
              
              {/* Search bar widget */}
              <div className="relative w-64 md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#0952cc]/30 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 relative focus:outline-none">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
              </button>
              <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 focus:outline-none">
                <Settings className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-extrabold shadow-sm">
                A
              </div>
            </div>
          </header>

          {/* Inner Content Area */}
          <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1200px] w-full mx-auto space-y-6">
            
            {/* Greeting */}
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">Good morning, Admin 👋</h2>
              <p className="text-xs text-slate-500 font-medium">Here's what's happening with AptiGuard today.</p>
            </div>

            {/* Metrics widgets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Tests</p>
                  <h3 className="text-2xl font-extrabold text-[#031b4e]">24</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">Created assessments</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg text-[#0952cc]"><ClipboardList className="w-5 h-5" /></div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Students</p>
                  <h3 className="text-2xl font-extrabold text-[#031b4e]">486</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">Registered students</p>
                </div>
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Users className="w-5 h-5" /></div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Tests</p>
                  <h3 className="text-2xl font-extrabold text-[#031b4e]">03</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">Currently available</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Clock className="w-5 h-5" /></div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Completed Attempts</p>
                  <h3 className="text-2xl font-extrabold text-[#031b4e]">1,284</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">Total submissions</p>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><CheckSquare className="w-5 h-5" /></div>
              </div>
            </div>

            {/* Quick Actions Buttons Row */}
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider shadow-xs focus:outline-none">
                + Create Test
              </button>
              <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg uppercase tracking-wider shadow-xs focus:outline-none">
                Add Questions
              </button>
              <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg uppercase tracking-wider shadow-xs focus:outline-none">
                View Students
              </button>
              <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg uppercase tracking-wider shadow-xs focus:outline-none">
                View Results
              </button>
            </div>

            {/* Content Splits */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 columns: Tests table log */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Recent Tests</h3>
                  <button className="text-xs font-bold text-[#0952cc] hover:underline">View All</button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">
                          <th className="py-3 px-4">Test</th>
                          <th className="py-3 px-4">Questions</th>
                          <th className="py-3 px-4">Duration</th>
                          <th className="py-3 px-4">Students</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                        <tr>
                          <td className="py-3.5 px-4 text-slate-800 font-bold leading-tight">Quantitative Aptitude</td>
                          <td className="py-3.5 px-4 text-slate-600">30</td>
                          <td className="py-3.5 px-4 text-slate-600">30 min</td>
                          <td className="py-3.5 px-4 text-slate-950 font-bold">120</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">Active</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3.5 px-4 text-slate-800 font-bold leading-tight">Logical Reasoning Assessment</td>
                          <td className="py-3.5 px-4 text-slate-600">25</td>
                          <td className="py-3.5 px-4 text-slate-600">25 min</td>
                          <td className="py-3.5 px-4 text-slate-950 font-bold">86</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">Scheduled</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3.5 px-4 text-slate-800 font-bold leading-tight">Verbal Ability Test</td>
                          <td className="py-3.5 px-4 text-slate-600">30</td>
                          <td className="py-3.5 px-4 text-slate-600">20 min</td>
                          <td className="py-3.5 px-4 text-slate-950 font-bold">142</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-slate-50 text-slate-600 border border-slate-200">Completed</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right column sidebar widgets */}
              <div className="space-y-6">
                
                {/* Upcoming Tests widget list */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                  <h4 className="text-xs font-extrabold text-[#031b4e] uppercase tracking-wide">Upcoming Tests</h4>
                  
                  {/* Test 1 */}
                  <div className="flex items-start space-x-3 pb-3 border-b border-slate-100">
                    <div className="p-2 bg-blue-50 rounded-lg text-[#0952cc] text-center w-12 flex-shrink-0">
                      <p className="text-[9px] font-extrabold uppercase">Aug</p>
                      <p className="text-xs font-bold leading-tight">11</p>
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-[11px] font-bold text-slate-800 truncate">Logical Reasoning Assessment</h5>
                      <p className="text-[10px] text-slate-400 font-medium">10:00 AM &middot; 86 students</p>
                    </div>
                  </div>

                  {/* Test 2 */}
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 text-center w-12 flex-shrink-0">
                      <p className="text-[9px] font-extrabold uppercase">Aug</p>
                      <p className="text-xs font-bold leading-tight">12</p>
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-[11px] font-bold text-slate-800 truncate">Quantitative Aptitude Test</h5>
                      <p className="text-[10px] text-slate-400 font-medium">2:00 PM &middot; 120 students</p>
                    </div>
                  </div>
                </div>

                {/* Activity Feed log stream */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                  <h4 className="text-xs font-extrabold text-[#031b4e] uppercase tracking-wide">Recent Activity</h4>
                  <div className="relative pl-4 border-l border-slate-200 space-y-4 text-[11px] text-slate-600 font-medium">
                    <div className="relative">
                      <span className="w-2 h-2 bg-[#0952cc] rounded-full absolute left-[-20px] top-1" />
                      <p className="text-slate-800 font-bold">120 students completed Quantitative Aptitude</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">8m ago</p>
                    </div>
                    <div className="relative">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full absolute left-[-20px] top-1" />
                      <p className="text-slate-800 font-bold">15 new students registered</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">1h ago</p>
                    </div>
                  </div>
                </div>

                {/* Performance progress metrics bar */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                  <h4 className="text-xs font-extrabold text-[#031b4e] uppercase tracking-wide">Performance Metrics</h4>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-slate-500">Average Score</span>
                    <span className="text-slate-850">78%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-[#0952cc] h-2 rounded-full" style={{ width: '78%' }} />
                  </div>
                </div>

              </div>

            </div>

          </main>
        </div>

      </div>
    );
  }

  /* ==========================================
     STUDENT DASHBOARD VIEW (Default)
     ========================================== */
  return (
    <div className="min-h-screen bg-[#f3f6fc] flex text-[#0f172a] font-sans">
      
      {/* LEFT SIDEBAR (Desktop) */}
      <aside className="hidden md:flex w-[260px] bg-white border-r border-slate-200/80 flex-col justify-between flex-shrink-0 relative select-none">
        
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <Logo className="w-10 h-10 shadow-none border-none p-0 flex items-center justify-center bg-transparent" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">AptiGuard</h1>
              <p className="text-[9px] font-semibold text-[#0952cc] uppercase tracking-wider">
                Student Portal
              </p>
            </div>
          </div>

          <nav className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Main Menu</p>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'bg-blue-50 text-[#0952cc]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('available')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === 'available'
                  ? 'bg-blue-50 text-[#0952cc]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-4.5 h-4.5" />
              <span>Available Tests</span>
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === 'results'
                  ? 'bg-blue-50 text-[#0952cc]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4.5 h-4.5" />
              <span>Results</span>
            </button>

            <div className="pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Account</p>
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'profile'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <User className="w-4.5 h-4.5" />
                <span>Profile</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'settings'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Settings className="w-4.5 h-4.5" />
                <span>Settings</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Profile details block */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-bold shadow-sm">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{studentName}</p>
              <p className="text-[10px] text-slate-500 truncate">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-red-200/60 bg-red-50/40 hover:bg-red-50 active:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer trigger */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="relative flex w-[260px] max-w-xs flex-col bg-white p-6 shadow-xl z-10">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 mb-8">
              <Logo className="w-9 h-9 shadow-none border-none p-0 flex items-center justify-center bg-transparent" />
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">AptiGuard</h1>
                <p className="text-[8px] font-semibold text-[#0952cc] uppercase tracking-wider">Student Portal</p>
              </div>
            </div>
            <nav className="space-y-1.5 flex-1">
              <button
                onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                  activeTab === 'dashboard' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                }`}
              >
                <LayoutDashboard className="w-4.5 h-4.5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => { setActiveTab('available'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                  activeTab === 'available' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                }`}
              >
                <ClipboardList className="w-4.5 h-4.5" />
                <span>Available Tests</span>
              </button>
              <button
                onClick={() => { setActiveTab('results'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                  activeTab === 'results' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                }`}
              >
                <BarChart3 className="w-4.5 h-4.5" />
                <span>Results</span>
              </button>
            </nav>
            <div className="pt-4 border-t border-slate-100 mt-auto">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{studentName}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-red-200/60 bg-red-50/40 text-red-600 text-xs font-bold rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
        
        {/* Mobile Header Bar */}
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-bold text-slate-900 text-sm">AptiGuard</span>
          </div>
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 text-slate-400 cursor-pointer" />
            <div className="w-8 h-8 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
          </div>
        </header>

        {/* Inner Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1200px] w-full mx-auto">
          
          {/* Top Header Row (Desktop Layout) */}
          <div className="hidden md:flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
                Good evening, {studentName.split(' ')[0]} 👋
              </h2>
              <p className="text-xs text-slate-500 font-medium">Ready for your next aptitude challenge?</p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-500 shadow-sm relative focus:outline-none">
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
              </button>
              <button className="p-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-500 shadow-sm focus:outline-none">
                <HelpCircle className="w-4.5 h-4.5" />
              </button>
              <div className="w-9 h-9 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                {initials}
              </div>
            </div>
          </div>

          {/* Grid Splits */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column widgets (Stretched to col-span-3) */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Statistic widgets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Available Tests</p>
                  <h3 className="text-2xl font-extrabold text-[#031b4e]">03</h3>
                  <p className="text-[9px] font-semibold text-[#0952cc] uppercase mt-1 leading-tight">Tests Available for you</p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Completed Tests</p>
                  <h3 className="text-2xl font-extrabold text-[#031b4e]">08</h3>
                  <p className="text-[9px] font-semibold text-emerald-600 uppercase mt-1 leading-tight">Successfully Completed</p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Average Score</p>
                  <h3 className="text-2xl font-extrabold text-[#031b4e]">78%</h3>
                  <p className="text-[9px] font-semibold text-indigo-600 uppercase mt-1 leading-tight">Across Completed Tests</p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Best Score</p>
                  <h3 className="text-2xl font-extrabold text-[#031b4e]">92%</h3>
                  <p className="text-[9px] font-semibold text-amber-600 uppercase mt-1 leading-tight">Highest Score Achieved</p>
                </div>
              </div>

              {/* Available Tests */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Available Tests</h3>
                  <button className="text-xs font-bold text-[#0952cc] hover:underline">View All &rarr;</button>
                </div>

                {/* Test 1 */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-200 transition-colors duration-200">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-extrabold text-slate-900 leading-tight">Quantitative Aptitude Assessment</h4>
                      <span className="px-2 py-0.5 rounded text-[8px] font-semibold uppercase bg-blue-50 text-[#0952cc] border border-blue-100">Available</span>
                    </div>
                    <div className="flex items-center space-x-4 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center space-x-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Intermediate</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>30 Qs</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>30 min</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-start sm:items-end justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold mb-1">
                      SCHEDULED: <span className="text-slate-700">Today, 7:00 PM</span>
                    </div>
                    <button className="px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-[11px] font-bold rounded-lg transition-colors focus:outline-none">
                      START TEST
                    </button>
                  </div>
                </div>

                {/* Test 2 */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-200 transition-colors duration-200">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-extrabold text-slate-900 leading-tight">Logical Reasoning Assessment</h4>
                      <span className="px-2 py-0.5 rounded text-[8px] font-semibold uppercase bg-blue-50 text-[#0952cc] border border-blue-100">Available</span>
                    </div>
                    <div className="flex items-center space-x-4 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center space-x-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Advanced</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>25 Qs</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>45 min</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-start sm:items-end justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold mb-1">
                      SCHEDULED: <span className="text-slate-700">Tomorrow, 10:00 AM</span>
                    </div>
                    <button className="px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-[11px] font-bold rounded-lg transition-colors focus:outline-none">
                      START TEST
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Recent Activity</h3>
                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">
                          <th className="py-3 px-4">Test</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Score</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                        <tr>
                          <td className="py-3.5 px-4 text-slate-800">Quantitative Aptitude</td>
                          <td className="py-3.5 px-4 text-slate-500">Aug 8, 2026</td>
                          <td className="py-3.5 px-4 text-slate-900 font-bold">84%</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">Completed</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3.5 px-4 text-slate-800">Logical Reasoning</td>
                          <td className="py-3.5 px-4 text-slate-500">Aug 5, 2026</td>
                          <td className="py-3.5 px-4 text-slate-900 font-bold">76%</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">Completed</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3.5 px-4 text-slate-800">Verbal Ability</td>
                          <td className="py-3.5 px-4 text-slate-500">Aug 2, 2026</td>
                          <td className="py-3.5 px-4 text-slate-900 font-bold">91%</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">Completed</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column widgets (Removed Performance and Upcoming Test) */}
            <div className="hidden lg:block space-y-6">
              {/* Sidebar column remains hidden or clean spacer as requested */}
            </div>

          </div>

        </main>
      </div>

    </div>
  );
};
export default Dashboard;
