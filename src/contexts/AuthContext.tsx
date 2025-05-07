
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase'; // Import db from firebase
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword, // Import createUserWithEmailAndPassword
  type User as FirebaseUser // Rename to avoid conflict
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; // Firestore imports

type User = {
  email: string;
  role: 'admin' | 'user';
  uid: string; // Added UID
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@examguard.com'; // This specific constant is no longer used for role determination here

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setIsLoading(true);
      if (firebaseUser && firebaseUser.email) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let role: 'admin' | 'user' = 'user'; // Default role

        if (userDocSnap.exists()) {
          role = userDocSnap.data().role || 'user';
        } else {
          // New user (likely from createUserWithEmailAndPassword), determine role and create document
          role = firebaseUser.email.endsWith('@examguard.com') ? 'admin' : 'user';
          try {
            await setDoc(userDocRef, {
              email: firebaseUser.email,
              role: role,
              uid: firebaseUser.uid,
              createdAt: serverTimestamp(), 
            });
          } catch (error) {
            console.error("Error creating user document in Firestore:", error);
            toast({
              variant: "destructive",
              title: "Account Setup Error",
              description: "Could not save user details. Please try again.",
            });
            // Log out user if Firestore doc creation fails to prevent inconsistent state
            await signOut(auth); 
            setUser(null); // Ensure app state reflects logout
            setIsLoading(false);
            return;
          }
        }
        
        const appUser: User = { email: firebaseUser.email, role, uid: firebaseUser.uid };
        setUser(appUser);
        localStorage.setItem('authUser', JSON.stringify(appUser)); 

      } else {
        setUser(null);
        localStorage.removeItem('authUser');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]); 

  const login = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      // Try to sign in
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;

      if (firebaseUser && firebaseUser.email) {
         toast({
          title: 'Login Successful',
          description: `Welcome back, ${firebaseUser.email}!`,
        });
      }
    } catch (error: any) {
      // If user not found or wrong password or invalid credential, try to create a new user
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        try {
          const newUserCredential = await createUserWithEmailAndPassword(auth, email, pass);
          const newUser = newUserCredential.user;
           if (newUser && newUser.email) {
            // Role assignment and Firestore document creation are handled by onAuthStateChanged
            toast({
              title: 'Registration Successful',
              description: `Welcome, ${newUser.email}! Your account has been created.`,
            });
          }
        } catch (registrationError: any) {
          console.error("Firebase registration error:", registrationError);
          let regErrorMessage = "Registration failed. Please try again.";
          if (registrationError.code === 'auth/email-already-in-use') {
            regErrorMessage = "This email is already registered. Please try logging in with the correct password or contact support.";
          } else if (registrationError.code === 'auth/weak-password') {
            regErrorMessage = "Password is too weak. Please choose a stronger password (at least 6 characters).";
          }
          toast({ variant: 'destructive', title: 'Registration Failed', description: regErrorMessage });
        }
      } else {
        // Handle other login errors
        console.error("Firebase login error:", error);
        let errorMessage = "Login failed. Please try again later.";
        if (error.code === 'auth/too-many-requests') {
          errorMessage = "Too many login attempts. Please try again later.";
        }
         else if (error.code === 'auth/invalid-email') {
          errorMessage = "The email address is not valid.";
        }
        toast({ variant: 'destructive', title: 'Login Attempt Failed', description: errorMessage });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]); // router removed as redirection is handled by AuthGuard/LoginPage via onAuthStateChanged

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      // setUser(null) and localStorage removal will be handled by onAuthStateChanged
      router.push('/login'); 
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
    } catch (error) {
      console.error("Firebase logout error:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "Could not log you out. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [router, toast]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
