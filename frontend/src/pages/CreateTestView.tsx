import React, { useState, useEffect } from 'react';
import { ClipboardList, ArrowLeft, Edit, Trash, X, CheckCircle, FileText, Upload, Download, AlertTriangle, Search, Calendar, UserCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { formatTimeTo12Hour } from '../utils/timeFormat';
import { useActionConfirmation } from '../context/ActionConfirmationContext';


interface Student {
  uid: string;
  fullName: string;
  email: string;
  year?: string;
}

interface Question {
  id: string;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  marks: number;
  negativeMarks: number;
  explanation?: string;
}

interface ParsedImport {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  marks: number;
  negativeMarks: number;
  explanation: string;
  status: 'valid' | 'error';
  errorMsg?: string;
}

interface CreateTestViewProps {
  onBack: (tab?: string, toastMsg?: string) => void;
  editTest?: any; // If provided, pre-populates the form for editing
}

export const CreateTestView: React.FC<CreateTestViewProps> = ({ onBack, editTest }) => {
  const { currentUser } = useAuth();
  const { showConfirmation } = useActionConfirmation();
  // Step State: 'details' | 'questions' | 'schedule' | 'review'
  const [step, setStep] = useState<'details' | 'questions' | 'schedule' | 'review'>('details');
  const [saving, setSaving] = useState(false);

  // Test Config state
  const [testTitle, setTestTitle] = useState('Quantitative Aptitude Assessment');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Quantitative Aptitude');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [duration, _setDuration] = useState('30');
  const [targetQuestions, setTargetQuestions] = useState('30');
  const [targetMarks, setTargetMarks] = useState('100');
  const [passingScore, setPassingScore] = useState('40');
  const [enableNegative, setEnableNegative] = useState(false);
  const [negativeMarks, setNegativeMarks] = useState('0.25');

  // Questions State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Question Form State
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [questionMarks, setQuestionMarks] = useState('2');
  const [questionNegativeMarks, setQuestionNegativeMarks] = useState('0');
  const [explanation, setExplanation] = useState('');

  // Delete confirm Modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Bulk Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedImport[]>([]);
  const [fileName, setFileName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [pendingImports, setPendingImports] = useState<Question[]>([]);

  // Schedule & Assign state
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [availabilityType, setAvailabilityType] = useState<'immediate' | 'later'>('later');
  const [assignmentType, setAssignmentType] = useState<'all' | '1st Year' | '2nd Year' | 'selected'>('all');
  
  // Student collection data state
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedStudentUids, setSelectedStudentUids] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Draft alert
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // Custom UI alert message state
  const [customErrorMsg, setCustomErrorMsg] = useState<string | null>(null);

  // Edit mode: track if we are editing an existing test
  const isEditMode = Boolean(editTest?.id);

  // Pre-populate form when editTest is provided
  useEffect(() => {
    if (!editTest?.id) return;
    setTestTitle(editTest.title || '');
    setDescription(editTest.description || '');
    setCategory(editTest.category || 'Quantitative Aptitude');
    setDifficulty(editTest.difficulty || 'Beginner');
    setTargetQuestions(editTest.targetQuestions ? String(editTest.targetQuestions) : '30');
    setTargetMarks(editTest.targetMarks ? String(editTest.targetMarks) : '100');
    setPassingScore(editTest.passingScore !== undefined ? String(editTest.passingScore) : '40');
    setEnableNegative(Boolean(editTest.enableNegative));
    setNegativeMarks(editTest.negativeMarks !== undefined ? String(editTest.negativeMarks) : '0.25');
    setStartDate(editTest.startDate || '');
    setStartTime(editTest.startTime || '');
    setEndDate(editTest.endDate || '');
    setEndTime(editTest.endTime || '');
    setAvailabilityType(editTest.availabilityType || 'later');
    setAssignmentType(editTest.assignmentType || 'all');
    // Fetch existing questions from Firestore sub-collection
    getDocs(collection(db, 'tests', editTest.id, 'questions'))
      .then((snap) => {
        const qs: Question[] = [];
        snap.forEach((d) => qs.push(d.data() as Question));
        setQuestions(qs);
      })
      .catch(() => {});
  }, [editTest?.id]);

  // Computed Values
  const totalQuestionsAdded = questions.length;
  const currentTotalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  // Get current local date in YYYY-MM-DD format dynamically
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayMinDate = getTodayString();

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTitle.trim()) {
      setCustomErrorMsg('Please enter a test title.');
      return;
    }
    setStep('questions');
  };

  const handleOpenAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionText('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setCorrectAnswer('A');
    setQuestionMarks('2');
    setQuestionNegativeMarks(enableNegative ? negativeMarks : '0');
    setExplanation('');
    setShowQuestionModal(true);
  };

  const handleOpenEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQuestionText(q.questionText);
    setOptionA(q.options.A);
    setOptionB(q.options.B);
    setOptionC(q.options.C);
    setOptionD(q.options.D);
    setCorrectAnswer(q.correctAnswer);
    setQuestionMarks(q.marks.toString());
    setQuestionNegativeMarks(q.negativeMarks.toString());
    setExplanation(q.explanation || '');
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionText.trim()) {
      setCustomErrorMsg('Please enter the question.');
      return;
    }
    if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
      setCustomErrorMsg('Please enter all four options.');
      return;
    }
    const marksNum = parseFloat(questionMarks);
    if (isNaN(marksNum) || marksNum <= 0) {
      setCustomErrorMsg('Marks must be greater than 0.');
      return;
    }
    const negNum = parseFloat(questionNegativeMarks);
    if (isNaN(negNum) || negNum < 0) {
      setCustomErrorMsg('Negative marks must be 0 or greater.');
      return;
    }

    const savedQuestion: Question = {
      id: editingQuestion ? editingQuestion.id : Date.now().toString(),
      questionText: questionText.trim(),
      options: {
        A: optionA.trim(),
        B: optionB.trim(),
        C: optionC.trim(),
        D: optionD.trim(),
      },
      correctAnswer,
      marks: marksNum,
      negativeMarks: enableNegative ? negNum : 0,
      explanation: explanation.trim(),
    };

    if (editingQuestion) {
      setQuestions(questions.map((q) => (q.id === editingQuestion.id ? savedQuestion : q)));
    } else {
      setQuestions([...questions, savedQuestion]);
    }

    setShowQuestionModal(false);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) {
      setQuestions(questions.filter((q) => q.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    }
  };

  const saveTestToFirestore = async (status: 'draft' | 'published') => {
    if (!testTitle.trim()) {
      setCustomErrorMsg('Please enter a test title.');
      return null;
    }
    try {
      setSaving(true);

      // Determine if updating an existing test or creating a new one
      const testId = isEditMode ? editTest.id : doc(collection(db, 'tests')).id;

      let derivedDurationMins = 30;
      if (startDate && startTime && endDate && endTime) {
        const startMs = new Date(`${startDate}T${startTime}`).getTime();
        const endMs = new Date(`${endDate}T${endTime}`).getTime();
        if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
          derivedDurationMins = Math.floor((endMs - startMs) / 60000);
        }
      }

      const testData: any = {
        title: testTitle.trim(),
        description: description.trim(),
        category,
        difficulty,
        duration: derivedDurationMins,
        targetQuestions: parseInt(targetQuestions) || 0,
        targetMarks: parseFloat(targetMarks) || 0,
        passingScore: parseFloat(passingScore) || 0,
        enableNegative,
        negativeMarks: enableNegative ? parseFloat(negativeMarks) || 0 : 0,
        availabilityType,
        startDate: startDate || '',
        startTime: startTime || '',
        endDate: endDate || '',
        endTime: endTime || '',
        assignmentType,
        status,
        updatedAt: serverTimestamp(),
      };

      if (isEditMode) {
        // Update existing test document
        await updateDoc(doc(db, 'tests', testId), testData);
      } else {
        // Create new test document
        testData.id = testId;
        testData.createdAt = serverTimestamp();
        testData.createdBy = currentUser?.uid || 'admin';
        await setDoc(doc(db, 'tests', testId), testData);
      }

      // Write all questions (overwrites existing ones with same id)
      for (const q of questions) {
        await setDoc(doc(db, 'tests', testId, 'questions', q.id), {
          id: q.id,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          explanation: q.explanation || ''
        });
      }

      if (assignmentType === 'selected') {
        for (const studentUid of selectedStudentUids) {
          const studentObj = allStudents.find(s => s.uid === studentUid);
          await setDoc(doc(db, 'tests', testId, 'assignedStudents', studentUid), {
            uid: studentUid,
            fullName: studentObj?.fullName || 'Unnamed Student',
            email: studentObj?.email || '',
            assignedAt: serverTimestamp()
          });
        }
      } else if (assignmentType === '1st Year' || assignmentType === '2nd Year') {
        const yearStudents = allStudents.filter(s => s.year === assignmentType);
        for (const student of yearStudents) {
          await setDoc(doc(db, 'tests', testId, 'assignedStudents', student.uid), {
            uid: student.uid,
            fullName: student.fullName,
            email: student.email,
            assignedAt: serverTimestamp()
          });
        }
      } else {
        for (const student of allStudents) {
          await setDoc(doc(db, 'tests', testId, 'assignedStudents', student.uid), {
            uid: student.uid,
            fullName: student.fullName,
            email: student.email,
            assignedAt: serverTimestamp()
          });
        }
      }

      return testId;
    } catch (err) {
      console.error('Error saving to Firestore:', err);
      setCustomErrorMsg('Firestore write failed. Ensure you are connected and rules allow writes.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsDraft = async () => {
    const testId = await saveTestToFirestore('draft');
    if (testId) {
      onBack('drafts', isEditMode ? 'Draft updated successfully' : 'Draft saved successfully');
    }
  };

  const handleFinalSubmit = () => {
    if (questions.length === 0) {
      setCustomErrorMsg('Please add at least one question before continuing.');
      return;
    }
    setStep('schedule');
  };

  // Load students collection query flow
  const loadStudentsFromDb = async () => {
    setLoadingStudents(true);
    try {
      const querySnap = await getDocs(collection(db, 'users'));
      const studentList: Student[] = [];
      querySnap.forEach((docSnap) => {
        const data = docSnap.data();
        // Assuming status !== 'archived' means they are active students
        if (data.role === 'student' && data.status !== 'archived' && data.status !== 'graduated') {
          studentList.push({
            uid: docSnap.id,
            fullName: data.fullName || 'Unnamed Student',
            email: data.email || '',
            year: data.year || '1st Year',
          });
        }
      });
      setAllStudents(studentList);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  React.useEffect(() => {
    if (step === 'schedule' && allStudents.length === 0) {
      loadStudentsFromDb();
    }
  }, [step]);

  // Download Templates handlers
  const handleDownloadCSVTemplate = () => {
    const headers = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Marks', 'Negative Marks', 'Explanation'];
    const row1 = ['What is 25% of 200?', '25', '40', '50', '75', 'C', '2', '0', '25% of 200 is 50'];
    const row2 = ['Solve: 5x = 25', '3', '5', '10', '15', 'B', '2', '0.5', 'Divide both sides by 5'];
    const content = [headers, row1, row2].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'AptiGuard_Questions_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcelTemplate = () => {
    const data = [
      {
        'Question': 'What is 25% of 200?',
        'Option A': '25',
        'Option B': '40',
        'Option C': '50',
        'Option D': '75',
        'Correct Answer': 'C',
        'Marks': 2,
        'Negative Marks': 0,
        'Explanation': '25% of 200 is 50'
      },
      {
        'Question': 'Solve: 5x = 25',
        'Option A': '3',
        'Option B': '5',
        'Option C': '10',
        'Option D': '15',
        'Correct Answer': 'B',
        'Marks': 2,
        'Negative Marks': 0.5,
        'Explanation': 'Divide both sides by 5'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.writeFile(wb, 'AptiGuard_Questions_Template.xlsx');
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const name = file.name;
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'csv') {
      setImportError('Please upload an Excel (.xlsx) or CSV (.csv) file.');
      return;
    }
    setFileName(name);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let workbook;
        if (ext === 'xlsx') {
          workbook = XLSX.read(data, { type: 'binary' });
        } else {
          workbook = XLSX.read(data, { type: 'string' });
        }
        const wsName = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawJson.length === 0) {
          setImportError('No questions were found in this file.');
          return;
        }

        // Parse & Validate Rows
        const parsed: ParsedImport[] = rawJson.map((row) => {
          const qText = (row['Question'] || '').toString().trim();
          const optA = (row['Option A'] || '').toString().trim();
          const optB = (row['Option B'] || '').toString().trim();
          const optC = (row['Option C'] || '').toString().trim();
          const optD = (row['Option D'] || '').toString().trim();
          const ans = (row['Correct Answer'] || '').toString().trim().toUpperCase();
          const marksNum = parseFloat(row['Marks']);
          const negNum = parseFloat(row['Negative Marks'] || '0');
          const expl = (row['Explanation'] || '').toString().trim();

          let status: 'valid' | 'error' = 'valid';
          let errorMsg = '';

          if (!qText) {
            status = 'error';
            errorMsg = 'Question is empty';
          } else if (!optA || !optB || !optC || !optD) {
            status = 'error';
            errorMsg = 'One or more Options (A, B, C, D) are missing';
          } else if (!['A', 'B', 'C', 'D'].includes(ans)) {
            status = 'error';
            errorMsg = 'Correct Answer must be A, B, C, or D';
          } else if (isNaN(marksNum) || marksNum <= 0) {
            status = 'error';
            errorMsg = 'Marks must be greater than 0';
          } else if (isNaN(negNum) || negNum < 0) {
            status = 'error';
            errorMsg = 'Negative marks cannot be negative';
          }

          return {
            questionText: qText,
            optionA: optA,
            optionB: optB,
            optionC: optC,
            optionD: optD,
            correctAnswer: ans,
            marks: marksNum,
            negativeMarks: enableNegative ? negNum : 0,
            explanation: expl,
            status,
            errorMsg
          };
        });

        setParsedRows(parsed);

        // Prepare Questions if valid
        const errors = parsed.filter(p => p.status === 'error');
        if (errors.length === 0) {
          let duplicateCount = 0;
          const importsList: Question[] = parsed.map((p, idx) => {
            const normalizedText = p.questionText.toLowerCase().replace(/\s+/g, '');
            const isDup = questions.some(q => q.questionText.toLowerCase().replace(/\s+/g, '') === normalizedText);
            if (isDup) duplicateCount++;

            return {
              id: (Date.now() + idx).toString(),
              questionText: p.questionText,
              options: {
                A: p.optionA,
                B: p.optionB,
                C: p.optionC,
                D: p.optionD,
              },
              correctAnswer: p.correctAnswer as 'A' | 'B' | 'C' | 'D',
              marks: p.marks,
              negativeMarks: p.negativeMarks,
              explanation: p.explanation,
            };
          });

          setPendingImports(importsList);
          if (duplicateCount > 0) {
            setDuplicateWarning(`${duplicateCount} possible duplicate questions detected.`);
          } else {
            setDuplicateWarning(null);
          }
        } else {
          setPendingImports([]);
          setDuplicateWarning(null);
        }

      } catch (err) {
        setImportError('Unable to read this file. Ensure columns match template.');
      }
    };

    if (ext === 'xlsx') {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleConfirmImport = () => {
    if (pendingImports.length === 0) return;
    setQuestions([...questions, ...pendingImports]);
    setShowImportModal(false);
    setParsedRows([]);
    setPendingImports([]);
    setFileName('');
    setAlertMsg(`${pendingImports.length} questions imported successfully.`);
    setTimeout(() => setAlertMsg(null), 3000);
  };

  // Start Date change validation: clear End Date if it is now earlier
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate && val > endDate) {
      setEndDate('');
    }
  };

  // Submit step 3 schedule & assign validation checks
  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate) {
      setCustomErrorMsg('Please select a start date.');
      return;
    }
    if (startDate < todayMinDate) {
      setCustomErrorMsg('Start date cannot be before today.');
      return;
    }
    if (!startTime) {
      setCustomErrorMsg('Please select a start time.');
      return;
    }
    if (!endDate) {
      setCustomErrorMsg('Please select an end date.');
      return;
    }
    if (endDate < startDate) {
      setCustomErrorMsg('End date cannot be before the start date.');
      return;
    }
    if (!endTime) {
      setCustomErrorMsg('Please select an end time.');
      return;
    }

    // Check current past time validator
    const now = new Date();
    const schedStart = new Date(`${startDate}T${startTime}`);
    const schedEnd = new Date(`${endDate}T${endTime}`);

    if (schedStart < now) {
      setCustomErrorMsg('Start date and time cannot be in the past.');
      return;
    }

    if (schedEnd <= schedStart) {
      setCustomErrorMsg('End time must be after the start time.');
      return;
    }

    if (assignmentType === 'selected' && selectedStudentUids.length === 0) {
      setCustomErrorMsg('Please select at least one student.');
      return;
    }

    // Proceed to review step
    setStep('review');
  };

  // Calculation for Schedule Summary Duration window
  const getScheduleDurationText = () => {
    if (!startDate || !startTime || !endDate || !endTime) return '';
    const startObj = new Date(`${startDate}T${startTime}`);
    const endObj = new Date(`${endDate}T${endTime}`);
    const diffMs = endObj.getTime() - startObj.getTime();
    if (isNaN(diffMs) || diffMs <= 0) return '';
    
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${mins > 0 ? `${mins} min${mins > 1 ? 's' : ''}` : ''}`;
    }
    return `${mins} min${mins > 1 ? 's' : ''}`;
  };

  const scheduleDurationText = getScheduleDurationText();

  // Search filtered student collection list
  const filteredStudents = allStudents.filter((student) => {
    const query = searchQuery.toLowerCase();
    return student.fullName.toLowerCase().includes(query) || student.email.toLowerCase().includes(query);
  });

  const handleToggleSelectStudent = (uid: string) => {
    if (selectedStudentUids.includes(uid)) {
      setSelectedStudentUids(selectedStudentUids.filter((id) => id !== uid));
    } else {
      setSelectedStudentUids([...selectedStudentUids, uid]);
    }
  };

  const handleSelectAllFiltered = () => {
    const filteredUids = filteredStudents.map((s) => s.uid);
    const allSelected = filteredUids.every((uid) => selectedStudentUids.includes(uid));
    
    if (allSelected) {
      // Deselect visible filtered students
      setSelectedStudentUids(selectedStudentUids.filter((uid) => !filteredUids.includes(uid)));
    } else {
      // Select all visible filtered students merging with already selected ones
      const uniqueUids = Array.from(new Set([...selectedStudentUids, ...filteredUids]));
      setSelectedStudentUids(uniqueUids);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 relative">
      
      {/* Step 1 - Details render */}
      {step === 'details' && (
        <form onSubmit={handleNextStep} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          {/* Top Header back navigation */}
          <div className="flex items-center space-x-3 mb-6">
            <button
              type="button"
              onClick={() => onBack()}
              className="p-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-500 shadow-sm focus:outline-none"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{isEditMode ? 'Edit Assessment' : 'Create New Test'}</h2>
              <p className="text-xs text-slate-500 font-medium">Step 1 — Test Details</p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between text-xs font-semibold text-slate-400 select-none">
            <div className="flex items-center space-x-2 text-[#0952cc]">
              <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[10px]">1</span>
              <span>Details</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px]">2</span>
              <span>Questions</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px]">3</span>
              <span>Schedule</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px]">4</span>
              <span>Review</span>
            </div>
          </div>

          <div className="border-b border-slate-100 pb-3 flex items-center space-x-2">
            <ClipboardList className="w-4.5 h-4.5 text-[#0952cc]" />
            <h3 className="text-xs font-extrabold text-[#031b4e] uppercase tracking-wide">Test Information</h3>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Test Title</label>
              <input
                type="text"
                required
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all font-semibold text-slate-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter test description..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all font-semibold text-slate-800 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 bg-white rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-850 cursor-pointer"
                >
                  <option value="Quantitative Aptitude">Quantitative Aptitude</option>
                  <option value="Logical Reasoning">Logical Reasoning</option>
                  <option value="Verbal Ability">Verbal Ability</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 bg-white rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-850 cursor-pointer"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Total Questions</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={targetQuestions}
                  onChange={(e) => setTargetQuestions(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-850"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Total Marks</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={targetMarks}
                  onChange={(e) => setTargetMarks(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-850"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Passing Score (%)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-850"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="enable-negative"
                  checked={enableNegative}
                  onChange={(e) => setEnableNegative(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0952cc] border-slate-300 focus:ring-[#0952cc]/20 cursor-pointer"
                />
                <label htmlFor="enable-negative" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Enable Negative Marking
                </label>
              </div>

              {enableNegative && (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(e.target.value)}
                    className="w-20 px-3 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-850 text-center"
                  />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    per incorrect answer
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onBack()}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors duration-200 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors duration-250 focus:outline-none"
            >
              Next: Add Questions &rarr;
            </button>
          </div>
        </form>
      )}

      {/* Step 2 - Questions render */}
      {step === 'questions' && (
        <div className="space-y-6">
          {/* Top Header back navigation */}
          <div className="flex items-center space-x-3 mb-6">
            <button
              type="button"
              onClick={() => setStep('details')}
              className="p-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-500 shadow-sm focus:outline-none"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{isEditMode ? 'Edit Assessment' : 'Create New Test'}</h2>
              <p className="text-xs text-slate-500 font-medium">Add questions to your assessment.</p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between text-xs font-semibold text-slate-400 select-none">
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-[10px]">✓</span>
              <span>Details</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2 text-[#0952cc]">
              <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[10px]">2</span>
              <span>Questions</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px]">3</span>
              <span>Schedule</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px]">4</span>
              <span>Review</span>
            </div>
          </div>

          {alertMsg && (
            <div className="p-4 bg-blue-50 border border-blue-100 text-[#0952cc] text-xs font-bold rounded-xl shadow-xs">
              {alertMsg}
            </div>
          )}

          {/* Compact Test Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 leading-tight">{testTitle}</h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#0952cc] border border-blue-100/60">{difficulty}</span>
                <span>&middot;</span>
                <span>{category}</span>
                <span>&middot;</span>
                <span>{duration} Minutes</span>
                <span>&middot;</span>
                <span>Passing Score: {passingScore}%</span>
              </div>
            </div>
            <div className="flex items-center space-x-6 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 w-full sm:w-auto">
              <div className="text-center sm:text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Questions Added</p>
                <p className="text-lg font-extrabold text-[#031b4e] mt-1">{totalQuestionsAdded} / {targetQuestions}</p>
              </div>
              <div className="text-center sm:text-right border-l border-slate-100 pl-6">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total Marks</p>
                <p className="text-lg font-extrabold text-[#031b4e] mt-1">{currentTotalMarks} / {targetMarks}</p>
              </div>
            </div>
          </div>

          {/* Main Question Catalog Area */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div>
                <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Questions</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Create and manage the questions for this assessment.</p>
              </div>
            </div>

            {/* Progress Alerts & Warnings */}
            {totalQuestionsAdded.toString() === targetQuestions && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-bold flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>All required questions ({targetQuestions}/{targetQuestions}) have been added.</span>
              </div>
            )}
            {totalQuestionsAdded > parseInt(targetQuestions) && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs font-bold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>You have added {totalQuestionsAdded} questions, while the target is {targetQuestions}.</span>
              </div>
            )}

            {/* Questions Catalog */}
            {questions.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">No questions added yet</h4>
                  <p className="text-[11px] text-slate-450 font-medium">Start building your assessment by adding your first question.</p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleOpenAddQuestion}
                    className="px-4 py-2 border border-[#0952cc] hover:bg-blue-50/50 text-[#0952cc] text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors focus:outline-none"
                  >
                    + Add Question
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors focus:outline-none"
                  >
                    Import Questions
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {questions.map((q, idx) => (
                  <div key={q.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-[#0952cc] bg-blue-50 border border-blue-100/60 px-1.5 py-0.5 rounded">
                          Question {idx + 1} &middot; {q.marks} Marks
                        </span>
                        <h5 className="text-xs font-bold text-slate-850 pt-1.5 leading-relaxed">{q.questionText}</h5>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditQuestion(q)}
                          className="p-1 rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-650"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(q.id)}
                          className="p-1 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-650"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Option grids */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 font-semibold pl-1">
                      <div className={`p-2 rounded-lg border ${q.correctAnswer === 'A' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50/50 border-slate-200/60'}`}>
                        A. {q.options.A} {q.correctAnswer === 'A' && '✓'}
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correctAnswer === 'B' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50/50 border-slate-200/60'}`}>
                        B. {q.options.B} {q.correctAnswer === 'B' && '✓'}
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correctAnswer === 'C' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50/50 border-slate-200/60'}`}>
                        C. {q.options.C} {q.correctAnswer === 'C' && '✓'}
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correctAnswer === 'D' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50/50 border-slate-200/60'}`}>
                        D. {q.options.D} {q.correctAnswer === 'D' && '✓'}
                      </div>
                    </div>

                    {q.explanation && (
                      <p className="text-[10px] text-slate-450 font-semibold bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="font-extrabold text-[#031b4e]">Explanation:</span> {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Render Add/Import Question buttons below the list if there are questions */}
            {questions.length > 0 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleOpenAddQuestion}
                  className="px-4 py-2 border border-[#0952cc] hover:bg-blue-50/50 text-[#0952cc] text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors focus:outline-none"
                >
                  + Add Question
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors focus:outline-none"
                >
                  Import Questions
                </button>
              </div>
            )}

            {/* Footer controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold rounded-lg uppercase tracking-wider text-center focus:outline-none transition-colors"
              >
                &larr; Back to Test Details
              </button>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSaveAsDraft}
                  className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg uppercase tracking-wider text-center focus:outline-none transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider text-center focus:outline-none transition-colors"
                >
                  Next: Schedule & Assign &rarr;
                </button>
              </div>
            </div>

          </div>

          {/* Add / Edit Question Modal Overlay */}
          {showQuestionModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
              <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200/80 p-6 shadow-xl relative my-8">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-650 focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>

                <form onSubmit={handleSaveQuestion} className="space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">
                      {editingQuestion ? 'Edit Question' : 'Add Question'}
                    </h3>
                  </div>

                  {/* Form Input fields */}
                  <div className="space-y-4 text-xs font-semibold">
                    
                    {/* QuestionText */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Question</label>
                      <textarea
                        required
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        placeholder="Enter your question here..."
                        rows={3}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all font-semibold text-slate-800 resize-none"
                      />
                    </div>

                    {/* Option A & B */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Option A</label>
                        <input
                          type="text"
                          required
                          value={optionA}
                          onChange={(e) => setOptionA(e.target.value)}
                          placeholder="Enter option A"
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all text-slate-800"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Option B</label>
                        <input
                          type="text"
                          required
                          value={optionB}
                          onChange={(e) => setOptionB(e.target.value)}
                          placeholder="Enter option B"
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Option C & D */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Option C</label>
                        <input
                          type="text"
                          required
                          value={optionC}
                          onChange={(e) => setOptionC(e.target.value)}
                          placeholder="Enter option C"
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all text-slate-800"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Option D</label>
                        <input
                          type="text"
                          required
                          value={optionD}
                          onChange={(e) => setOptionD(e.target.value)}
                          placeholder="Enter option D"
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Correct answer and Marks */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Correct Answer</label>
                        <select
                          value={correctAnswer}
                          onChange={(e) => setCorrectAnswer(e.target.value as 'A' | 'B' | 'C' | 'D')}
                          className="w-full px-4 py-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-850 cursor-pointer"
                        >
                          <option value="A">Option A</option>
                          <option value="B">Option B</option>
                          <option value="C">Option C</option>
                          <option value="D">Option D</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Marks</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={questionMarks}
                          onChange={(e) => setQuestionMarks(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Negative Marks</label>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          disabled={!enableNegative}
                          value={enableNegative ? questionNegativeMarks : '0'}
                          onChange={(e) => setQuestionNegativeMarks(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Explanation (Optional)</label>
                      <textarea
                        value={explanation}
                        onChange={(e) => setExplanation(e.target.value)}
                        placeholder="Add an explanation for this answer..."
                        rows={2}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all font-semibold text-slate-800 resize-none"
                      />
                    </div>

                  </div>

                  {/* CTAs */}
                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowQuestionModal(false)}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold rounded-lg uppercase tracking-wider focus:outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider focus:outline-none"
                    >
                      Save Question
                    </button>
                  </div>

                </form>
              </div>
            </div>
          )}

          {/* Delete Question Confirmation Dialog */}
          {deleteConfirmId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
              <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200/80 p-6 shadow-xl text-center space-y-5">
                <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto border border-red-100">
                  <Trash className="w-5 h-5" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-md font-bold text-slate-900">Delete Question?</h3>
                  <p className="text-xs text-slate-500 font-medium">Are you sure you want to delete this question?</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wider focus:outline-none transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg uppercase tracking-wider focus:outline-none transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Import Questions Overlay Modal */}
          {showImportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
              <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200/80 p-6 shadow-xl relative my-8 flex flex-col max-h-[85vh]">
                <button
                  type="button"
                  onClick={() => { setShowImportModal(false); setParsedRows([]); setFileName(''); setImportError(null); }}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-650 focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Import Questions</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Add multiple aptitude questions at once using an Excel or CSV file.</p>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-between text-left focus:outline-none"
                    >
                      <div>
                        <h5 className="text-[11px] font-bold text-slate-800">Excel Template</h5>
                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5">AptiGuard_Questions_Template.xlsx</p>
                      </div>
                      <Download className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCSVTemplate}
                      className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-between text-left focus:outline-none"
                    >
                      <div>
                        <h5 className="text-[11px] font-bold text-slate-800">CSV Template</h5>
                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5">AptiGuard_Questions_Template.csv</p>
                      </div>
                      <Download className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  <label
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    htmlFor="import-file-input"
                    className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                      dragActive ? 'border-[#0952cc] bg-blue-50/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Upload className="w-8 h-8 text-slate-400" />
                    <div className="space-y-1 mt-1 text-xs pointer-events-none">
                      <p className="font-bold text-slate-700">Drag & drop your file here</p>
                      <p className="font-semibold text-slate-400">or</p>
                      <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg uppercase tracking-wide transition-colors">
                        Browse Files
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider mt-1 pointer-events-none">.xlsx and .csv supported</p>
                    <input
                      id="import-file-input"
                      type="file"
                      accept=".xlsx,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  {fileName && (
                    <div className="px-3 py-2 bg-slate-50 rounded-lg flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Selected: {fileName}</span>
                      <button type="button" onClick={() => { setFileName(''); setParsedRows([]); setPendingImports([]); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                  )}

                  {importError && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-750 text-xs font-bold rounded-xl flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-650 flex-shrink-0" />
                      <span>{importError}</span>
                    </div>
                  )}

                  {duplicateWarning && (
                    <div className="p-3 bg-amber-50 border border-amber-100 text-amber-750 text-xs font-bold rounded-xl flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-650 flex-shrink-0" />
                      <span>{duplicateWarning}</span>
                    </div>
                  )}

                  {parsedRows.length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[#031b4e] uppercase tracking-wide">Import Preview</span>
                        <span className="text-slate-500">
                          {parsedRows.length} found &middot; {parsedRows.filter(p => p.status === 'valid').length} valid &middot; {parsedRows.filter(p => p.status === 'error').length} errors
                        </span>
                      </div>
                      
                      <div className="border border-slate-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full text-left border-collapse text-[11px] font-semibold">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 font-extrabold text-slate-400 tracking-wider uppercase text-[9px]">
                              <th className="py-2 px-3">#</th>
                              <th className="py-2 px-3">Question</th>
                              <th className="py-2 px-3">Answer</th>
                              <th className="py-2 px-3">Marks</th>
                              <th className="py-2 px-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedRows.map((row, idx) => (
                              <tr key={idx} className={row.status === 'error' ? 'bg-red-50/20' : ''}>
                                <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3 text-slate-800 truncate max-w-[200px]" title={row.questionText}>{row.questionText}</td>
                                <td className="py-2 px-3 text-slate-550 font-bold">{row.correctAnswer}</td>
                                <td className="py-2 px-3 text-slate-900 font-bold">{row.marks}</td>
                                <td className={`py-2 px-3 text-right font-bold ${row.status === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {row.status === 'valid' ? '✓ Valid' : `✕ ${row.errorMsg}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 mt-4">
                  <button
                    type="button"
                    onClick={() => { setShowImportModal(false); setParsedRows([]); setFileName(''); setImportError(null); }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold rounded-lg uppercase tracking-wider focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={parsedRows.length === 0 || parsedRows.some(p => p.status === 'error')}
                    onClick={handleConfirmImport}
                    className="px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Import {pendingImports.length} Questions
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3 - Schedule & Assign render */}
      {step === 'schedule' && (
        <form onSubmit={handleScheduleSubmit} className="space-y-6">
          {/* Top Header back navigation */}
          <div className="flex items-center space-x-3 mb-6">
            <button
              type="button"
              onClick={() => setStep('questions')}
              className="p-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-500 shadow-sm focus:outline-none"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{isEditMode ? 'Edit Assessment' : 'Create New Test'}</h2>
              <p className="text-xs text-slate-500 font-medium">Schedule your assessment and assign it to students.</p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between text-xs font-semibold text-slate-400 select-none">
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-[10px]">✓</span>
              <span>Details</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-[10px]">✓</span>
              <span>Questions</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2 text-[#0952cc]">
              <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[10px]">3</span>
              <span>Schedule</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px]">4</span>
              <span>Review</span>
            </div>
          </div>

          {alertMsg && (
            <div className="p-4 bg-blue-50 border border-blue-100 text-[#0952cc] text-xs font-bold rounded-xl shadow-xs">
              {alertMsg}
            </div>
          )}

          {/* Test Schedule Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4.5 h-4.5 text-[#0952cc]" />
                <h3 className="text-xs font-extrabold text-[#031b4e] uppercase tracking-wide">Test Schedule</h3>
              </div>
              {scheduleDurationText && (
                <span className="text-[10px] font-bold bg-blue-50 text-[#0952cc] border border-blue-100 px-2 py-0.5 rounded uppercase tracking-wide">
                  Window Duration: {scheduleDurationText}
                </span>
              )}
            </div>

            {/* Availability type selector options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={`p-4 border rounded-xl flex items-start space-x-3 cursor-pointer transition-all ${
                availabilityType === 'immediate' ? 'border-[#0952cc] bg-blue-50/10' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="availability"
                  checked={availabilityType === 'immediate'}
                  onChange={() => {
                    setAvailabilityType('immediate');
                    const now = new Date();
                    const yyyy = now.getFullYear();
                    const mm = String(now.getMonth() + 1).padStart(2, '0');
                    const dd = String(now.getDate()).padStart(2, '0');
                    const currentHour = String(now.getHours()).padStart(2, '0');
                    const currentMin = String(now.getMinutes()).padStart(2, '0');
                    
                    setStartDate(`${yyyy}-${mm}-${dd}`);
                    setStartTime(`${currentHour}:${currentMin}`);
                  }}
                  className="mt-0.5 w-4.5 h-4.5 text-[#0952cc] focus:ring-[#0952cc]/20 cursor-pointer"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Publish Immediately</h4>
                  <p className="text-[10px] text-slate-450 font-medium mt-0.5">The test becomes active for students immediately upon publishing.</p>
                </div>
              </label>

              <label className={`p-4 border rounded-xl flex items-start space-x-3 cursor-pointer transition-all ${
                availabilityType === 'later' ? 'border-[#0952cc] bg-blue-50/10' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="availability"
                  checked={availabilityType === 'later'}
                  onChange={() => setAvailabilityType('later')}
                  className="mt-0.5 w-4.5 h-4.5 text-[#0952cc] focus:ring-[#0952cc]/20 cursor-pointer"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Schedule for Later</h4>
                  <p className="text-[10px] text-slate-450 font-medium mt-0.5">Specify precise calendar window limits during which the assessment is available.</p>
                </div>
              </label>
            </div>

            {/* Conditional Date / Time Pickers */}
            <div className="space-y-4 border-t border-slate-100 pt-4 text-xs font-semibold">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* Start Date & Time */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-[#031b4e] uppercase tracking-wider">Start Window</h4>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Start Date</label>
                      <input
                        type="date"
                        required
                        disabled={availabilityType === 'immediate'}
                        min={todayMinDate}
                        value={startDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-800 cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Start Time</label>
                      <input
                        type="time"
                        required
                        disabled={availabilityType === 'immediate'}
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-800 cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* End Date & Time */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-[#031b4e] uppercase tracking-wider">End Window</h4>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">End Date</label>
                      <input
                        type="date"
                        required
                        disabled={!startDate}
                        min={startDate || todayMinDate}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-800 cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">End Time</label>
                      <input
                        type="time"
                        required
                        disabled={!startDate}
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold text-slate-800 cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                </div>
              </div>
          </div>

          {/* Assign Students Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center space-x-2">
              <UserCheck className="w-4.5 h-4.5 text-[#0952cc]" />
              <h3 className="text-xs font-extrabold text-[#031b4e] uppercase tracking-wide">Assign Students</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={`p-4 border rounded-xl flex items-start space-x-3 cursor-pointer transition-all ${
                assignmentType === 'all' ? 'border-[#0952cc] bg-blue-50/10' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="assignment"
                  checked={assignmentType === 'all'}
                  onChange={() => setAssignmentType('all')}
                  className="mt-0.5 w-4.5 h-4.5 text-[#0952cc] focus:ring-[#0952cc]/20 cursor-pointer"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">All Students</h4>
                  <p className="text-[10px] text-slate-450 font-medium mt-0.5">Make assessment available to all registered student accounts on the portal.</p>
                </div>
              </label>

              <label className={`p-4 border rounded-xl flex items-start space-x-3 cursor-pointer transition-all ${
                assignmentType === '1st Year' ? 'border-[#0952cc] bg-blue-50/10' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="assignment"
                  checked={assignmentType === '1st Year'}
                  onChange={() => setAssignmentType('1st Year')}
                  className="mt-0.5 w-4.5 h-4.5 text-[#0952cc] focus:ring-[#0952cc]/20 cursor-pointer"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">1st Year Students</h4>
                  <p className="text-[10px] text-slate-450 font-medium mt-0.5">Automatically assign to all currently enrolled 1st Year students.</p>
                </div>
              </label>

              <label className={`p-4 border rounded-xl flex items-start space-x-3 cursor-pointer transition-all ${
                assignmentType === '2nd Year' ? 'border-[#0952cc] bg-blue-50/10' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="assignment"
                  checked={assignmentType === '2nd Year'}
                  onChange={() => setAssignmentType('2nd Year')}
                  className="mt-0.5 w-4.5 h-4.5 text-[#0952cc] focus:ring-[#0952cc]/20 cursor-pointer"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">2nd Year Students</h4>
                  <p className="text-[10px] text-slate-450 font-medium mt-0.5">Automatically assign to all currently enrolled 2nd Year students.</p>
                </div>
              </label>

              <label className={`p-4 border rounded-xl flex items-start space-x-3 cursor-pointer transition-all ${
                assignmentType === 'selected' ? 'border-[#0952cc] bg-blue-50/10' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="assignment"
                  checked={assignmentType === 'selected'}
                  onChange={() => setAssignmentType('selected')}
                  className="mt-0.5 w-4.5 h-4.5 text-[#0952cc] focus:ring-[#0952cc]/20 cursor-pointer"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Selected Students</h4>
                  <p className="text-[10px] text-slate-450 font-medium mt-0.5">Restrict assessment to visibility of specific selected student users.</p>
                </div>
              </label>
            </div>

            {/* Conditional selected student list with search */}
            {assignmentType === 'selected' && (
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by name or email"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 font-semibold"
                    />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right sm:text-left flex-shrink-0">
                    {selectedStudentUids.length} students selected
                  </div>
                </div>

                {loadingStudents ? (
                  <div className="text-center py-6 text-xs text-slate-450 font-medium">Loading student accounts...</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-450 font-medium">No students found matching your search.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 border-b border-slate-50 pb-2">
                      <input
                        type="checkbox"
                        id="select-all-filtered"
                        checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentUids.includes(s.uid))}
                        onChange={handleSelectAllFiltered}
                        className="w-4 h-4 rounded text-[#0952cc] border-slate-300 focus:ring-[#0952cc]/20 cursor-pointer"
                      />
                      <label htmlFor="select-all-filtered" className="text-[10px] font-bold text-slate-700 cursor-pointer select-none uppercase tracking-wider">
                        Select All Filtered Students
                      </label>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {filteredStudents.map((student) => (
                        <label
                          key={student.uid}
                          className={`flex items-center space-x-3 p-3 border rounded-xl cursor-pointer transition-all ${
                            selectedStudentUids.includes(student.uid) ? 'border-blue-100 bg-blue-50/20' : 'border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudentUids.includes(student.uid)}
                            onChange={() => handleToggleSelectStudent(student.uid)}
                            className="w-4.5 h-4.5 rounded text-[#0952cc] border-slate-350 focus:ring-[#0952cc]/20 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1 flex justify-between items-center">
                            <div>
                              <p className="text-xs font-bold text-slate-800 truncate">{student.fullName}</p>
                              <p className="text-[10px] text-slate-450 font-semibold truncate mt-0.5">{student.email}</p>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              {student.year || '1st Year'}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep('questions')}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold rounded-lg uppercase tracking-wider text-center focus:outline-none transition-colors"
            >
              &larr; Back to Questions
            </button>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveAsDraft}
                className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg uppercase tracking-wider text-center focus:outline-none transition-colors"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-initial px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider text-center focus:outline-none transition-colors"
              >
                Next: Review & Publish &rarr;
              </button>
            </div>
          </div>

        </form>
      )}

      {step === 'review' && (
        <div className="space-y-6">
          {/* Top Header back navigation */}
          <div className="flex items-center space-x-3 mb-6">
            <button
              type="button"
              onClick={() => setStep('schedule')}
              className="p-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-500 shadow-sm focus:outline-none"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{isEditMode ? 'Edit Assessment' : 'Create New Test'}</h2>
              <p className="text-xs text-slate-500 font-medium">Final Step — Review your assessment configuration before publishing.</p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between text-xs font-semibold text-slate-400 select-none">
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-[10px]">✓</span>
              <span>Details</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-[10px]">✓</span>
              <span>Questions</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-[10px]">✓</span>
              <span>Schedule</span>
            </div>
            <div className="h-px bg-slate-200 flex-1 mx-2"></div>
            <div className="flex items-center space-x-2 text-[#0952cc]">
              <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[10px]">4</span>
              <span>Review</span>
            </div>
          </div>

          {alertMsg && (
            <div className="p-4 bg-blue-50 border border-blue-100 text-[#0952cc] text-xs font-bold rounded-xl shadow-xs">
              {alertMsg}
            </div>
          )}

          {/* Review Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center space-x-2">
              <ClipboardList className="w-4.5 h-4.5 text-[#0952cc]" />
              <h3 className="text-xs font-extrabold text-[#031b4e] uppercase tracking-wide">Review Assessment</h3>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Test Title</span>
                  <span className="text-slate-800 font-bold">{testTitle || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Category & Difficulty</span>
                  <span className="text-slate-855">{category} &bull; {difficulty}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Description</span>
                <p className="text-slate-600 font-medium">{description || 'No description provided.'}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Duration</span>
                  <span className="text-slate-800 font-bold">{duration} Mins</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Total Questions</span>
                  <span className="text-slate-800 font-bold">{questions.length} / {targetQuestions}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Total Marks</span>
                  <span className="text-slate-800 font-bold">{currentTotalMarks} / {targetMarks}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Passing Score</span>
                  <span className="text-slate-800 font-bold">{passingScore}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Schedule Window</span>
                  <span className="text-slate-855">
                    {availabilityType === 'immediate' 
                      ? 'Immediate Access' 
                      : `From ${startDate} at ${formatTimeTo12Hour(startTime)} to ${endDate} at ${formatTimeTo12Hour(endTime)}`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Assignments</span>
                  <span className="text-slate-855">
                    {assignmentType === 'all' ? 'All Registered Students' : `${selectedStudentUids.length} Selected Students`}
                  </span>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('schedule')}
                disabled={saving}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold rounded-lg uppercase tracking-wider text-center focus:outline-none transition-colors disabled:opacity-50"
              >
                &larr; Back to Schedule
              </button>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSaveAsDraft}
                  disabled={saving}
                  className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg uppercase tracking-wider text-center focus:outline-none transition-colors disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // Save to Firestore directly with status 'published'
                    const testId = await saveTestToFirestore('published');
                    if (!testId) return;

                    // Trigger backend publish route asynchronously in background (non-blocking)
                    currentUser?.getIdToken().then((idToken) => {
                      if (idToken) {
                        fetch(`${import.meta.env.VITE_API_URL}/api/tests/${testId}/publish`, {
                          method: 'PATCH',
                          headers: {
                            'Authorization': `Bearer ${idToken}`
                          }
                        }).catch((apiErr) => console.warn('[PublishTest] Background notification API error:', apiErr));
                      }
                    }).catch(() => {});

                    // Show success confirmation popup
                    showConfirmation({ message: 'Test added successfully', type: 'success' });

                    // Success — navigate to Tests tab immediately
                    onBack('tests');
                  }}
                  disabled={saving}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider text-center focus:outline-none transition-colors disabled:opacity-50"
                >
                  {saving ? 'Publishing...' : 'Publish Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Error Modal Dialog */}
      {customErrorMsg && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200/80 p-6 shadow-xl text-center space-y-5">
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto border border-red-100">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="space-y-2">
              <h3 className="text-md font-bold text-slate-900 font-sans">Attention</h3>
              <p className="text-xs text-slate-500 font-medium font-sans leading-relaxed">{customErrorMsg}</p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setCustomErrorMsg(null)}
                className="w-full py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default CreateTestView;
