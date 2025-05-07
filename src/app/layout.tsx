
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; 
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; 
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter', 
});

export const metadata: Metadata = {
  title: 'ExamGuard - Secure Online Proctoring', 
  description: 'An online exam portal with AI-powered behavior analysis for secure proctoring.', 
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        <AuthProvider>
          {children}
          <Toaster /> 
        </AuthProvider>
      </body>
    </html>
  );
}
