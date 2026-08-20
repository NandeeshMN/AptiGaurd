import { Router, Request, Response } from 'express';
import { adminDb } from '../config/firebase';

const router = Router();

// Middleware to verify if user is admin (Assuming req.user is set elsewhere or we just use basic validation for now)
// We will rely on a frontend token for now, or assume the routes are protected if we implement a token verification middleware.
// For now, let's just implement the logic. In a real app, you'd verify a Firebase ID token here.

/**
 * POST /api/admin/students/add
 * Manually add an authorized student UUCMS
 */
router.post('/students/add', async (req: Request, res: Response): Promise<void> => {
  const { fullName, uucmsNo, year } = req.body;

  if (!fullName || !uucmsNo || !year) {
    res.status(400).json({ success: false, message: 'Full Name, UUCMS Number, and Year are required.' });
    return;
  }

  const sanitizedFullName = String(fullName).trim();
  const sanitizedUucmsNo = String(uucmsNo).trim();
  
  if (!adminDb) {
    res.status(500).json({ success: false, message: 'Database not initialized.' });
    return;
  }

  try {
    const docRef = adminDb.collection('authorizedStudents').doc(sanitizedUucmsNo);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      res.status(400).json({ success: false, message: 'This UUCMS number is already registered.' });
      return;
    }

    await docRef.set({
      fullName: sanitizedFullName,
      uucmsNo: sanitizedUucmsNo,
      year: year,
      status: 'active',
      registered: false,
      uid: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({ success: true, message: 'Student added successfully.' });
  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/admin/students
 * Get all authorized students
 */
router.get('/students', async (req: Request, res: Response): Promise<void> => {
  if (!adminDb) {
    res.status(500).json({ success: false, message: 'Database not initialized.' });
    return;
  }

  try {
    const snapshot = await adminDb.collection('authorizedStudents').get();
    const students: any[] = [];
    snapshot.forEach(doc => {
      students.push({ id: doc.id, ...doc.data() });
    });
    res.json({ success: true, students });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/students/import', async (req: Request, res: Response): Promise<void> => {
  const { students } = req.body; // Expects an array of { fullName, uucmsNo, year }

  if (!Array.isArray(students) || students.length === 0) {
    res.status(400).json({ success: false, message: 'Valid students array is required.' });
    return;
  }

  if (!adminDb) {
    res.status(500).json({ success: false, message: 'Database not initialized.' });
    return;
  }

  try {
    const errors: string[] = [];
    const seenUucms = new Set<string>();

    students.forEach((student, index) => {
      const rowNum = index + 2; // Row 1 is header
      const name = student.fullName ? String(student.fullName).trim() : '';
      const uucms = student.uucmsNo ? String(student.uucmsNo).trim() : '';
      const yr = student.year ? String(student.year).trim() : '';

      if (!name) {
        errors.push(`Row ${rowNum}: "Full Name" is empty.`);
      }
      if (!uucms) {
        errors.push(`Row ${rowNum}: "UUCMS No" is empty.`);
      }
      if (!yr) {
        errors.push(`Row ${rowNum}: "Year" is empty.`);
      } else if (yr !== '1st Year' && yr !== '2nd Year') {
        errors.push(`Row ${rowNum}: Invalid Year value "${yr}". Must be "1st Year" or "2nd Year".`);
      }

      if (uucms) {
        if (seenUucms.has(uucms)) {
          errors.push(`Row ${rowNum}: Duplicate UUCMS number "${uucms}".`);
        }
        seenUucms.add(uucms);
      }
    });

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: 'Excel validation failed.', errors });
      return;
    }

    const batch = adminDb.batch();
    let addedCount = 0;

    for (const student of students) {
      const sanitizedName = String(student.fullName).trim();
      const sanitizedUucms = String(student.uucmsNo).trim();
      const sanitizedYear = String(student.year).trim();

      const docRef = adminDb.collection('authorizedStudents').doc(sanitizedUucms);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const existingData = docSnap.data() || {};
        batch.set(docRef, {
          ...existingData,
          fullName: sanitizedName,
          uucmsNo: sanitizedUucms,
          year: sanitizedYear,
          status: existingData.status || 'active',
          registered: existingData.registered !== undefined ? existingData.registered : false,
          uid: existingData.uid !== undefined ? existingData.uid : null,
          updatedAt: new Date(),
        });
      } else {
        batch.set(docRef, {
          fullName: sanitizedName,
          uucmsNo: sanitizedUucms,
          year: sanitizedYear,
          status: 'active',
          registered: false,
          uid: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      addedCount++;
    }

    await batch.commit();

    res.json({ 
      success: true, 
      message: `Import completed. Successfully authorized ${addedCount} students.`, 
      results: {
        added: addedCount
      }
    });
  } catch (error) {
    console.error('Error importing students:', error);
    res.status(500).json({ success: false, message: 'Internal server error while importing.' });
  }
});

/**
 * POST /api/admin/students/promote
 * Promote 1st Year to 2nd Year
 */
router.post('/students/promote', async (req: Request, res: Response): Promise<void> => {
  if (!adminDb) {
    res.status(500).json({ success: false, message: 'Database not initialized.' });
    return;
  }

  try {
    const authStudentsRef = adminDb.collection('authorizedStudents');
    const snapshot = await authStudentsRef.where('year', '==', '1st Year').where('status', '==', 'active').get();
    
    if (snapshot.empty) {
      res.json({ success: true, message: 'No 1st Year students found to promote.' });
      return;
    }

    const batch = adminDb.batch();
    
    // Track users to update as well
    const usersToUpdate: string[] = [];
    
    snapshot.forEach(doc => {
      batch.update(doc.ref, { year: '2nd Year', updatedAt: new Date() });
      const data = doc.data();
      if (data.registered && data.uid) {
        usersToUpdate.push(data.uid);
      }
    });
    
    // Also update users collection for these students
    for (const uid of usersToUpdate) {
      const userRef = adminDb.collection('users').doc(uid);
      batch.update(userRef, { year: '2nd Year', updatedAt: new Date() });
    }

    await batch.commit();

    res.json({ success: true, message: `Successfully promoted ${snapshot.size} students.` });
  } catch (error) {
    console.error('Error promoting students:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/admin/students/archive
 * Archive specific students
 */
router.post('/students/archive', async (req: Request, res: Response): Promise<void> => {
  const { uucmsNumbers } = req.body;

  if (!Array.isArray(uucmsNumbers) || uucmsNumbers.length === 0) {
    res.status(400).json({ success: false, message: 'An array of UUCMS numbers is required.' });
    return;
  }

  if (!adminDb) {
    res.status(500).json({ success: false, message: 'Database not initialized.' });
    return;
  }

  try {
    const batch = adminDb.batch();
    
    for (const uucms of uucmsNumbers) {
      const sanitized = String(uucms).trim();
      const docRef = adminDb.collection('authorizedStudents').doc(sanitized);
      batch.update(docRef, { status: 'graduated', updatedAt: new Date() });
      
      // Also update the users collection if the student is registered
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data && data.registered && data.uid) {
          const userRef = adminDb.collection('users').doc(data.uid);
          batch.update(userRef, { status: 'graduated', updatedAt: new Date() });
        }
      }
    }

    await batch.commit();

    res.json({ success: true, message: `Archived ${uucmsNumbers.length} students.` });
  } catch (error) {
    console.error('Error archiving students:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/admin/students/unarchive
 * Unarchive specific students
 */
router.post('/students/unarchive', async (req: Request, res: Response): Promise<void> => {
  const { uucmsNumbers } = req.body;

  if (!Array.isArray(uucmsNumbers) || uucmsNumbers.length === 0) {
    res.status(400).json({ success: false, message: 'An array of UUCMS numbers is required.' });
    return;
  }

  if (!adminDb) {
    res.status(500).json({ success: false, message: 'Database not initialized.' });
    return;
  }

  try {
    const batch = adminDb.batch();
    
    for (const uucms of uucmsNumbers) {
      const sanitized = String(uucms).trim();
      const docRef = adminDb.collection('authorizedStudents').doc(sanitized);
      batch.update(docRef, { status: 'active', updatedAt: new Date() });
      
      // Also update the users collection if the student is registered
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data && data.registered && data.uid) {
          const userRef = adminDb.collection('users').doc(data.uid);
          batch.update(userRef, { status: 'active', updatedAt: new Date() });
        }
      }
    }

    await batch.commit();

    res.json({ success: true, message: `Unarchived ${uucmsNumbers.length} students.` });
  } catch (error) {
    console.error('Error unarchiving students:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
