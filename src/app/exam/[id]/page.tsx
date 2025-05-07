 async function ExamPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const examId = id;
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();
  const user = session?.user;
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>(sampleQuestions);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | undefined>(
    undefined
  );
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS); // seconds
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [questionTimeStart, setQuestionTimeStart] = useState(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualificationReason, setDisqualificationReason] = useState<
    string | null
  >(null);
  const [violationCount, setViolationCount] = useState(0);
  const [open, setOpen] = React.useState(false);

  useEffect(() => {
    if (!examId) return;

    const fetchExam = async () => {
      try {
        const examDoc = await getDoc(doc(db, 'exams', examId));

        if (examDoc.exists()) {
          const examData = examDoc.data() as Exam;
          setCurrentExam(examData);
          setTimeLeft(examData.durationMinutes * 60 || EXAM_DURATION_SECONDS);
        } else {
          toast({
            variant: 'destructive',
            title: 'Exam Not Found',
            description: 'The exam you are looking for does not exist.',
            duration: 5000,
          });
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching exam:', error);
        toast({
          variant: 'destructive',
          title: 'Error Fetching Exam',
          description: 'Failed to retrieve exam details. Please try again.',
          duration: 5000,
        });
        router.push('/dashboard');
      }
    };

    fetchExam();
  }, [examId, router, toast]);

  // Timer useEffect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (examStarted && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft((prevTimeLeft) => prevTimeLeft - 1);
        setTotalTimeSpent((prevTotalTimeSpent) => prevTotalTimeSpent + 1);
      }, 1000);
    } else if (timeLeft === 0 && examStarted) {
      handleSubmitExam();
    }

    return () => clearInterval(intervalId);
  }, [examStarted, timeLeft, handleSubmitExam]);

  // Function to handle starting the exam
  const handleStartExam = async () => {
    if (!currentExam || !user?.email) {
      toast({
        variant: 'destructive',
        title: 'Error Starting Exam',
        description:
          'Could not start the exam. Please ensure all details are loaded and you are logged in.',
        duration: 5000,
      });
      return;
    }

    // The following lines were attempting to implement the whitelist check, but were in the wrong place.
    // The logic should be implemented server-side (or using Firebase security rules) to prevent users from even seeing the exam if they are not whitelisted.

    // Right now, the exam content is loaded on the client-side, so commenting out the `toast` message will allow users to proceed even if they're not whitelisted. This is **not a secure solution** and should be addressed with proper server-side validation.

    // const whitelistedUsersRef = collection(db, 'whitelistedUsers');

    // const q = query(
    //   whitelistedUsersRef,
    //   where('email', '==', user.email),
    //   where('examId', '==', currentExam.id)
    // );

    // const querySnapshot = await getDocs(q);

    // if (querySnapshot.empty) {
    //   toast({
    //     variant: 'destructive',
    //     title: 'Not Authorized',
    //     description:
    //       'You are not whitelisted to take this exam. Please contact an administrator.',
    //     duration: 7000,
    //   });
    //   return;
    // }

    setExamStarted(true);
    setExamSubmitted(false);
    setIsDisqualified(false);
    setDisqualificationReason(null);
    setViolationCount(0);
    setTimeLeft(
      currentExam.durationMinutes * 60 || EXAM_DURATION_SECONDS
    ); // Use fetched duration
    setTotalTimeSpent(0);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setSelectedAnswer(undefined);
    setScore(0);
    setQuestionTimeStart(Date.now());
    setQuestions(sampleQuestions); // or fetch questions for currentExam.id
    await logActivity(
      'exam-start',
      `Exam started: ${currentExam.name}`,
      currentExam.id
    );
  };

  // ...
}
