import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Upload, GraduationCap, Archive, AlertCircle, Download, RotateCcw } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { ToastNotification } from '../components/ToastNotification';
import { API_BASE_URL } from '../config/api';
import * as XLSX from 'xlsx';

interface AuthorizedStudent {
  id: string;
  uucmsNo: string;
  fullName?: string;
  year: '1st Year' | '2nd Year';
  status: 'active' | 'graduated';
  registered: boolean;
  uid: string | null;
  createdAt: Timestamp;
}

export const AdminStudentsView = () => {
  const [students, setStudents] = useState<AuthorizedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'1st Year' | '2nd Year' | 'Archived'>('1st Year');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showArchiveAllModal, setShowArchiveAllModal] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [showUnarchiveAllModal, setShowUnarchiveAllModal] = useState(false);
  const [studentToArchive, setStudentToArchive] = useState<string | null>(null);
  const [studentToUnarchive, setStudentToUnarchive] = useState<string | null>(null);
  
  const [newFullName, setNewFullName] = useState('');
  const [newUucms, setNewUucms] = useState('');
  const [newYear, setNewYear] = useState<'1st Year' | '2nd Year'>('1st Year');
  const [addLoading, setAddLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'authorizedStudents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData: AuthorizedStudent[] = [];
      snapshot.forEach(doc => {
        studentData.push({ id: doc.id, ...doc.data() } as AuthorizedStudent);
      });
      setStudents(studentData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching students:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newUucms.trim()) return;
    
    setAddLoading(true);
    setErrorMsg('');
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/students/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fullName: newFullName, uucmsNo: newUucms, year: newYear })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to add student');
      }
      
      setShowAddModal(false);
      setNewFullName('');
      setNewUucms('');
      setToastMsg('Student added successfully.');
    } catch (error: any) {
      setErrorMsg(error.message);
    }
    setAddLoading(false);
  };

  const handlePromote = async () => {
    setAddLoading(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/students/promote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to promote students');
      }
      
      setShowPromoteModal(false);
    } catch (error: any) {
      setToastMsg(error.message || 'Failed to promote students');
    }
    setAddLoading(false);
  };

  const handleArchiveStudent = (uucmsNo: string) => {
    setStudentToArchive(uucmsNo);
    setShowArchiveModal(true);
  };

  const confirmArchiveStudent = async () => {
    if (!studentToArchive) return;
    setAddLoading(true);
    
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/students/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uucmsNumbers: [studentToArchive] })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to archive student');
      }
      
      setToastMsg(`Student ${studentToArchive} archived successfully.`);
      setShowArchiveModal(false);
      setStudentToArchive(null);
    } catch (error: any) {
      setToastMsg(error.message || 'Error archiving student');
    } finally {
      setAddLoading(false);
    }
  };

  const handleArchiveAll = async () => {
    if (filteredStudents.length === 0) return;
    setAddLoading(true);
    
    try {
      const uucmsNumbers = filteredStudents.map(s => s.uucmsNo);
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/students/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uucmsNumbers })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to archive students');
      }
      
      setToastMsg(`Successfully archived ${uucmsNumbers.length} students.`);
      setShowArchiveAllModal(false);
    } catch (error: any) {
      setToastMsg(error.message || 'Error archiving students');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUnarchiveStudent = (uucmsNo: string) => {
    setStudentToUnarchive(uucmsNo);
    setShowUnarchiveModal(true);
  };

  const confirmUnarchiveStudent = async () => {
    if (!studentToUnarchive) return;
    setAddLoading(true);
    
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/students/unarchive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uucmsNumbers: [studentToUnarchive] })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to unarchive student');
      }
      
      setToastMsg(`Student ${studentToUnarchive} unarchived successfully.`);
      setShowUnarchiveModal(false);
      setStudentToUnarchive(null);
    } catch (error: any) {
      setToastMsg(error.message || 'Error unarchiving student');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUnarchiveAll = async () => {
    if (filteredStudents.length === 0) return;
    setAddLoading(true);
    
    try {
      const uucmsNumbers = filteredStudents.map(s => s.uucmsNo);
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/students/unarchive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uucmsNumbers })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to unarchive students');
      }
      
      setToastMsg(`Successfully unarchived ${uucmsNumbers.length} students.`);
      setShowUnarchiveAllModal(false);
    } catch (error: any) {
      setToastMsg(error.message || 'Error unarchiving students');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Full Name', 'UUCMS No', 'Year'],
      ['Nandeesh M N', 'PO2DR24S126012', '1st Year'],
      ['Rahul Kumar', 'PO2DR24S126013', '1st Year']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'student_import_template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAddLoading(true);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Validate columns
        const rowsJson = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[];
        if (rowsJson.length === 0) {
          throw new Error('Excel sheet is empty.');
        }
        const headers = rowsJson[0] as string[];
        const required = ['Full Name', 'UUCMS No', 'Year'];
        const missing = required.filter(r => !headers.includes(r));
        if (missing.length > 0) {
          throw new Error(`Invalid columns. Excel must contain exactly: "Full Name", "UUCMS No", and "Year". Missing: ${missing.join(', ')}`);
        }

        const data = XLSX.utils.sheet_to_json(ws) as any[];
        const parsedStudents = data.map((row) => ({
          fullName: row['Full Name'] ? String(row['Full Name']).trim() : '',
          uucmsNo: row['UUCMS No'] ? String(row['UUCMS No']).trim() : '',
          year: row['Year'] ? String(row['Year']).trim() : '',
        })).filter(s => s.fullName || s.uucmsNo || s.year);

        if (parsedStudents.length === 0) {
          throw new Error('No valid student data found. Please use the template.');
        }

        const token = await getAuth().currentUser?.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/admin/students/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ students: parsedStudents })
        });

        const result = await res.json();
        if (!res.ok || !result.success) {
          if (result.errors && Array.isArray(result.errors)) {
            throw new Error(`Excel validation failed:\n${result.errors.join('\n')}`);
          }
          throw new Error(result.message || 'Failed to import students');
        }

        setToastMsg(`Import complete. Successfully authorized ${result.results?.added || 0} students.`);
        setShowImportModal(false);
      } catch (err: any) {
        setErrorMsg(err.message || 'Error processing file');
      } finally {
        setAddLoading(false);
        // Reset file input
        if (e.target) e.target.value = '';
      }
    };
    reader.onerror = () => {
      setErrorMsg('Error reading file');
      setAddLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = 
      s.uucmsNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.fullName || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'Archived') {
      return s.status === 'graduated' && matchesSearch;
    }
    return s.year === activeTab && s.status === 'active' && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toastMsg && (
        <ToastNotification
          message={toastMsg}
          type="success"
          onClose={() => setToastMsg(null)}
        />
      )}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">STUDENTS</h1>
          <p className="text-sm text-slate-500 mt-1">Manage students authorized to register for AptiGuard.</p>
        </div>
        <div className="flex space-x-3">
          {activeTab === 'Archived' ? (
            <button 
              onClick={() => setShowUnarchiveAllModal(true)}
              disabled={filteredStudents.length === 0}
              className="px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-semibold transition-colors flex items-center disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Unarchive All
            </button>
          ) : (
            <button 
              onClick={() => setShowArchiveAllModal(true)}
              disabled={filteredStudents.length === 0}
              className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-semibold transition-colors flex items-center disabled:opacity-50"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive All {activeTab}
            </button>
          )}
          {activeTab === '1st Year' && (
            <button 
              onClick={() => setShowPromoteModal(true)}
              className="px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-sm font-semibold transition-colors flex items-center"
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Promote to 2nd Year
            </button>
          )}
          <button 
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-semibold transition-colors flex items-center"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Excel
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#0952cc] text-white hover:bg-[#0747b3] rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Student
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="flex px-4 pt-4">
            <button
              onClick={() => setActiveTab('1st Year')}
              className={`pb-4 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === '1st Year' ? 'border-[#0952cc] text-[#0952cc]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              1st Year
            </button>
            <button
              onClick={() => setActiveTab('2nd Year')}
              className={`pb-4 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === '2nd Year' ? 'border-[#0952cc] text-[#0952cc]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              2nd Year
            </button>
            <button
              onClick={() => setActiveTab('Archived')}
              className={`pb-4 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'Archived' ? 'border-[#0952cc] text-[#0952cc]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Archived
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name or UUCMS No..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0952cc]/20 focus:border-[#0952cc] transition-all"
            />
          </div>
          <div className="text-sm text-slate-500 font-medium">
            <span className="text-slate-900">{filteredStudents.length}</span> students found
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Full Name</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">UUCMS No.</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Year</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Registration Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Student Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">Loading students...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">No active students found for this year.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{student.fullName || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm text-slate-600">{student.uucmsNo}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                        {student.year}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {student.registered ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          Registered
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                          Not Registered
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {student.status === 'graduated' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200/60">
                          Graduated
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {student.status === 'graduated' ? (
                        <button 
                          onClick={() => handleUnarchiveStudent(student.uucmsNo)}
                          className="text-slate-400 hover:text-amber-600 transition-colors" 
                          title="Unarchive Student"
                        >
                          <RotateCcw className="w-4 h-4 inline" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleArchiveStudent(student.uucmsNo)}
                          className="text-slate-400 hover:text-red-600 transition-colors" 
                          title="Archive Student"
                        >
                          <Archive className="w-4 h-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add Authorized Student</h3>
            </div>
            <form onSubmit={handleAddStudent} className="p-6">
              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Enter student full name"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0952cc]/20 focus:border-[#0952cc]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">UUCMS Number</label>
                  <input
                    type="text"
                    required
                    value={newUucms}
                    onChange={(e) => setNewUucms(e.target.value)}
                    placeholder="Enter unique UUCMS"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0952cc]/20 focus:border-[#0952cc]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Year</label>
                  <select
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0952cc]/20 focus:border-[#0952cc]"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                  </select>
                </div>
              </div>
              <div className="mt-8 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={addLoading} className="px-4 py-2 bg-[#0952cc] text-white text-sm font-semibold rounded-lg hover:bg-[#0747b3] disabled:opacity-50">
                  {addLoading ? 'Adding...' : 'Add Student'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Promote Students Modal */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Are you sure want to promote them?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will update the academic year of all active 1st Year students to 2nd Year. Historical test assignments will remain unchanged.
            </p>
            <div className="flex justify-center space-x-3">
              <button onClick={() => setShowPromoteModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handlePromote} disabled={addLoading} className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {addLoading ? 'Promoting...' : 'Promote Students'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Import Excel File</h3>
              <button onClick={handleDownloadTemplate} className="text-[#0952cc] hover:text-[#0747b3] text-sm font-semibold flex items-center">
                <Download className="w-4 h-4 mr-1" />
                Template
              </button>
            </div>
            <div className="p-6">
              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <p className="text-sm text-slate-500 mb-6">
                Upload an Excel file containing exactly "Full Name", "UUCMS No", and "Year" columns. Valid year values are "1st Year" or "2nd Year".
              </p>
              
              <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700 mb-1">Click to upload Excel file</p>
                <p className="text-xs text-slate-500">.xlsx, .xls</p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={addLoading}
                />
              </div>

              <div className="mt-8 flex justify-end space-x-3">
                <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && studentToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Archive className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Archive Student?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to archive student <span className="font-bold text-slate-700">{studentToArchive}</span>? They will be removed from the active list and can no longer register or take tests.
            </p>
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => { setShowArchiveModal(false); setStudentToArchive(null); }} 
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                disabled={addLoading}
              >
                Cancel
              </button>
              <button 
                onClick={confirmArchiveStudent} 
                disabled={addLoading} 
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {addLoading ? 'Archiving...' : 'Archive Student'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Archive All Confirmation Modal */}
      {showArchiveAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Archive className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Archive All {activeTab} Students?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to archive <span className="font-bold text-slate-700">{filteredStudents.length}</span> active students in {activeTab}? They will be removed from the active list and can no longer register or take tests.
            </p>
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => setShowArchiveAllModal(false)} 
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                disabled={addLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleArchiveAll} 
                disabled={addLoading || filteredStudents.length === 0} 
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {addLoading ? 'Archiving...' : 'Archive All'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Unarchive Confirmation Modal */}
      {showUnarchiveModal && studentToUnarchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Unarchive Student?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to unarchive student <span className="font-bold text-slate-700">{studentToUnarchive}</span>? They will be restored to the active list.
            </p>
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => { setShowUnarchiveModal(false); setStudentToUnarchive(null); }} 
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                disabled={addLoading}
              >
                Cancel
              </button>
              <button 
                onClick={confirmUnarchiveStudent} 
                disabled={addLoading} 
                className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {addLoading ? 'Unarchiving...' : 'Unarchive Student'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Unarchive All Confirmation Modal */}
      {showUnarchiveAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Unarchive All Students?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to unarchive all <span className="font-bold text-slate-700">{filteredStudents.length}</span> students currently in the archive? They will be restored to their respective active lists.
            </p>
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => setShowUnarchiveAllModal(false)} 
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                disabled={addLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleUnarchiveAll} 
                disabled={addLoading || filteredStudents.length === 0} 
                className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {addLoading ? 'Unarchiving...' : 'Unarchive All'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
