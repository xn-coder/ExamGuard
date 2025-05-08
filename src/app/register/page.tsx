
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
import { Eye, EyeOff, UserPlus, Loader2, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const registerFormSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters.'})
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // path of error
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export default function RegisterPage() {
  const { register, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const { handleSubmit, formState: { isSubmitting } } = form;

 useEffect(() => {
    if (!authLoading && user) {
      const redirectUrl = searchParams.get('redirect') || (user.role === 'admin' ? '/admin' : '/');
      router.replace(redirectUrl);
       toast({
          title: 'Already Logged In',
          description: `Redirecting you to the ${user.role === 'admin' ? 'admin dashboard' : 'user dashboard'}.`,
        });
    }
  }, [user, authLoading, router, searchParams, toast]);

  async function onSubmit(data: RegisterFormValues) {
    try {
      await register(data.email, data.password);
      // Redirection on successful registration is handled by useEffect via onAuthStateChanged
    } catch (error) {
      // Errors are toasted within the register function in AuthContext
      console.error("Register page submission error:", error);
    }
  }
  
  if (authLoading || (!authLoading && user)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-gradient-to-br from-background to-secondary p-4">
      <div className="flex flex-col items-center w-full pt-12 md:pt-20">
        <div className="mb-10">
          <Logo iconColor="hsl(var(--primary-foreground))" textColor="hsl(var(--primary-foreground))" />
        </div>
        <Card className="w-full max-w-md shadow-2xl bg-card/90 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-3xl font-bold text-foreground">Create an Account</CardTitle>
            <CardDescription className="text-muted-foreground">Join ExamGuard to start your secure examination journey.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="you@example.com" 
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
                            placeholder="•••••••• (min. 6 characters)" 
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
                 <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showConfirmPassword ? 'text' : 'password'} 
                            placeholder="••••••••" 
                            {...field} 
                            className="bg-background/70 border-border focus:bg-background"
                          />
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    <UserPlus className="mr-2 h-5 w-5" />
                  )}
                  Create Account
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col items-center text-center text-sm space-y-3 pt-6">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-accent hover:underline">
                Sign in here
              </Link>
            </p>
             <p className="text-xs text-muted-foreground/80 pt-2">
              To create an Admin account, use an email ending with <code className="bg-muted/50 px-1 py-0.5 rounded-sm text-muted-foreground">@examguard.com</code>.
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
