
'use client';

import { useState, type FormEvent, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import type { WhitelistedUser, ScheduledExam, UserActivityLog, DisqualifiedUser, LiveSnapshot, ExamHistoryEntry, ExamParticipant } from '@/app/types';
import { UserPlus, CalendarPlus, ShieldAlert, Users, Trash2, Search, Eye, ListChecks, LogOut, Video, Loader2, History as HistoryIcon } from 'lucide-react';
import { Logo } from '@/components/logo';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import Image from 'next/image';

interface AggregatedLog extends UserActivityLog {
  count: number;
}

const SNAPSHOT_AND_ANALYSIS_INTERVAL_MS = 1000; // 1 second, matches the value in src/app/page.tsx

function AdminPageContent() {
  const [whitelistedUsers, setWhitelistedUsers] = useState<WhitelistedUser[]>([]);
  const [newWhitelistedEmail, setNewWhitelistedEmail] = useState('');
  
  const [scheduledExams, setScheduledExams] = useState<ScheduledExam[]>([]);
  const [newExamName, setNewExamName] = useState('');
  const [newExamTime, setNewExamTime] = useState('');
  const [newExamDuration, setNewExamDuration] = useState(60);

  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([]);
  const [aggregatedLogs, setAggregatedLogs] = useState<AggregatedLog[]>([]);
  const [disqualifiedUsers, setDisqualifiedUsers] = useState<DisqualifiedUser[]>([]);
  const [liveSnapshots, setLiveSnapshots] = useState<LiveSnapshot[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [examHistory, setExamHistory] = useState<ExamHistoryEntry[]>([]);
  const [isFetchingExamHistory, setIsFetchingExamHistory] = useState(false);


  const { toast } = useToast();
  const { user, logout } = useAuth();

  const fetchWhitelistedUsers = useCallback(async () => {
    if (!user || !user.uid) return;
    try {
      const q = query(collection(db, 'whitelistedUsers'), where('adminId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WhitelistedUser));
      setWhitelistedUsers(usersList);
    } catch (error) {
      console.error("Error fetching whitelisted users: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch whitelisted users.' });
    }
  }, [user, toast]);

  const fetchScheduledExams = useCallback(async () => {
    if (!user || !user.uid) return;
    try {
      const q = query(collection(db, 'scheduledExams'), where('adminId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const examsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledExam));
      setScheduledExams(examsList);
    } catch (error) {
      console.error("Error fetching scheduled exams: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch scheduled exams.' });
    }
  }, [user, toast]);

  const fetchActivityLogs = useCallback(async (currentSearchTerm: string = searchTerm) => {
    if (!user || !user.uid) return;
    try {
      const q = query(collection(db, 'activityLogs'), where('adminId', '==', user.uid), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      let logsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserActivityLog));

      if (currentSearchTerm) {
        logsList = logsList.filter(log =>
          log.userId.toLowerCase().includes(currentSearchTerm.toLowerCase())
        );
      }

      setActivityLogs(logsList); 
    } catch (error: any) {
      console.error("Error fetching activity logs: ", error);
      if (error.code === 'failed-precondition' && error.message && error.message.toLowerCase().includes('index')) {
        toast({
            variant: 'destructive',
            title: 'Database Index Required',
            description: 'A query for activity logs requires a Firestore index. Please create it in your Firebase console. The required index usually involves "adminId" (ascending) and "timestamp" (descending) on the "activityLogs" collection.',
            duration: 10000,
        });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch activity logs.' });
      }
    }
  }, [user, toast, searchTerm]);

  const fetchExamHistory = useCallback(async () => {
    if (!user || !user.uid) return;
    setIsFetchingExamHistory(true);
    try {
        const examsQuery = query(collection(db, 'scheduledExams'), where('adminId', '==', user.uid), orderBy('scheduledTime', 'desc'));
        const examsSnapshot = await getDocs(examsQuery);
        const allExams = examsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledExam));

        const historyEntries: ExamHistoryEntry[] = [];

        for (const exam of allExams) {
            const participantsQuery = query(
                collection(db, 'activityLogs'),
                where('adminId', '==', user.uid),
                where('examId', '==', exam.id),
                where('activityType', '==', 'exam-start')
            );
            const participantsSnapshot = await getDocs(participantsQuery);

            const uniqueParticipants = new Map<string, ExamParticipant>();
            participantsSnapshot.docs.forEach(logDoc => {
                const logData = logDoc.data() as UserActivityLog;
                if (logData.userUid && !uniqueParticipants.has(logData.userUid)) {
                    uniqueParticipants.set(logData.userUid, {
                        uid: logData.userUid,
                        email: logData.userId,
                    });
                }
            });
            
            historyEntries.push({
                ...exam,
                participants: Array.from(uniqueParticipants.values()),
                participantCount: uniqueParticipants.size,
            });
        }
        
        setExamHistory(historyEntries);
    } catch (error: any) {
        console.error("Error fetching exam history: ", error);
        if (error.code === 'failed-precondition' && error.message && error.message.toLowerCase().includes('index')) {
             toast({
                variant: 'destructive',
                title: 'Database Index Required (Exam History)',
                description: 'The exam history query requires Firestore indexes. Please create them in your Firebase console. This might involve indexing "adminId" (asc) and "scheduledTime" (desc) on "scheduledExams", and/or a composite index on "activityLogs" for "adminId" (asc), "examId" (asc), and "activityType" (asc).',
                duration: 15000,
            });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch exam history.' });
        }
    } finally {
        setIsFetchingExamHistory(false);
    }
  }, [user, toast]);


  useEffect(() => {
    const aggregateLogs = () => {
      const aggregated: AggregatedLog[] = [];
      let lastLog: AggregatedLog | null = null;

      activityLogs.forEach(log => {
        if (lastLog && log.userId === lastLog.userId && log.activityType === lastLog.activityType && log.details === lastLog.details) {
          lastLog.count++;
        } else {
          if (lastLog) {
            aggregated.push(lastLog);
          }
          lastLog = { ...log, count: 1 };
        }
      });

      if (lastLog) {
        aggregated.push(lastLog);
      }
      setAggregatedLogs(aggregated);
    };
    aggregateLogs();
  }, [activityLogs]);


  useEffect(() => {
     if (user && user.uid) {
      fetchWhitelistedUsers();
      fetchScheduledExams();
      fetchActivityLogs(); 

      const unsubscribeDisqualified = onSnapshot(
        query(collection(db, "disqualifiedUsers"), where('adminId', '==', user.uid)), 
        (snapshot) => {
          const dqUsersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DisqualifiedUser));
          setDisqualifiedUsers(dqUsersList);
        }, (error) => {
          console.error("Error fetching disqualified users: ", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch disqualified users.' });
        }
      );
      
      const unsubscribeActivity = onSnapshot(
        query(collection(db, 'activityLogs'), where('adminId', '==', user.uid), orderBy('timestamp', 'desc')),
        (snapshot) => {
          let logsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserActivityLog));
          if (searchTerm) {
            logsList = logsList.filter(log =>
              log.userId.toLowerCase().includes(searchTerm.toLowerCase())
            );
          }
          setActivityLogs(logsList); 
        }, (error: any) => { 
            console.error("Error fetching activity logs in real-time: ", error);
            if (error.code === 'failed-precondition' && error.message && error.message.toLowerCase().includes('index')) {
                toast({
                    variant: 'destructive',
                    title: 'Database Index Required (Real-time)',
                    description: 'The real-time activity log query requires a Firestore index. Please create it in your Firebase console. This usually involves indexing "adminId" (ascending) and "timestamp" (descending) on the "activityLogs" collection.',
                    duration: 15000, 
                });
            } else {
                toast({ variant: 'destructive', title: 'Real-time Error', description: 'Could not fetch real-time activity logs.' });
            }
        }
      );

      const unsubscribeLiveSnapshots = onSnapshot(
        query(collection(db, 'liveSnapshots'), where('adminId', '==', user.uid), orderBy('updatedAt', 'desc')),
        (snapshot) => {
          const snapshotsList = snapshot.docs.map(docData => ({ id: docData.id, ...docData.data() } as LiveSnapshot));
          setLiveSnapshots(snapshotsList);
        }, (error: any) => {
          console.error("Error fetching live snapshots: ", error);
           if (error.code === 'failed-precondition' && error.message && error.message.toLowerCase().includes('index')) {
             toast({
                variant: 'destructive',
                title: 'Database Index Required (Live Snapshots)',
                description: 'The live snapshots query requires a Firestore index. Please create it in your Firebase console. This usually involves indexing "adminId" (ascending) and "updatedAt" (descending) on the "liveSnapshots" collection.',
                duration: 15000,
            });
           } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch live snapshots.' });
           }
        }
      );

      return () => {
        unsubscribeDisqualified();
        unsubscribeActivity(); 
        unsubscribeLiveSnapshots();
      };
    }
  }, [user, toast, fetchWhitelistedUsers, fetchScheduledExams, fetchActivityLogs, searchTerm]);

  useEffect(() => {
    if (user && user.uid) {
      fetchExamHistory();
    }
  }, [user, fetchExamHistory]);


  const handleAddWhitelistedUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.uid) return;
    if (!newWhitelistedEmail.trim() || !newWhitelistedEmail.includes('@')) {
      toast({ variant: 'destructive', title: 'Invalid Email', description: 'Please enter a valid email address.' });
      return;
    }
    try {
      const docData = {
        email: newWhitelistedEmail.trim(),
        addedAt: serverTimestamp(),
        adminId: user.uid,
      };
      const docRef = await addDoc(collection(db, 'whitelistedUsers'), docData);
      setWhitelistedUsers(prev => [...prev, { id: docRef.id, ...docData, addedAt: new Date() }]); 
      setNewWhitelistedEmail('');
      toast({ title: 'User Whitelisted', description: `${newWhitelistedEmail.trim()} can now take exams.` });
    } catch (error) {
      console.error("Error adding whitelisted user: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not whitelist user.' });
    }
  };

  const handleRemoveWhitelistedUser = async (userId: string) => {
    if (!user || !user.uid) return;
    const userToRemove = whitelistedUsers.find(u => u.id === userId);
    if (!userToRemove) return;
    try {
      await deleteDoc(doc(db, 'whitelistedUsers', userId));
      setWhitelistedUsers(prev => prev.filter(user => user.id !== userId));
      toast({ title: 'User Removed', description: `${userToRemove.email} removed from whitelist.` });
    } catch (error) {
      console.error("Error removing whitelisted user: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not remove user from whitelist.' });
    }
  };

  const handleScheduleExam = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.uid) return;
    if (!newExamName.trim() || !newExamTime.trim() || newExamDuration <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Exam Details', description: 'Please fill all fields correctly.' });
      return;
    }
    try {
      const examData = {
        name: newExamName.trim(),
        scheduledTime: new Date(newExamTime).toISOString(),
        durationMinutes: newExamDuration,
        createdAt: serverTimestamp(),
        adminId: user.uid,
      };
      const docRef = await addDoc(collection(db, 'scheduledExams'), examData);
      setScheduledExams(prev => [...prev, { id: docRef.id, ...examData, createdAt: new Date() }]); 
      setNewExamName('');
      setNewExamTime('');
      setNewExamDuration(60);
      toast({ title: 'Exam Scheduled', description: `${examData.name} has been scheduled.` });
      fetchExamHistory(); // Refresh history after scheduling a new exam
    } catch (error) {
      console.error("Error scheduling exam: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not schedule exam.' });
    }
  };
  
  const handleRemoveExam = async (examId: string) => {
     if (!user || !user.uid) return;
    const examToRemove = scheduledExams.find(e => e.id === examId);
    if (!examToRemove) return;
    try {
      await deleteDoc(doc(db, 'scheduledExams', examId));
      setScheduledExams(prev => prev.filter(exam => exam.id !== examId));
      toast({ title: 'Exam Cancelled', description: `${examToRemove.name} has been removed.` });
      fetchExamHistory(); // Refresh history after removing an exam
    } catch (error) {
      console.error("Error removing exam: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not remove exam.' });
    }
  };

  const handleManualOverride = async (disqualifiedUserId: string) => {
    if (!user || !user.uid) return;
    const userToRestore = disqualifiedUsers.find(u => u.id === disqualifiedUserId);
    if (!userToRestore) return;

    try {
      await deleteDoc(doc(db, 'disqualifiedUsers', disqualifiedUserId));
      
      await addDoc(collection(db, 'activityLogs'), {
        userId: userToRestore.email,
        userUid: userToRestore.uid, 
        timestamp: new Date().toISOString(),
        activityType: 'manual-override',
        details: `Admin (${user?.email}) overrode disqualification for user ${userToRestore.email} for exam ${userToRestore.examId}.`,
        adminId: user.uid, 
        examId: userToRestore.examId,
      });
      
      const whitelistedQuery = query(collection(db, 'whitelistedUsers'), where('email', '==', userToRestore.email), where('adminId', '==', user.uid));
      const whitelistedSnapshot = await getDocs(whitelistedQuery);
      if (whitelistedSnapshot.empty) {
        await addDoc(collection(db, 'whitelistedUsers'), {
          email: userToRestore.email,
          addedAt: serverTimestamp(),
          adminId: user.uid, 
        });
         toast({ title: 'Disqualification Overridden', description: `User ${userToRestore.email} is no longer disqualified and has been re-whitelisted.`});
      } else {
         toast({ title: 'Disqualification Overridden', description: `User ${userToRestore.email} is no longer disqualified.`});
      }
    } catch (error: any) {
      console.error("Error overriding disqualification: ", error);
      if (error.code === 'failed-precondition' && error.message && error.message.toLowerCase().includes('index')) {
         toast({ variant: 'destructive', title: 'Database Index Required', description: 'An operation requires a database index. Please create it in your Firebase console or contact support.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not override disqualification.' });
      }
    }
  }

  const handleSearchActivity = (e: FormEvent) => {
    e.preventDefault();
    fetchActivityLogs(searchTerm);
  }


  return (
    <div className="min-h-screen bg-secondary p-4 md:p-8">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-center">
        <Logo />
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <span className="text-sm text-muted-foreground">Logged in as: {user?.email}</span>
          <Button variant="outline" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
        </div>
      </header>
       <h1 className="text-3xl font-bold text-foreground mb-6 text-center md:text-left">Admin Portal</h1>


      <Tabs defaultValue="whitelist" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 mb-6">
          <TabsTrigger value="whitelist"><UserPlus className="mr-2 h-4 w-4" />Whitelist Users</TabsTrigger>
          <TabsTrigger value="schedule"><CalendarPlus className="mr-2 h-4 w-4" />Schedule Exams</TabsTrigger>
          <TabsTrigger value="activity"><Eye className="mr-2 h-4 w-4" />Activity Monitor</TabsTrigger>
          <TabsTrigger value="disqualified"><ShieldAlert className="mr-2 h-4 w-4" />Disqualified Users</TabsTrigger>
          <TabsTrigger value="livefeed"><Video className="mr-2 h-4 w-4" />Live Feeds</TabsTrigger>
          <TabsTrigger value="history"><HistoryIcon className="mr-2 h-4 w-4" />Exam History</TabsTrigger>
        </TabsList>

        <TabsContent value="whitelist">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><UserPlus className="mr-2" />Manage Whitelisted Users</CardTitle>
              <CardDescription>Add or remove users who are authorized to take exams you manage.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddWhitelistedUser} className="flex flex-col sm:flex-row gap-2 mb-6">
                <Input
                  type="email"
                  placeholder="Enter user email"
                  value={newWhitelistedEmail}
                  onChange={(e) => setNewWhitelistedEmail(e.target.value)}
                  className="flex-grow"
                />
                <Button type="submit">Add to Whitelist</Button>
              </form>
              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Added At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {whitelistedUsers.length > 0 ? whitelistedUsers.map(wu => (
                      <TableRow key={wu.id}>
                        <TableCell>{wu.email}</TableCell>
                        <TableCell>{wu.addedAt?.toDate ? wu.addedAt.toDate().toLocaleDateString() : 'Just now'}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action will remove {wu.email} from the whitelist for exams you manage. They will not be able to take these exams unless added again by you.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveWhitelistedUser(wu.id)}>Remove</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No users whitelisted yet for your exams.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><CalendarPlus className="mr-2" />Schedule New Exam</CardTitle>
              <CardDescription>Create and manage exam schedules for your users.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScheduleExam} className="space-y-4 mb-6">
                <div>
                  <Label htmlFor="examName">Exam Name</Label>
                  <Input id="examName" placeholder="e.g., Midterm CS101" value={newExamName} onChange={(e) => setNewExamName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="examTime">Scheduled Time</Label>
                  <Input id="examTime" type="datetime-local" value={newExamTime} onChange={(e) => setNewExamTime(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="examDuration">Duration (minutes)</Label>
                  <Input id="examDuration" type="number" value={newExamDuration} onChange={(e) => setNewExamDuration(parseInt(e.target.value))} min="1" />
                </div>
                <Button type="submit">Schedule Exam</Button>
              </form>
              <h3 className="text-lg font-semibold mb-2">Your Upcoming Exams</h3>
              <ScrollArea className="h-[300px] border rounded-md">
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam Name</TableHead>
                      <TableHead>Scheduled Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduledExams.length > 0 ? scheduledExams.sort((a,b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()).map(exam => (
                      <TableRow key={exam.id}>
                        <TableCell>{exam.name}</TableCell>
                        <TableCell>{new Date(exam.scheduledTime).toLocaleString()}</TableCell>
                        <TableCell>{exam.durationMinutes} min</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel Exam?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to cancel the exam: {exam.name}? This action cannot be undone for your scheduled exam.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep Exam</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveExam(exam.id)}>Cancel Exam</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    )) : (
                       <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No exams scheduled by you.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><Eye className="mr-2" />User Activity Monitor</CardTitle>
              <CardDescription>View user activity and system alerts for exams you manage. Search by user email.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchActivity} className="flex items-center gap-2 mb-4">
                <Input 
                  placeholder="Search by User Email..." 
                  className="max-w-sm" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button variant="outline" type="submit"><Search className="mr-2 h-4 w-4" />Search</Button>
                 <Button variant="ghost" onClick={() => { setSearchTerm(''); fetchActivityLogs(''); }}>Clear</Button>
              </form>
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User Email</TableHead>
                      <TableHead>Activity Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregatedLogs.length > 0 ? aggregatedLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                        <TableCell>{log.userId}</TableCell>
                        <TableCell>
                          <Badge variant={log.activityType.includes('warning') || log.activityType === 'disqualification' || log.activityType === 'ai-warning' ? 'destructive' : 'secondary'}>
                            {log.activityType}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{log.details}</TableCell>
                         <TableCell>{log.count > 1 ? `${log.count} times` : log.count}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No activity logs available for your exams.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disqualified">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><ShieldAlert className="mr-2" />Disqualified Users</CardTitle>
              <CardDescription>Review users automatically disqualified by the system for exams you manage.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Email</TableHead>
                      <TableHead>Exam ID</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disqualifiedUsers.length > 0 ? disqualifiedUsers.map(dqUser => (
                      <TableRow key={dqUser.id}>
                        <TableCell>{dqUser.email}</TableCell>
                        <TableCell>{dqUser.examId}</TableCell>
                        <TableCell className="max-w-xs truncate">{dqUser.disqualificationReason}</TableCell>
                        <TableCell>{new Date(dqUser.disqualificationTime).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                           <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button variant="outline" size="sm"><ListChecks className="mr-2 h-4 w-4"/>Review & Override</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Review Disqualification</AlertDialogTitle>
                                <AlertDialogDescription>
                                  User: {dqUser.email} <br/>
                                  Exam: {dqUser.examId} <br/>
                                  Reason: {dqUser.disqualificationReason} <br/> <br/>
                                  Evidence (Conceptual): {dqUser.evidence?.join(", ") || "N/A"} <br/><br/>
                                  Decide whether to override the disqualification. This action is specific to your management.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep Disqualified</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleManualOverride(dqUser.id)}>Override Disqualification</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No users currently disqualified from your exams.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="livefeed">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><Video className="mr-2" />Live User Snapshots</CardTitle>
              <CardDescription>View near real-time webcam snapshots of users currently taking exams you manage. Snapshots update every {SNAPSHOT_AND_ANALYSIS_INTERVAL_MS / 1000} second(s).</CardDescription>
            </CardHeader>
            <CardContent>
              {liveSnapshots.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  <Video className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  No users are currently taking exams or snapshots are not yet available.
                </div>
              ) : (
                <ScrollArea className="h-[600px] p-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {liveSnapshots.map(snapshot => (
                      <Card key={snapshot.id} className="overflow-hidden">
                        <CardHeader className="p-3 bg-muted/50 border-b">
                          <CardTitle className="text-sm font-medium truncate">{snapshot.userEmail}</CardTitle>
                          <CardDescription className="text-xs truncate">Exam: {snapshot.examName}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 aspect-[4/3] relative">
                          {snapshot.snapshotDataUri ? (
                            <Image
                              src={snapshot.snapshotDataUri}
                              alt={`Live snapshot of ${snapshot.userEmail}`}
                              layout="fill"
                              objectFit="cover"
                              data-ai-hint="webcam snapshot"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full bg-muted text-muted-foreground">
                              <Video className="h-8 w-8 opacity-50" />
                              <span className="ml-2">No snapshot</span>
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="p-2 text-xs text-muted-foreground border-t">
                          Last update: {snapshot.updatedAt?.toDate ? snapshot.updatedAt.toDate().toLocaleTimeString() : 'Receiving...'}
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><HistoryIcon className="mr-2" />Exam History</CardTitle>
              <CardDescription>Review past exams and their participants.</CardDescription>
            </CardHeader>
            <CardContent>
              {isFetchingExamHistory ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-12 w-12 animate-spin text-accent" />
                  <p className="ml-4 text-muted-foreground">Loading Exam History...</p>
                </div>
              ) : examHistory.length === 0 ? (
                 <div className="text-center text-muted-foreground py-10">
                  <HistoryIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  No exam history found for your account.
                </div>
              ) : (
                <ScrollArea className="h-[500px] border rounded-md">
                  <Accordion type="single" collapsible className="w-full">
                    {examHistory.map((exam) => (
                      <AccordionItem value={exam.id} key={exam.id}>
                        <AccordionTrigger className="hover:bg-muted/50 px-4 py-3">
                          <div className="flex justify-between w-full items-center">
                            <span className="font-semibold text-foreground">{exam.name}</span>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span>{new Date(exam.scheduledTime).toLocaleString()}</span>
                              <Badge variant="outline">{exam.participantCount} participant(s)</Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 py-3 bg-muted/20">
                          {exam.participants.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Participant Email</TableHead>
                                  {/* Add more participant details here if needed */}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {exam.participants.map(participant => (
                                  <TableRow key={participant.uid}>
                                    <TableCell>{participant.email}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-sm text-muted-foreground">No participants recorded for this exam.</p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <footer className="text-center text-sm text-muted-foreground py-8 mt-8">
        <p>&copy; {new Date().getFullYear()} ExamGuard Admin. All rights reserved.</p>
      </footer>
    </div>
  );
}


export default function AdminPage() {
  return (
    <AuthGuard allowedRoles={['admin']}>
      <AdminPageContent />
    </AuthGuard>
  );
}

