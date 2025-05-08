
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { analyzeWebcamFeed, type AnalyzeWebcamFeedInput, type AnalyzeWebcamFeedOutput } from '@/ai/flows/behavior-analysis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/logo';
import { sampleQuestions } from './questions-data';
import type { Question, Answer, ScheduledExam } from './types';
import { Camera, AlertTriangle, Timer, CheckCircle, XCircle, ChevronLeft, ChevronRight, EyeOff, Ban, CopyWarning, LogOut, Loader2, ListChecks, Activity } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';


const EXAM_DURATION_SECONDS = 60 * 30; // Default 30 minutes, will be overridden by exam specific duration
const SNAPSHOT_AND_ANALYSIS_INTERVAL_MS = 1000; // Updated interval to 1 second
const MAX_VIOLATIONS = 3; // Max violations before disqualification

function ExamPageContent() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | undefined>(undefined);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false); // In-exam disqualification
  const [disqualificationReason, setDisqualificationReason] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [questionTimeStart, setQuestionTimeStart] = useState(Date.now());

  const webcamRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [warningReason, setWarningReason] = useState<string | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const [availableExams, setAvailableExams] = useState<ScheduledExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<ScheduledExam | null>(null);
  const [isFetchingExams, setIsFetchingExams] = useState(true);
  const isDisqualificationLoggedRef = useRef(false);

  const liveSnapshotDocIdRef = useRef<string | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);


  const clearLiveSnapshot = useCallback(async () => {
    if (liveSnapshotDocIdRef.current) {
      try {
        await deleteDoc(doc(db, 'liveSnapshots', liveSnapshotDocIdRef.current));
        liveSnapshotDocIdRef.current = null;
      } catch (error) {
        console.error("Error deleting live snapshot:", error);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (webcamRef.current && webcamRef.current.srcObject) {
      const stream = webcamRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      webcamRef.current.srcObject = null;
    }
    // setHasCameraPermission(false); // Keep permission status, just tracks are stopped
  }, []);

  const resetExamState = useCallback(() => {
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(undefined);
    setAnswers([]);
    setTimeLeft(EXAM_DURATION_SECONDS); 
    setExamStarted(false);
    setExamSubmitted(false);
    setIsDisqualified(false);
    setDisqualificationReason(null);
    setScore(0);
    setTotalTimeSpent(0);
    setQuestionTimeStart(Date.now());
    setViolationCount(0);
    setShowWarning(false);
    setWarningReason(null);
    
    isDisqualificationLoggedRef.current = false;
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    stopCamera();
    setHasCameraPermission(null); 
    clearLiveSnapshot(); 
    setSelectedExam(null); 
  }, [clearLiveSnapshot, stopCamera]);


  // Fetch all scheduled exams and filter based on whitelist and disqualification
  useEffect(() => {
    if (!user || !user.uid || !user.email) {
        setIsFetchingExams(false);
        setAvailableExams([]);
        return;
    }

    if (selectedExam) { 
        setIsFetchingExams(false);
        return;
    }

    setIsFetchingExams(true);

    const examsQuery = query(collection(db, 'scheduledExams'), orderBy('scheduledTime', 'desc'));
    const unsubscribeExams = onSnapshot(examsQuery, async (examsSnapshot) => {
        const allExams = examsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledExam));
        
        const whitelistedQuery = query(
            collection(db, 'whitelistedUsers'),
            where('email', '==', user.email)
        );
        const unsubscribeWhitelist = onSnapshot(whitelistedQuery, async (whitelistSnapshot) => {
            const whitelistedAdminIds = new Set(whitelistSnapshot.docs.map(doc => doc.data().adminId));

            const disqualifiedQuery = query(
                collection(db, 'disqualifiedUsers'),
                where('uid', '==', user.uid)
            );
            const unsubscribeDisqualified = onSnapshot(disqualifiedQuery, (disqualifiedSnapshot) => {
                const disqualifiedExamIds = new Set(disqualifiedSnapshot.docs.map(doc => doc.data().examId));
                
                const userAccessibleExams = allExams.filter(exam => 
                    exam.adminId && 
                    whitelistedAdminIds.has(exam.adminId) && 
                    !disqualifiedExamIds.has(exam.id) 
                );
                
                setAvailableExams(userAccessibleExams);
                setIsFetchingExams(false);
            }, (error) => {
                console.error("Error fetching disqualified users in real-time: ", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch disqualified status.' });
                setIsFetchingExams(false);
            });

            return () => unsubscribeDisqualified();
        }, (error) => {
            console.error("Error fetching whitelisted users in real-time: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch whitelist status.' });
            setIsFetchingExams(false);
        });
        
        return () => unsubscribeWhitelist();

    }, (error) => {
        console.error("Error fetching exams in real-time: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch available exams.' });
        setAvailableExams([]);
        setIsFetchingExams(false);
    });

    return () => {
        unsubscribeExams();
    };
  }, [user, toast, selectedExam]);


  const logActivity = useCallback(async (activityType: 'ai-warning' | 'tab-switch' | 'copy-paste' | 'disqualification' | 'exam-start' | 'exam-submit', details: string, examId?: string) => {
    if (!user || !user.uid || !selectedExam || !selectedExam.adminId) return; 
    try {
      await addDoc(collection(db, 'activityLogs'), {
        userId: user.email, 
        userUid: user.uid,
        examId: examId || selectedExam?.id || 'unknown_exam',
        timestamp: new Date().toISOString(),
        activityType,
        details,
        adminId: selectedExam.adminId, 
      });
    } catch (error) {
      console.error("Error logging activity: ", error);
    }
  }, [user, selectedExam]);


  const handleDisqualification = useCallback(async (reason: string) => {
    if (isDisqualificationLoggedRef.current || !selectedExam) return; 
    isDisqualificationLoggedRef.current = true;

    setIsDisqualified(true); 
    setDisqualificationReason(reason);
    setExamStarted(false); 
    setExamSubmitted(true); 
    
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    stopCamera();
    clearLiveSnapshot(); 

    setTimeout(() => {
        toast({
            variant: 'destructive',
            title: 'Exam Disqualified',
            description: reason,
            duration: 10000,
        });
    }, 0);


    if (user && user.uid && selectedExam && selectedExam.adminId) {
      await logActivity('disqualification', `User disqualified: ${reason}`, selectedExam?.id);
      try {
        const dqQuery = query(collection(db, 'disqualifiedUsers'), where('uid', '==', user.uid), where('examId', '==', selectedExam?.id), where('adminId', '==', selectedExam.adminId));
        const dqSnapshot = await getDocs(dqQuery);

        if (dqSnapshot.empty) {
          await addDoc(collection(db, 'disqualifiedUsers'), {
            email: user.email,
            uid: user.uid,
            examId: selectedExam?.id || 'unknown_exam',
            disqualificationReason: reason,
            disqualificationTime: new Date().toISOString(),
            adminId: selectedExam.adminId,
          });
        }
      } catch (error) {
        console.error("Error saving disqualification record: ", error);
      }
    }
  }, [toast, user, logActivity, selectedExam, clearLiveSnapshot, stopCamera]);


  const recordViolation = useCallback((reason: string, type: 'ai-warning' | 'tab-switch' | 'copy-paste') => {
    if (isDisqualified || !selectedExam) return; 
    
    setViolationCount(prevCount => {
      const newCount = prevCount + 1;
      logActivity(type, reason, selectedExam?.id);

      if (newCount >= MAX_VIOLATIONS) {
        setTimeout(() => handleDisqualification(`Exceeded maximum violations (${MAX_VIOLATIONS}). Last violation: ${reason}`), 0);
      } else {
        setWarningReason(reason + ` (Violation ${newCount}/${MAX_VIOLATIONS})`);
        setShowWarning(true); 
         setTimeout(() => { 
            toast({
                variant: 'destructive',
                title: 'Warning: Suspicious Activity',
                description: reason + ` This is warning ${newCount} of ${MAX_VIOLATIONS}.`,
            });
        }, 0);
      }
      return newCount;
    });
  }, [toast, handleDisqualification, logActivity, selectedExam, isDisqualified]);

  const recordAnswer = useCallback((answer: string | undefined) => {
    if (!questions[currentQuestionIndex] || answer === undefined || isDisqualified || !selectedExam) return;

    const question = questions[currentQuestionIndex];
    const timeSpentOnQuestion = (Date.now() - questionTimeStart) / 1000;
    const isCorrect = answer === question.correctAnswer;

    setAnswers(prevAnswers => {
      const existingAnswerIndex = prevAnswers.findIndex(a => a.questionId === question.id);
      if (existingAnswerIndex > -1) {
        const updatedAnswers = [...prevAnswers];
        updatedAnswers[existingAnswerIndex] = {
          ...updatedAnswers[existingAnswerIndex],
          selectedAnswer: answer,
          isCorrect,
          timeSpent: updatedAnswers[existingAnswerIndex].timeSpent + timeSpentOnQuestion 
        };
        return updatedAnswers;
      }
      return [
        ...prevAnswers,
        {
          questionId: question.id,
          selectedAnswer: answer,
          isCorrect,
          timeSpent: timeSpentOnQuestion,
        },
      ];
    });
    setQuestionTimeStart(Date.now());
  }, [questions, currentQuestionIndex, questionTimeStart, isDisqualified, selectedExam]);


 const handleSubmitExam = useCallback(async () => {
    if (isDisqualified || !selectedExam) return; 
    recordAnswer(selectedAnswer); 
    setExamSubmitted(true);
    setExamStarted(false);
    
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    stopCamera();
    clearLiveSnapshot(); 
    
    let finalScore = 0;
    answers.forEach(ans => {
        if(ans.isCorrect) finalScore++;
    });

    const currentQ = questions[currentQuestionIndex];
    if (currentQ && selectedAnswer !== undefined) { 
       const alreadyAnswered = answers.find(a => a.questionId === currentQ.id);
       if(!alreadyAnswered && selectedAnswer === currentQ.correctAnswer) {
           finalScore++; 
       }
    }

    setTimeout(() => {
        toast({
          title: "Exam Submitted!",
          description: `Your score is ${finalScore}/${questions.length}.`,
          variant: "default",
        });
    }, 0);
    setScore(finalScore); 
    if(user) await logActivity('exam-submit', `Exam submitted. Score: ${finalScore}/${questions.length}`, selectedExam?.id);

  }, [isDisqualified, selectedAnswer, questions, answers, currentQuestionIndex, toast, user, logActivity, selectedExam, recordAnswer, clearLiveSnapshot, stopCamera]);


  useEffect(() => {
    if (!examStarted || examSubmitted || isDisqualified || !selectedExam) return;

    const timer = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timer);
          if (!isDisqualified && !examSubmitted) handleSubmitExam(); 
          return 0;
        }
        return prevTime - 1;
      });
      setTotalTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, examSubmitted, isDisqualified, handleSubmitExam, selectedExam]);


  useEffect(() => {
    const getCameraPerm = async () => {
      if (!examStarted || hasCameraPermission || !selectedExam || isDisqualified) return; 
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
        }
        setTimeout(() => {
             toast({
                title: "Webcam Enabled",
                description: "Proctoring and live feed active.",
                variant: "default",
              });
        }, 0);
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        if(examStarted && !isDisqualified){ 
             handleDisqualification("Camera access denied or unavailable. Exam cannot be proctored.");
        } else if (!examStarted) { 
             setTimeout(() => {
                toast({
                  variant: 'destructive',
                  title: 'Camera Access Required',
                  description: 'Please enable camera permissions in your browser settings and refresh to start the exam.',
                  duration: 10000,
                });
            }, 0);
        }
      }
    };
    
    if(examStarted && selectedExam && !isDisqualified) getCameraPerm(); 
    
  }, [examStarted, toast, handleDisqualification, hasCameraPermission, selectedExam, isDisqualified]);
  
  // Continuous Snapshot and AI Behavior Analysis
  useEffect(() => {
    if (!examStarted || !hasCameraPermission || examSubmitted || isDisqualified || !selectedExam || !user || !selectedExam.adminId) {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
      return;
    }

    const captureAndAnalyze = async () => {
      if (webcamRef.current && webcamRef.current.readyState === 4 && webcamRef.current.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = webcamRef.current.videoWidth;
        canvas.height = webcamRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(webcamRef.current, 0, 0, canvas.width, canvas.height);
          const webcamFeedDataUri = canvas.toDataURL('image/jpeg', 0.7); // Use JPEG for smaller size
          
          if (!liveSnapshotDocIdRef.current) { // Set once per exam session
             liveSnapshotDocIdRef.current = `${user.uid}_${selectedExam.id}`;
          }

          if (liveSnapshotDocIdRef.current && selectedExam.adminId) {
            try {
              await setDoc(doc(db, 'liveSnapshots', liveSnapshotDocIdRef.current), {
                userId: user.uid,
                userEmail: user.email ?? 'unknown_email',
                examId: selectedExam.id,
                examName: selectedExam.name,
                adminId: selectedExam.adminId,
                snapshotDataUri: webcamFeedDataUri,
                updatedAt: serverTimestamp(),
              }, { merge: true });
            } catch (error) {
              console.error("Error updating live snapshot:", error);
            }
          }

          try {
            const input: AnalyzeWebcamFeedInput = {
              webcamFeedDataUri,
              timeElapsed: totalTimeSpent,
              questionNumber: currentQuestionIndex + 1,
            };
            const result: AnalyzeWebcamFeedOutput = await analyzeWebcamFeed(input);
            if (result.isSuspicious) {
              recordViolation(result.reason || "AI detected suspicious behavior.", 'ai-warning');
            }
          } catch (error) {
            console.error("Error analyzing webcam snapshot:", error);
            if (!isDisqualified) { // Avoid logging if already disqualified to prevent redundant logs
              const currentExamId = selectedExam?.id || 'unknown_exam_during_ai_error';
              await logActivity('ai-warning', `Error in AI analysis: ${error instanceof Error ? error.message : String(error)}`, currentExamId);
            }
          }
        }
      }
    };

    // Perform initial capture almost immediately, then set interval
    if (analysisIntervalRef.current) { // Clear existing interval before setting a new one
      clearInterval(analysisIntervalRef.current);
    }
    captureAndAnalyze(); 
    analysisIntervalRef.current = setInterval(captureAndAnalyze, SNAPSHOT_AND_ANALYSIS_INTERVAL_MS);

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
    };
  }, [examStarted, hasCameraPermission, examSubmitted, isDisqualified, selectedExam, user, totalTimeSpent, currentQuestionIndex, recordViolation, logActivity]);


  useEffect(() => {
    if (!examStarted || examSubmitted || isDisqualified || !selectedExam) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation("Tab switched or window minimized.", 'tab-switch');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [examStarted, examSubmitted, recordViolation, isDisqualified, selectedExam]);

  useEffect(() => {
    if (!examStarted || examSubmitted || isDisqualified || !selectedExam) return;

    const handleCopy = (event: ClipboardEvent) => {
      recordViolation("Copy event detected.", 'copy-paste');
    };
    const handlePaste = (event: ClipboardEvent) => {
      recordViolation("Paste event detected.", 'copy-paste');
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [examStarted, examSubmitted, recordViolation, isDisqualified, selectedExam]);


  const handleStartExam = async (examToStart: ScheduledExam) => {
    if (!user || !user.email || !examToStart || !examToStart.adminId ) { 
        setTimeout(() => {
            toast({ variant: 'destructive', title: 'Cannot Start Exam', description: 'User, exam details, or admin ID missing.'});
        }, 0);
      return;
    }
    
    setHasCameraPermission(null); 
    setSelectedExam(examToStart); 
    isDisqualificationLoggedRef.current = false; 
    setIsDisqualified(false); 
    setExamStarted(true);
    setExamSubmitted(false);
    setDisqualificationReason(null);
    setViolationCount(0);
    setTimeLeft(examToStart.durationMinutes * 60 || EXAM_DURATION_SECONDS); 
    setTotalTimeSpent(0);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setSelectedAnswer(undefined);
    setScore(0);
    setQuestionTimeStart(Date.now());
    setQuestions(sampleQuestions); 
    liveSnapshotDocIdRef.current = `${user.uid}_${examToStart.id}`; 

    await logActivity('exam-start', `Exam started: ${examToStart.name}`, examToStart.id);
  };

  const handleAnswerChange = (value: string) => {
    setSelectedAnswer(value);
  };


  const handleNextQuestion = () => {
    if (isDisqualified) return;
    recordAnswer(selectedAnswer);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      const nextQuestionId = questions[currentQuestionIndex + 1].id;
      const previousAnswerForNextQuestion = answers.find(ans => ans.questionId === nextQuestionId);
      setSelectedAnswer(previousAnswerForNextQuestion?.selectedAnswer || undefined);
    }
  };

  const handlePreviousQuestion = () => {
    if (isDisqualified) return;
    recordAnswer(selectedAnswer); 
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prevIndex => prevIndex - 1);
      const prevQuestionId = questions[currentQuestionIndex - 1].id;
      const previousAnswerForPrevQuestion = answers.find(ans => ans.questionId === prevQuestionId);
      setSelectedAnswer(previousAnswerForPrevQuestion?.selectedAnswer || undefined);
      setQuestionTimeStart(Date.now()); 
    }
  };


  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  if (user === null && !isFetchingExams) { 
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="items-center">
            <Logo />
          </CardHeader>
          <CardContent className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-xl">Please log in to access exams.</p>
            <Button onClick={() => logout()} variant="outline" className="mt-4">
                Go to Login
            </Button>
          </CardContent>
        </Card>
         <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center">
                  <AlertTriangle className="text-destructive mr-2 h-6 w-6" />
                  Suspicious Behavior Warning
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {warningReason || "Our system has detected behavior that might not be compliant with exam policies. Please ensure you are following all guidelines."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setShowWarning(false)}>Acknowledge</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      </main>
    );
  }

  if (isFetchingExams || (selectedExam && questions.length === 0 && !examSubmitted && examStarted && !isDisqualified)) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="items-center">
            <Logo />
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto mb-4" />
            <p className="text-xl">{isFetchingExams ? 'Fetching available exams...' : 'Loading exam questions...'}</p>
            <Progress value={isFetchingExams ? 30 : 50} className="w-full mt-4" />
          </CardContent>
        </Card>
         <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center">
                  <AlertTriangle className="text-destructive mr-2 h-6 w-6" />
                  Suspicious Behavior Warning
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {warningReason || "Our system has detected behavior that might not be compliant with exam policies. Please ensure you are following all guidelines."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setShowWarning(false)}>Acknowledge</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      </main>
    );
  }
  
  const currentQuestion = questions[currentQuestionIndex];
  const progressPercentage = examStarted && questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  if (isDisqualified && selectedExam) { 
    return (
       <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary space-y-8">
        <header className="w-full max-w-4xl flex justify-between items-center p-4 bg-card rounded-lg shadow-md">
          <Logo />
          {user && <Button variant="outline" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Logout</Button>}
        </header>
        <Card className="w-full max-w-lg text-center shadow-2xl">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-destructive flex items-center justify-center">
              <Ban className="mr-2 h-8 w-8" /> Exam Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">
              Your exam session for {selectedExam.name} has been disqualified.
            </p>
            {disqualificationReason && <p className="font-semibold">Reason: {disqualificationReason}</p>}
            <Button onClick={resetExamState} variant="outline" size="lg"> 
              Back to Exam Selection
            </Button>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground justify-center">
            <p>Please contact support if you believe this is an error.</p>
          </CardFooter>
        </Card>
         <footer className="text-center text-sm text-muted-foreground py-4">
          <p>&copy; {new Date().getFullYear()} ExamGuard. All rights reserved.</p>
        </footer>
         <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center">
                  <AlertTriangle className="text-destructive mr-2 h-6 w-6" />
                  Suspicious Behavior Warning
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {warningReason || "Our system has detected behavior that might not be compliant with exam policies. Please ensure you are following all guidelines."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setShowWarning(false)}>Acknowledge</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      </main>
    );
  }

  // Exam Selection Screen
  if (!selectedExam && !isFetchingExams) {
    return (
      <main className="flex flex-col items-center min-h-screen p-4 bg-secondary space-y-8">
        <header className="w-full max-w-5xl flex justify-between items-center p-4 bg-card rounded-lg shadow-md">
          <Logo />
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Logged in as: {user?.email}</p>
            <Button variant="outline" size="sm" onClick={logout} className="mt-1"><LogOut className="mr-2 h-4 w-4" />Logout</Button>
          </div>
        </header>
        
        <div className="w-full max-w-5xl">
          <h1 className="text-3xl font-bold text-foreground mb-6 text-center">Available Exams</h1>
          {availableExams.length === 0 ? (
            <Card className="w-full max-w-lg mx-auto text-center shadow-2xl">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">No Exams Available</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">There are currently no exams scheduled for you, or you might have been disqualified from available exams. Please check back later or contact an administrator.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableExams.map(exam => (
                <Card key={exam.id} className="shadow-xl hover:shadow-2xl transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-accent" />{exam.name}</CardTitle>
                    <CardDescription>Scheduled: {new Date(exam.scheduledTime).toLocaleString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Duration: {exam.durationMinutes} minutes</p>
                     <div className="mt-3 p-3 border rounded-md bg-muted/30">
                        <h4 className="font-semibold text-sm mb-1">Instructions:</h4>
                        <ul className="list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
                            <li>Webcam required for proctoring.</li>
                            <li>Quiet environment, no external help.</li>
                            <li>No tab switching or copy/pasting.</li>
                            <li>{MAX_VIOLATIONS} warnings lead to disqualification.</li>
                        </ul>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                        onClick={() => handleStartExam(exam)} 
                        className="w-full"
                        disabled={hasCameraPermission === false} 
                    >
                      <Camera className="mr-2 h-4 w-4" /> Start Exam
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
           {hasCameraPermission === false && ( 
              <Alert variant="destructive" className="my-6 max-w-lg mx-auto">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Camera Access Issue</AlertTitle>
                <AlertDescription>
                  Camera access was denied or is unavailable. Please enable camera permissions in your browser settings and refresh the page. Exams require webcam access for proctoring.
                </AlertDescription>
              </Alert>
            )}
        </div>
        <footer className="text-center text-sm text-muted-foreground py-4 mt-auto">
          <p>&copy; {new Date().getFullYear()} ExamGuard. All rights reserved.</p>
        </footer>
         <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center">
                  <AlertTriangle className="text-destructive mr-2 h-6 w-6" />
                  Suspicious Behavior Warning
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {warningReason || "Our system has detected behavior that might not be compliant with exam policies. Please ensure you are following all guidelines."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setShowWarning(false)}>Acknowledge</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      </main>
    );
  }


  // Exam Taking Screen (when selectedExam is set and examStarted is true)
  if (selectedExam && examStarted && !examSubmitted && currentQuestion) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary space-y-8">
        <header className="w-full max-w-4xl flex justify-between items-center p-4 bg-card rounded-lg shadow-md">
          <Logo />
          {examStarted && !examSubmitted && selectedExam && (
            <div className="flex items-center space-x-2 text-lg font-semibold text-accent">
              <Timer className="h-6 w-6" />
              <span>Time Left: {formatTime(timeLeft)}</span>
            </div>
          )}
          {user && <Button variant="outline" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Logout</Button>}
        </header>
        <Card className="w-full max-w-4xl shadow-2xl">
          <CardHeader>
             <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-semibold">Question {currentQuestionIndex + 1}</h2>
                <CardDescription className="text-sm text-muted-foreground">{selectedExam?.name}</CardDescription>
              </div>
              <div className="w-32 h-24 bg-muted rounded-md overflow-hidden border relative">
                <video ref={webcamRef} className="w-full h-full object-cover transform scaleX-[-1]" autoPlay playsInline muted />
                {hasCameraPermission === null && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white text-xs p-1 text-center">
                        <Camera className="h-6 w-6 mb-1 animate-pulse" />
                        Initializing Camera...
                    </div>
                )}
                {hasCameraPermission === false && examStarted && !isDisqualified && ( 
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive text-destructive-foreground text-xs p-1 text-center">
                    <EyeOff className="h-6 w-6 mb-1" />
                    Webcam Error! Proctoring inactive.
                  </div>
                )}
                {hasCameraPermission === true && (
                     <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/50 text-white text-xs rounded flex items-center">
                        <Activity className="h-3 w-3 mr-1 text-green-400 animate-pulse" />
                        Live
                    </div>
                )}
              </div>
            </div>
            <Progress value={progressPercentage} className="w-full mb-2" />
            <div className="flex justify-between items-center">
                <CardDescription className="text-sm text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</CardDescription>
                <span className={`text-sm font-semibold ${violationCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    Violations: {violationCount}/{MAX_VIOLATIONS}
                </span>
            </div>
            
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-xl font-medium leading-relaxed">{currentQuestion.question}</p>
              {currentQuestion.image && (
                <div className="my-4 rounded-lg overflow-hidden border shadow-sm">
                  <Image 
                    src={currentQuestion.image} 
                    alt={`Question ${currentQuestionIndex + 1} illustration`} 
                    width={400} 
                    height={200} 
                    className="mx-auto object-contain"
                    data-ai-hint="educational illustration"
                  />
                </div>
              )}
              <RadioGroup
                value={selectedAnswer}
                onValueChange={handleAnswerChange}
                className="space-y-2"
              >
                {currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="text-base">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            
          </CardContent>
          <CardFooter className="flex justify-between items-center">
              <Button
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
                variant="outline"
                aria-label="Previous Question"
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              {currentQuestionIndex === questions.length - 1 ? (
                <Button onClick={handleSubmitExam} size="lg" aria-label="Submit Exam" disabled={selectedAnswer === undefined}>
                  Submit Exam <CheckCircle className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleNextQuestion} aria-label="Next Question" disabled={selectedAnswer === undefined}>
                  Next <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardFooter>
        </Card>
         <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center">
                  <AlertTriangle className="text-destructive mr-2 h-6 w-6" />
                  Suspicious Behavior Warning
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {warningReason || "Our system has detected behavior that might not be compliant with exam policies. Please ensure you are following all guidelines."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setShowWarning(false)}>Acknowledge</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
           <footer className="text-center text-sm text-muted-foreground py-4 mt-auto">
             <p>&copy; {new Date().getFullYear()} ExamGuard. All rights reserved.</p>
           </footer>
      </main>
    );
  }

  if (examSubmitted && !isDisqualified && selectedExam) {
    return (
       <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary space-y-8">
            <header className="w-full max-w-4xl flex justify-between items-center p-4 bg-card rounded-lg shadow-md">
            <Logo />
            {user && <Button variant="outline" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Logout</Button>}
        </header>
        <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Exam Submitted!</CardTitle>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto my-4" />
        </CardHeader>
        <CardContent className="text-center space-y-4">
            <p className="text-lg">Thank you for completing the exam: {selectedExam.name}, {user?.email}.</p>
            <p className="text-lg">Your score: {score}/{questions.length}</p>
            <p className="text-muted-foreground">Total time taken: {formatTime(totalTimeSpent)}</p>
            <Button onClick={resetExamState} variant="outline">
            Back to Exam Selection
            </Button>
        </CardContent>
        </Card>
            <footer className="text-center text-sm text-muted-foreground py-4 mt-auto">
            <p>&copy; {new Date().getFullYear()} ExamGuard. All rights reserved.</p>
        </footer>
         <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center">
                  <AlertTriangle className="text-destructive mr-2 h-6 w-6" />
                  Suspicious Behavior Warning
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {warningReason || "Our system has detected behavior that might not be compliant with exam policies. Please ensure you are following all guidelines."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setShowWarning(false)}>Acknowledge</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
    </main> 
    );
  }

  // Fallback UI: Covers cases where no specific view is matched or when exam is not started.
  // Includes the warning dialog and a generic footer.
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-secondary">
      {/* This part should ideally be unreachable if other conditions handle UI correctly. */}
      {/* Adding a placeholder for non-exam states or potential errors. */}
      {!selectedExam && !isFetchingExams && !examStarted && (
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="items-center"><Logo /></CardHeader>
          <CardContent className="text-center">
            <p className="text-xl text-muted-foreground">Welcome to ExamGuard.</p>
            <p className="text-sm">Select an exam to begin or await instructions.</p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="text-destructive mr-2 h-6 w-6" />
              Suspicious Behavior Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              {warningReason || "Our system has detected behavior that might not be compliant with exam policies. Please ensure you are following all guidelines."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowWarning(false)}>Acknowledge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Footer for non-exam and non-loading states */}
      {(!isFetchingExams && (!selectedExam || !examStarted || examSubmitted || isDisqualified)) && (
         <footer className="text-center text-sm text-muted-foreground py-4 mt-auto fixed bottom-0 w-full">
            <p>&copy; {new Date().getFullYear()} ExamGuard. All rights reserved.</p>
        </footer>
      )}
    </main>
  );
}

export default function ExamPage() {
  return (
    <AuthGuard allowedRoles={['user']}>
      <ExamPageContent />
    </AuthGuard>
  );
}

