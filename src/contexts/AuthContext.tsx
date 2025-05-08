
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
  login: (email: string, pass: string, loginAs?: UserRole) => Promise<void>;
  logout: () => Promise<void>; 
  register: (email: string, pass: string, registerAs?: UserRole) => Promise<void>;
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
          // This block will be hit after createUserWithEmailAndPassword succeeds
          // Role is determined by email suffix for new users
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
        
        const currentRedirect = new URLSearchParams(window.location.search).get('redirect');
        let defaultRedirect = role === 'admin' ? '/admin' : '/';

        // Handle redirection based on where the user is
        if (role === 'admin' && (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/register'))) {
          router.replace(currentRedirect || '/admin');
        } else if (role === 'user' && (pathname === '/login' || pathname === '/register')) {
          router.replace(currentRedirect || '/');
        } else if (!pathname.startsWith('/admin') && role === 'admin') {
           // If admin is on a non-admin page (e.g. /), redirect to /admin
           router.replace('/admin');
        } else if (pathname.startsWith('/admin') && role === 'user') {
            // If user is on an admin page, redirect to /
            router.replace('/');
        } else {
            // General case, or if already on correct dashboard
             if (currentRedirect) {
                router.replace(currentRedirect)
             } else if (role === 'admin' && !pathname.startsWith('/admin')) {
                router.replace('/admin');
             } else if (role === 'user' && pathname.startsWith('/admin')) {
                router.replace('/');
             }
             // if none of the above, they are likely on the correct dashboard or a page accessible to their role
        }


      } else {
        setUser(null);
        localStorage.removeItem('authUser');
        // If user logs out or session expires, and they are on a protected page, redirect to appropriate login
        if (pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/register') {
            router.replace('/admin/login');
        } else if (!pathname.startsWith('/admin') && pathname !== '/login' && pathname !== '/register') {
            router.replace('/login');
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast, router, pathname]); 

  const login = useCallback(async (email: string, pass: string, loginAs?: UserRole) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;

      if (firebaseUser && firebaseUser.email) {
        // Role check against loginAs if provided
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        let userRole: UserRole = 'user';
        if(userDocSnap.exists()) {
            userRole = userDocSnap.data().role || 'user';
        } else { // Should not happen for login, but as a fallback
            userRole = firebaseUser.email.endsWith('@examguard.com') ? 'admin' : 'user';
        }

        if (loginAs && userRole !== loginAs) {
            await signOut(auth); // Sign out the user
            const expectedPortal = loginAs === 'admin' ? 'Admin' : 'User';
            const actualPortal = userRole === 'admin' ? 'Admin' : 'User';
            toast({ variant: 'destructive', title: 'Login Failed', description: `This account is a ${actualPortal} account. Please use the ${actualPortal} login portal.` });
            throw new Error(`Incorrect portal: Expected ${expectedPortal}, got ${actualPortal}`);
        }
        
         toast({
          title: 'Login Successful',
          description: `Welcome back!`, 
        });
      }
    } catch (error: any) {
      console.error("Firebase login error:", error);
      // Avoid re-throwing if it's the "Incorrect portal" error, as it's already handled
      if (error.message && error.message.startsWith('Incorrect portal:')) {
        // silent fail for the component, toast already shown
      } else {
        let errorMessage = "Login failed. Please check your credentials.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
          errorMessage = "Incorrect email or password. Please try again or register.";
        } else if (error.code === 'auth/wrong-password') {
          errorMessage = "Incorrect password. Please try again.";
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = "Too many login attempts. Please try again later.";
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = "The email address is not valid.";
        }
        toast({ variant: 'destructive', title: 'Login Failed', description: errorMessage });
        throw error; 
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const register = useCallback(async (email: string, pass: string, registerAs?: UserRole) => {
    setIsLoading(true);
    try {
      // Basic validation for registration type
      if (registerAs === 'admin' && !email.endsWith('@examguard.com')) {
        toast({ variant: 'destructive', title: 'Admin Registration Failed', description: 'Admin email must end with @examguard.com.' });
        setIsLoading(false);
        throw new Error('Admin email must end with @examguard.com.');
      }
      if (registerAs === 'user' && email.endsWith('@examguard.com')) {
         toast({ variant: 'destructive', title: 'User Registration Failed', description: 'Emails ending with @examguard.com are for admin accounts. Please use the admin registration.' });
         setIsLoading(false);
         throw new Error('Cannot register admin email as user.');
      }


      const newUserCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser = newUserCredential.user;
      if (newUser && newUser.email) {
        // Firestore document creation and role assignment are handled by onAuthStateChanged
        toast({
          title: 'Registration Successful!',
          description: `Welcome! Your account has been created.`,
        });
      }
    } catch (error: any)
     {
      console.error("Firebase registration error:", error);
      // Avoid re-throwing if it's a validation error already handled
      if (error.message && (error.message.includes('@examguard.com') || error.message.includes('admin email as user'))) {
        // silent fail for the component, toast already shown
      } else {
        let regErrorMessage = "Registration failed. Please try again.";
        if (error.code === 'auth/email-already-in-use') {
          regErrorMessage = "This email is already registered. Please log in or use a different email.";
        } else if (error.code === 'auth/weak-password') {
          regErrorMessage = "Password is too weak. Please choose a stronger password (at least 6 characters).";
        } else if (error.code === 'auth/invalid-email') {
          regErrorMessage = "The email address is not valid.";
        }
        toast({ variant: 'destructive', title: 'Registration Failed', description: regErrorMessage });
        throw error; 
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    const previousUserRole = user?.role;
    try {
      await signOut(auth);
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
       // Explicit redirection based on previous role
      if (previousUserRole === 'admin') {
        router.replace('/admin/login');
      } else {
        router.replace('/login');
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
  }, [toast, router, user?.role]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}
