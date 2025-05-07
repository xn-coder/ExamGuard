
export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  image?: string; // Optional image URL for the question
}

export interface Answer {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timeSpent: number; // in seconds
}

export interface WhitelistedUser {
  id: string; // Firestore document ID
  email: string;
  addedAt?: any; // Firebase ServerTimestamp for when the user was added
  adminId?: string; // UID of the admin who whitelisted this user
}

export interface ScheduledExam {
  id: string; // Firestore document ID
  name: string;
  scheduledTime: string; // ISO date string
  durationMinutes: number;
  createdAt?: any; // Firebase ServerTimestamp for when the exam was created
  adminId?: string; // UID of the admin who scheduled this exam
  // rules?: string; // Potential future addition
}

export type ActivityType = 'tab-switch' | 'copy-paste' | 'ai-warning' | 'disqualification' | 'exam-start' | 'exam-submit' | 'manual-override';

export interface UserActivityLog {
  id: string; // Firestore document ID
  userId: string; // user's email
  userUid: string; // user's Firebase UID
  examId: string; 
  timestamp: string; // ISO date string
  activityType: ActivityType;
  details: string;
  adminId?: string; // UID of the admin who owns the exam/user related to this log
}

export interface DisqualifiedUser {
  id: string; // Firestore document ID
  email: string;
  uid: string; // user's Firebase UID
  examId: string;
  disqualificationReason: string;
  disqualificationTime: string; // ISO date string
  evidence?: string[]; // URLs to screenshots/clips - conceptual for now
  adminId?: string; // UID of the admin whose exam this user was disqualified from
}

