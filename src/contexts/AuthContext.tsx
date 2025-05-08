'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation'; 
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

type UserRole = 'admin' | 'user';

type User = {
  email: string;
  role: UserRole;
  uid: string;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string, loginAs?: UserRole) => Promise<{success: boolean, message?: string}>;
  logout: () => Promise<void>; 
  register: (email: string, pass: string, registerAs?: UserRole) => Promise<{success: boolean, message?: string}>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname(); 
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setIsLoading(true);
      if (firebaseUser && firebaseUser.email) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let role: UserRole = 'user'; 

        if (userDocSnap.exists()) {
          role = userDocSnap.data().role || 'user';
        } else {
          console.warn(`User document not found for ${firebaseUser.email} during onAuthStateChanged. This might indicate an incomplete registration or external auth event. Defaulting to 'user' and attempting to create document.`);
          try {
             // Attempt to create a user document if it's missing, default role to 'user'
            // This handles cases where a user might be authenticated but their Firestore doc wasn't created
            // (e.g., interrupted registration, or auth by other means).
            // The `registerAs` parameter in the `register` function is the primary way to set initial role.
            await setDoc(userDocRef, {
              email: firebaseUser.email,
              role: 'user', // Default to 'user' if role is unknown here
              uid: firebaseUser.uid,
              createdAt: serverTimestamp(), 
            });
             role = 'user'; // Ensure role is set after creation
          } catch (error) {
            console.error("Error creating default user document in Firestore during onAuthStateChanged:", error);
            // If doc creation fails critically, consider signing out the user to prevent inconsistent state
            // await signOut(auth); 
            // setUser(null);
            // setIsLoading(false);
            // return;
          }
        }
        
        const appUser: User = { email: firebaseUser.email, role, uid: firebaseUser.uid };
        setUser(appUser);
        localStorage.setItem('authUser', JSON.stringify(appUser));
        
        const currentRedirect = new URLSearchParams(window.location.search).get('redirect');
        
        if (role === 'admin') {
          if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/register') || pathname === '/login' || pathname === '/register') {
            router.replace(currentRedirect || '/admin');
          } else if (!pathname.startsWith('/admin')) {
            router.replace('/admin');
          }
        } else { 
          if (pathname === '/login' || pathname === '/register' || pathname.startsWith('/admin')) {
            router.replace(currentRedirect || '/');
          }
        }

      } else {
        setUser(null);
        localStorage.removeItem('authUser');
        if (pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/register') {
            router.replace('/admin/login');
        } else if (pathname !== '/' && pathname !== '/login' && pathname !== '/register' && !pathname.startsWith('/admin')) { 
            router.replace('/login');
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast, router, pathname]); 

  const login = useCallback(async (email: string, pass: string, loginAs?: UserRole): Promise<{success: boolean, message?: string}> => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;

      if (firebaseUser && firebaseUser.email) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        let userRole: UserRole = 'user'; 

        if(userDocSnap.exists()) {
            userRole = userDocSnap.data().role || 'user';
        } else { 
            toast({ variant: 'destructive', title: 'Login Failed', description: `Account data for ${email} is incomplete. Please try registering again or contact support.` });
            await signOut(auth); // Ensure user is signed out if their data is incomplete
            setIsLoading(false);
            return { success: false, message: `User document missing for ${email}.`};
        }

        if (loginAs && userRole !== loginAs) {
            await signOut(auth); // Sign out if trying to log into wrong portal
            const expectedPortal = loginAs === 'admin' ? 'Admin' : 'User';
            const actualPortal = userRole === 'admin' ? 'Admin' : 'User';
            toast({ variant: 'destructive', title: 'Login Failed', description: `This is a ${actualPortal} account. Please use the ${actualPortal} login portal.` });
            setIsLoading(false);
            return { success: false, message: `Incorrect portal: Expected ${expectedPortal}, got ${actualPortal}` };
        }
        
         toast({
          title: 'Login Successful',
          description: `Welcome back!`, 
        });
        // User state will be set by onAuthStateChanged, which also handles redirection
        setIsLoading(false);
        return { success: true };
      }
      // This case implies signInWithEmailAndPassword succeeded but firebaseUser or email was unexpectedly null.
      toast({ variant: 'destructive', title: 'Login Failed', description: 'An unexpected error occurred during login.' });
      setIsLoading(false);
      return { success: false, message: "Login failed due to unexpected user state after Firebase auth." };

    } catch (error: any) {
      console.error("Firebase login error (AuthContext):", error);
      let errorMessage = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect email or password. Please try again.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many login attempts. Please try again later.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
      }
      toast({ variant: 'destructive', title: 'Login Failed', description: errorMessage });
      setIsLoading(false);
      return { success: false, message: error.message || "Firebase authentication error" };
    }
  }, [toast]);

  const register = useCallback(async (email: string, pass: string, registerAs: UserRole = 'user'): Promise<{success: boolean, message?: string}> => {
    setIsLoading(true);
    try {
      const newUserCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser = newUserCredential.user;
      if (newUser && newUser.email) {
        const userDocRef = doc(db, "users", newUser.uid);
        await setDoc(userDocRef, {
          email: newUser.email,
          role: registerAs, 
          uid: newUser.uid,
          createdAt: serverTimestamp(),
        });
        
        toast({
          title: 'Registration Successful!',
          description: `Welcome! Your ${registerAs} account has been created.`,
        });
         // User state will be set by onAuthStateChanged, which also handles redirection
        setIsLoading(false);
        return { success: true };
      } else {
        // This case implies createUserWithEmailAndPassword succeeded but newUser or email was unexpectedly null.
        toast({ variant: 'destructive', title: 'Registration Failed', description: 'An unexpected error occurred during registration.'});
        setIsLoading(false);
        return { success: false, message: "User creation failed or email not available after Firebase auth."};
      }
    } catch (error: any) {
      console.error("Firebase registration error (AuthContext):", error);
      let regErrorMessage = "Registration failed. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        regErrorMessage = "This email is already registered. Please log in or use a different email.";
      } else if (error.code === 'auth/weak-password') {
        regErrorMessage = "Password is too weak. Please choose a stronger password (at least 6 characters).";
      } else if (error.code === 'auth/invalid-email') {
        regErrorMessage = "The email address is not valid.";
      }
      toast({ variant: 'destructive', title: 'Registration Failed', description: regErrorMessage });
      setIsLoading(false);
      return { success: false, message: error.message || "Firebase registration error" };
    }
  }, [toast]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    const previousUserRole = user?.role;
    try {
      await signOut(auth);
      // User state will be set to null by onAuthStateChanged, which also handles redirection
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
      // Redirection is now primarily handled by onAuthStateChanged effect.
      // However, we can still provide a hint for immediate routing if needed,
      // but onAuthStateChanged will be the source of truth.
      if (previousUserRole === 'admin') {
         if (!pathname.startsWith('/admin/login')) router.replace('/admin/login');
      } else {
         if (!pathname.startsWith('/login')) router.replace('/login');
      }

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
  }, [toast, router, user?.role, pathname]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}
