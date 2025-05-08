
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Added usePathname
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, // Ensure this is imported
  createUserWithEmailAndPassword,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

type User = {
  email: string;
  role: 'admin' | 'user';
  uid: string;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>; // Ensure logout is async and returns Promise<void>
  register: (email: string, pass: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setIsLoading(true);
      if (firebaseUser && firebaseUser.email) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let role: 'admin' | 'user' = 'user'; 

        if (userDocSnap.exists()) {
          role = userDocSnap.data().role || 'user';
        } else {
          // This block will be hit after createUserWithEmailAndPassword succeeds
          role = firebaseUser.email.endsWith('@examguard.com') ? 'admin' : 'user';
          try {
            await setDoc(userDocRef, {
              email: firebaseUser.email,
              role: role,
              uid: firebaseUser.uid,
              createdAt: serverTimestamp(), 
            });
            // Toast for successful Firestore doc creation (optional, can be redundant if register toasts)
            // toast({ title: 'Profile Created', description: 'Your user profile is set up.' });
          } catch (error) {
            console.error("Error creating user document in Firestore:", error);
            toast({
              variant: "destructive",
              title: "Account Setup Error",
              description: "Could not save user details. Please try again or contact support.",
            });
            await signOut(auth); 
            setUser(null); 
            setIsLoading(false);
            return;
          }
        }
        
        const appUser: User = { email: firebaseUser.email, role, uid: firebaseUser.uid };
        setUser(appUser);
        localStorage.setItem('authUser', JSON.stringify(appUser));
        
        // Redirect after user state is set
        const currentRedirect = new URLSearchParams(window.location.search).get('redirect');
        const defaultRedirect = role === 'admin' ? '/admin' : '/';
        // Only redirect if not on login/register page, or if on login/register and trying to access it again
        if (pathname !== '/login' && pathname !== '/register') {
             router.replace(currentRedirect || defaultRedirect);
        } else if (pathname === '/login' || pathname === '/register') {
             router.replace(defaultRedirect); // Redirect from login/register if already logged in
        }


      } else {
        setUser(null);
        localStorage.removeItem('authUser');
        // If user logs out or session expires, and they are not on login/register, redirect to login
        if (pathname !== '/login' && pathname !== '/register') {
          router.replace('/login');
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast, router, pathname]); 

  const login = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;

      if (firebaseUser && firebaseUser.email) {
         toast({
          title: 'Login Successful',
          description: `Welcome back!`, // Simpler welcome
        });
        // Redirection is handled by onAuthStateChanged's useEffect
      }
    } catch (error: any) {
      console.error("Firebase login error:", error);
      let errorMessage = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "Account not found. Please register or check your email.";
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Incorrect email or password. Please try again.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many login attempts. Please try again later.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
      }
      toast({ variant: 'destructive', title: 'Login Failed', description: errorMessage });
      throw error; // Re-throw to allow page-level error handling if needed
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const register = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const newUserCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser = newUserCredential.user;
      if (newUser && newUser.email) {
        // Firestore document creation and role assignment are handled by onAuthStateChanged
        toast({
          title: 'Registration Successful!',
          description: `Welcome! Your account has been created.`,
        });
        // Redirection is handled by onAuthStateChanged's useEffect
      }
    } catch (error: any) {
      console.error("Firebase registration error:", error);
      let regErrorMessage = "Registration failed. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        regErrorMessage = "This email is already registered. Please log in or use a different email.";
      } else if (error.code === 'auth/weak-password') {
        regErrorMessage = "Password is too weak. Please choose a stronger password (at least 6 characters).";
      } else if (error.code === 'auth/invalid-email') {
        regErrorMessage = "The email address is not valid.";
      }
      toast({ variant: 'destructive', title: 'Registration Failed', description: regErrorMessage });
      throw error; // Re-throw to allow page-level error handling
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      // setUser(null) and localStorage removal will be handled by onAuthStateChanged
      // router.push('/login') is also handled by onAuthStateChanged logic
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
  }, [toast]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}
