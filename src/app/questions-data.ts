import type { Question } from './types';

export const sampleQuestions: Question[] = [
  {
    id: 'q1',
    question: 'What is the capital of France?',
    options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
    correctAnswer: 'Paris',
  },
  {
    id: 'q2',
    question: 'Which planet is known as the Red Planet?',
    options: ['Earth', 'Mars', 'Jupiter', 'Saturn'],
    correctAnswer: 'Mars',
    image: 'https://picsum.photos/400/200?random=1',
  },
  {
    id: 'q3',
    question: 'What is the largest ocean on Earth?',
    options: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean'],
    correctAnswer: 'Pacific Ocean',
  },
  {
    id: 'q4',
    question: 'Who wrote "Hamlet"?',
    options: ['Charles Dickens', 'William Shakespeare', 'Leo Tolstoy', 'Mark Twain'],
    correctAnswer: 'William Shakespeare',
  },
  {
    id: 'q5',
    question: 'What is the chemical symbol for water?',
    options: ['O2', 'H2O', 'CO2', 'NaCl'],
    correctAnswer: 'H2O',
    image: 'https://picsum.photos/400/200?random=2',
  },
   {
    id: 'q6',
    question: 'What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    correctAnswer: '4',
  },
  {
    id: 'q7',
    question: 'Which of these is a primary color?',
    options: ['Green', 'Orange', 'Blue', 'Purple'],
    correctAnswer: 'Blue',
  },
  {
    id: 'q8',
    question: 'How many continents are there?',
    options: ['5', '6', '7', '8'],
    correctAnswer: '7',
  },
  {
    id: 'q9',
    question: 'What is the currency of Japan?',
    options: ['Won', 'Yuan', 'Yen', 'Dollar'],
    correctAnswer: 'Yen',
  },
  {
    id: 'q10',
    question: 'In which year did World War II end?',
    options: ['1942', '1945', '1948', '1950'],
    correctAnswer: '1945',
  },
];
