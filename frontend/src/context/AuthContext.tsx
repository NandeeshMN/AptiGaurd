import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { API_BASE_URL } from '../config/api';
import type { LoginInput, RegisterInput } from '../schemas/authSchemas';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setMockAdminUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Expose register method
  const registerUser = async (data: RegisterInput) => {
    // 1. Call secure backend registration endpoint
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Registration failed');
    }

    // 2. Automatically log the user in using Firebase Client Auth now that the account exists
    await signInWithEmailAndPassword(auth, data.email, data.password);
  };

  // Expose login method
  const loginUser = async (data: LoginInput) => {
    const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
    const user = userCredential.user;
    
    // Check if the user is graduated/archived by querying the canonical authorizedStudents collection
    const authQuery = query(collection(db, 'authorizedStudents'), where('uid', '==', user.uid));
    const authSnap = await getDocs(authQuery);
    
    if (!authSnap.empty) {
      const authData = authSnap.docs[0].data();
      if (authData.status === 'graduated') {
        await signOut(auth);
        throw new Error('You are no longer a user of this portal.');
      }
    }
  };

  // Expose logout method
  const logoutUser = async () => {
    await signOut(auth);
  };

  // Expose resetPassword method
  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Sync state with onAuthStateChanged listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const authQuery = query(collection(db, 'authorizedStudents'), where('uid', '==', user.uid));
          const authSnap = await getDocs(authQuery);
          if (!authSnap.empty && authSnap.docs[0].data().status === 'graduated') {
            await signOut(auth);
            setCurrentUser(null);
          } else {
            setCurrentUser(user);
          }
        } catch (error) {
          console.error("Error verifying user status:", error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const setMockAdminUser = () => {
    // Generate a mock user structure matching Firebase user type
    const mockUser = {
      uid: 'admin-mock-uid-12345',
      email: 'admin@aptiguard.com',
      displayName: 'System Admin',
      emailVerified: true,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => '',
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({}),
      phoneNumber: null,
      photoURL: null,
    } as unknown as FirebaseUser;
    setCurrentUser(mockUser);
  };

  const value = {
    currentUser,
    loading,
    login: loginUser,
    register: registerUser,
    logout: logoutUser,
    resetPassword,
    setMockAdminUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
