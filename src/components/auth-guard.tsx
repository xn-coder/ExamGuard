
'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
  allowedRoles?: Array<'admin' | 'user'>;
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // If not logged in, redirect to login page
        // Pass current path as redirect query param
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      } else if (allowedRoles && !allowedRoles.includes(user.role)) {
        // If logged in but role not allowed, redirect to home or admin dashboard
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You do not have permission to view this page."
        });
        if (user.role === 'admin') {
          router.replace('/admin');
        } else {
          router.replace('/');
        }
      }
    }
  }, [user, isLoading, router, pathname, allowedRoles]);

  if (isLoading || !user || (allowedRoles && user && !allowedRoles.includes(user.role))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <p className="mt-4 text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Helper function to show toast (can be moved to a utility if used elsewhere)
// For simplicity, directly using window.alert as a placeholder if useToast is not available here
// or if this component is used outside of a Toaster context (which it shouldn't be).
// A better approach for a real app would be a global toast service or ensuring context.
const toast = (options: {variant: string, title: string, description: string}) => {
  if(typeof window !== 'undefined' && (window as any)._useToastHook?.toast) {
     (window as any)._useToastHook.toast(options);
  } else {
    console.warn("Toast unavailable in AuthGuard:", options.title, options.description);
  }
}

// This is a hack to make useToast available. Better to pass it or use a global service.
if (typeof window !== 'undefined') {
  import('@/hooks/use-toast').then(module => {
    (window as any)._useToastHook = module;
  });
}
