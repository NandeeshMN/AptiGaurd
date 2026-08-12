import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateEmail } from 'firebase/auth';
import { db } from '../config/firebase';
import { User, Mail, Phone, Edit3, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ProfileViewProps {
  isAdmin?: boolean;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ isAdmin = false }) => {
  const { currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  
  // Field states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch user profile document from Firestore
  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser) return;
      try {
        setLoadingProfile(true);
        // Default from auth
        setFullName(currentUser.displayName || '');
        setEmail(currentUser.email || '');
        
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.fullName) setFullName(data.fullName);
          if (data.name && !data.fullName) setFullName(data.name);
          if (data.email) setEmail(data.email);
          if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
          if (data.role) setUserRole(data.role);
        }
      } catch (err) {
        console.error('Error fetching profile from Firestore:', err);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [currentUser]);

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200/80 shadow-xs min-h-[300px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0952cc] mx-auto"></div>
          <p className="text-xs text-slate-500 font-semibold">Loading your profile information...</p>
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation checks
    if (!fullName.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('A valid email address is required.');
      return;
    }

    // Phone validation supporting Indian formatting +91XXXXXXXXXX
    const cleanPhone = phoneNumber.trim();
    if (cleanPhone) {
      const indianPhoneRegex = /^(?:\+91|91)?[6-9]\d{9}$/;
      if (!indianPhoneRegex.test(cleanPhone.replace(/\s+/g, ''))) {
        setErrorMsg('Please enter a valid phone number (e.g. +91XXXXXXXXXX or 10-digit mobile).');
        return;
      }
    }

    try {
      setSaving(true);

      // 1. If student changed email, update Firebase auth credentials first (handles security triggers)
      if (email.toLowerCase() !== currentUser.email?.toLowerCase()) {
        try {
          await updateEmail(currentUser, email);
        } catch (authErr: any) {
          if (authErr.code === 'auth/requires-recent-login') {
            throw new Error('This action requires recent authentication. Please log out and log back in to change your email.');
          }
          throw authErr;
        }
      }

      // 2. Update Firestore user document
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: cleanPhone,
        updatedAt: serverTimestamp()
      });

      setSuccessMsg('Profile updated successfully.');
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to save profile changes:', err);
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setErrorMsg(null);
    setIsEditing(false);
    // Reset inputs to values from user profile
    setFullName(currentUser?.displayName || '');
    setEmail(currentUser?.email || '');
    // Refetch values from DB
    const resetFields = async () => {
      if (!currentUser) return;
      const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.fullName) setFullName(data.fullName);
        if (data.email) setEmail(data.email);
        if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
      }
    };
    resetFields();
  };

  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'S';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Page Title */}
      <div>
        <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">My Profile</h2>
        <p className="text-xs text-slate-500 font-medium">Manage your personal information and account preferences.</p>
      </div>

      {/* Alert Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center space-x-3 text-emerald-800 text-xs font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center space-x-3 text-red-800 text-xs font-bold">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Profile Header section card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row items-center text-center sm:text-left gap-5">
        <div className="w-20 h-20 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-2xl font-black shadow-sm">
          {initials}
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-extrabold text-slate-900 leading-snug">{fullName}</h3>
          <p className="text-xs text-[#0952cc] font-bold uppercase tracking-wider">
            {isAdmin || userRole === 'admin' ? 'Admin Portal' : 'Student Portal'}
          </p>
          <p className="text-xs text-slate-500 font-medium">{email}</p>
        </div>
      </div>

      {/* Profile Detail Fields Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-[#031b4e] uppercase tracking-wide">Personal Information</h4>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-[#0952cc] hover:text-[#0747a6] text-xs font-bold flex items-center space-x-1.5 focus:outline-none"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 gap-5">
            {/* Full name field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Full Name</label>
              {isEditing ? (
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all font-semibold text-slate-800"
                  />
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-700 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{fullName}</p>
              )}
            </div>

            {/* Email field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Email Address</label>
              {isEditing ? (
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all font-semibold text-slate-800"
                  />
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-700 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{email}</p>
              )}
            </div>

            {/* Phone Number field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Phone Number</label>
              {isEditing ? (
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all font-semibold text-slate-800"
                  />
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-700 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{phoneNumber || 'Not provided'}</p>
              )}
            </div>
          </div>

          {/* Action buttons (only when editing) */}
          {isEditing && (
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors duration-200 focus:outline-none flex items-center space-x-1.5"
              >
                <X className="w-4.5 h-4.5" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors duration-250 focus:outline-none flex items-center space-x-1.5"
              >
                <Save className="w-4.5 h-4.5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

    </div>
  );
};
export default ProfileView;
