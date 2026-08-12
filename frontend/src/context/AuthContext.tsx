import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
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
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );
    const user = userCredential.user;

    // Update Firebase Auth displayName so currentUser.displayName is immediately populated
    try {
      await updateProfile(user, { displayName: data.fullName });
    } catch (e) {
      console.warn('Could not update Auth displayName:', e);
    }

    // Create a corresponding student document inside users/{uid} collection in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      name: data.fullName,
      fullName: data.fullName,
      email: data.email,
      role: 'student',
      status: 'Active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  // Expose login method
  const loginUser = async (data: LoginInput) => {
    await signInWithEmailAndPassword(auth, data.email, data.password);
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
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
