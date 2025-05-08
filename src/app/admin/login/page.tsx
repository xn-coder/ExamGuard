
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Eye, EyeOff, LogIn, Loader2, UserPlus, Shield } from 'lucide-react';
import Link from 'next/link';
// Removed useToast import as AuthContext now handles login/register toasts

const adminLoginFormSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password cannot be empty.' }),
});

type AdminLoginFormValues = z.infer<typeof adminLoginFormSchema>;

export default function AdminLoginPage() {
  const { login, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // const { toast } = useToast(); // Toasts are now handled by AuthContext for login
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<AdminLoginFormValues>({
    resolver: zodResolver(adminLoginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { handleSubmit, formState: { isSubmitting } } = form;

  useEffect(() => {
    if (!authLoading && user) {
      // If logged in user is not an admin, push them to user login or home
      if (user.role !== 'admin') {
        router.replace('/'); 
        return;
      }
      const redirectUrl = searchParams.get('redirect') || '/admin';
      router.replace(redirectUrl);
    }
  }, [user, authLoading, router, searchParams]);

  async function onSubmit(data: AdminLoginFormValues) {
    const result = await login(data.email, data.password, 'admin');
    if (!result.success && result.message) {
        // AuthContext's login function already handles toasting for specific errors.
        // This console.error is for debugging if there's a message.
        console.error("Admin login page submission error details:", result.message);
    }
    // If login is successful, onAuthStateChanged in AuthContext will handle redirection.
  }

  if (authLoading || (!authLoading && user && user.role === 'admin')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <p className="mt-4 text-muted-foreground">Loading Admin Portal...</p>
      </div>
    );
  }
  
  // If a non-admin user somehow lands here while logged in
  if (!authLoading && user && user.role !== 'admin') {
      router.replace('/'); // Or user login page
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
          <p className="mt-4 text-muted-foreground">Redirecting...</p>
        </div>
      );
  }


  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-gradient-to-br from-background to-secondary p-4">
      <div className="flex flex-col items-center w-full pt-12 md:pt-20">
        <div className="mb-10">
          <Logo iconColor="hsl(var(--primary-foreground))" textColor="hsl(var(--primary-foreground))" size="large" />
        </div>
        <Card className="w-full max-w-md shadow-2xl bg-card/90 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-3xl font-bold text-foreground flex items-center justify-center">
              <Shield className="mr-2 h-8 w-8 text-accent" /> Admin Login
            </CardTitle>
            <CardDescription className="text-muted-foreground">Sign in to the ExamGuard Admin Portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">Admin Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="admin@example.com" 
                          {...field} 
                          className="bg-background/70 border-border focus:bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? 'text' : 'password'} 
                            placeholder="••••••••" 
                            {...field} 
                            className="bg-background/70 border-border focus:bg-background"
                          />
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-3" disabled={isSubmitting || authLoading}>
                  {isSubmitting || authLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-5 w-5" />
                  )}
                  Admin Sign In
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col items-center text-center text-sm space-y-3 pt-6">
            <p className="text-muted-foreground">
              Need an admin account?{' '}
              <Link href="/admin/register" className="font-medium text-accent hover:underline">
                Admin Registration
              </Link>
            </p>
             <p className="text-muted-foreground pt-2">
              Not an Admin?{' '}
              <Link href="/login" className="font-medium text-accent hover:underline">
                User Login <UserPlus className="inline-block ml-1 h-4 w-4" />
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>

      <footer className="text-center text-sm text-muted-foreground/70 py-8">
        <p>&copy; {new Date().getFullYear()} ExamGuard. Secure Proctoring Solutions.</p>
      </footer>
    </main>
  );
}
