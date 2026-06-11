/**
 * Types and Interfaces for the Quiz App
 */

export interface Category {
  id: string;
  name: string;
  description: string;
  createdAt: any; // Firestore Timestamp
  createdBy: string;
}

export interface Quiz {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  timeLimit: number; // in minutes
  questionsCount: number;
  isFree?: boolean; // opens access to non-paying users for trial
  createdAt: any; // Firestore Timestamp
  createdBy: string;
}

export interface Question {
  id?: string; // used on client side
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  createdAt?: any;
}

export interface Attempt {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  completedAt: any; // Firestore Timestamp
}
