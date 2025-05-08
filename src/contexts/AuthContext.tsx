
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

        let role: UserRole = 'user'; // Default role for safety

        if (userDocSnap.exists()) {
          role = userDocSnap.data().role || 'user';
        } else {
          // This case should ideally not be hit for a user who just registered via the app's register function,
          // as the register function itself should set the role.
          // However, if a user is authenticated via Firebase directly (e.g. admin console)
          // and no user document exists, we default to 'user'.
          // The register function determines the role when creating the user document.
          console.warn("User document not found for authenticated user, defaulting role to 'user'. This might happen if user was created outside the app's registration flow or if registration flow is incomplete.");
          // Attempt to create a basic user document if it's truly missing after an external auth event.
          try {
            await setDoc(userDocRef, {
              email: firebaseUser.email,
              role: 'user', // Default to user if role is unknown at this stage
              uid: firebaseUser.uid,
              createdAt: serverTimestamp(), 
            });
          } catch (error) {
            console.error("Error creating default user document in Firestore during onAuthStateChanged:", error);
            // Potentially sign out user if profile creation fails critically
          }
        }
        
        const appUser: User = { email: firebaseUser.email, role, uid: firebaseUser.uid };
        setUser(appUser);
        localStorage.setItem('authUser', JSON.stringify(appUser));
        
        const currentRedirect = new URLSearchParams(window.location.search).get('redirect');
        
        // Handle redirection based on role and current path
        if (role === 'admin') {
          if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/register') || pathname === '/login' || pathname === '/register') {
            router.replace(currentRedirect || '/admin');
          } else if (!pathname.startsWith('/admin')) {
            router.replace('/admin');
          }
        } else { // role === 'user'
          if (pathname === '/login' || pathname === '/register' || pathname.startsWith('/admin')) {
            router.replace(currentRedirect || '/');
          }
        }

      } else {
        setUser(null);
        localStorage.removeItem('authUser');
        // If user logs out or session expires, and they are on a protected page, redirect to appropriate login
        if (pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/register') {
            router.replace('/admin/login');
        } else if (pathname !== '/' && pathname !== '/login' && pathname !== '/register' && !pathname.startsWith('/admin')) { // Avoid redirect loop if already on landing/login for user
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
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        let userRole: UserRole = 'user'; // Fallback role
        if(userDocSnap.exists()) {
            userRole = userDocSnap.data().role || 'user';
        } else { 
            // This should ideally not happen for an existing user trying to log in.
            // If it does, it implies an issue with registration not creating the user document.
            console.error(`User document missing for ${email} during login. This indicates an incomplete registration.`);
            toast({ variant: 'destructive', title: 'Login Failed', description: `Account data for ${email} is incomplete. Please try registering again or contact support.` });
            await signOut(auth);
            throw new Error('User document missing for login.');
        }

        if (loginAs && userRole !== loginAs) {
            await signOut(auth);
            const expectedPortal = loginAs === 'admin' ? 'Admin' : 'User';
            const actualPortal = userRole === 'admin' ? 'Admin' : 'User';
            toast({ variant: 'destructive', title: 'Login Failed', description: `This is a ${actualPortal} account. Please use the ${actualPortal} login portal.` });
            throw new Error(`Incorrect portal: Expected ${expectedPortal}, got ${actualPortal}`);
        }
        
         toast({
          title: 'Login Successful',
          description: `Welcome back!`, 
        });
      }
    } catch (error: any) {
      console.error("Firebase login error:", error);
      if (error.message && (error.message.startsWith('Incorrect portal:') || error.message.startsWith('User document missing'))) {
        // silent fail for the component, toast already shown
      } else {
        let errorMessage = "Login failed. Please check your credentials.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
          errorMessage = "Incorrect email or password. Please try again.";
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = "Too many login attempts. Please try again later.";
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = "The email address is not valid.";
        }
        toast({ variant: 'destructive', title: 'Login Failed', description: errorMessage });
        if (!error.message.includes("User document missing")) throw error; // Re-throw unless it's our custom error
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const register = useCallback(async (email: string, pass: string, registerAs: UserRole = 'user') => {
    setIsLoading(true);
    try {
      const newUserCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser = newUserCredential.user;
      if (newUser && newUser.email) {
        // Explicitly set the role in Firestore upon registration
        const userDocRef = doc(db, "users", newUser.uid);
        await setDoc(userDocRef, {
          email: newUser.email,
          role: registerAs, // Use the 'registerAs' parameter to set the role
          uid: newUser.uid,
          createdAt: serverTimestamp(),
        });
        
        toast({
          title: 'Registration Successful!',
          description: `Welcome! Your ${registerAs} account has been created.`,
        });
      } else {
        throw new Error("User creation failed or email not available.");
      }
    } catch (error: any)
     {
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
      throw error; 
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
