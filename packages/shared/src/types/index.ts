export interface User {
  id: number;
  username: string;
  role: UserRole;
  realName?: string;
  status: UserStatus;
  createdAt: string;
}

export type UserRole = 'TRAINER' | 'TEACHER';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface Teacher {
  id: number;
  userId: number;
  user: User;
  createdBy: number;
  createdAt: string;
}

export interface Scenario {
  id: number;
  title: string;
  category: ObjectionCategory;
  parentProfile: string;
  initialMessage: string;
  difficulty: Difficulty;
  status: ContentStatus;
  recommendedScripts?: number[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export type ObjectionCategory = 'PRICE' | 'EFFECT' | 'TIME' | 'DECISION' | 'TRUST';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ContentStatus = 'ACTIVE' | 'INACTIVE';

export interface Script {
  id: number;
  category: ObjectionCategory;
  title: string;
  content: string;
  keyPoints: string;
  status: ContentStatus;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  isFavorited?: boolean;
}

export interface Conversation {
  id: number;
  teacherId: number;
  scenarioId: number;
  scenario?: Scenario;
  status: ConversationStatus;
  finalScore?: number;
  aiReview?: AIReview;
  startedAt: string;
  endedAt?: string;
}

export type ConversationStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';

export interface Message {
  id: number;
  conversationId: number;
  role: MessageRole;
  content: string;
  messageType: MessageType;
  createdAt: string;
}

export type MessageRole = 'TEACHER' | 'AI';
export type MessageType = 'TEXT' | 'VOICE';

export interface AIReview {
  overallScore: number;
  overallStar: number;
  dimensions: {
    emotionComfort: ReviewDimension;
    valueDelivery: ReviewDimension;
    objectionHandling: ReviewDimension;
    closingAbility: ReviewDimension;
    compliance: ReviewDimension;
  };
  suggestions: string[];
  recommendedScripts?: number[];
}

export interface ReviewDimension {
  score: number;
  comment: string;
}

export interface TeacherStats {
  totalCount: number;
  totalDuration: number;
  coveredScenarios: number;
  categoryBreakdown: Record<ObjectionCategory, number>;
  averageScore: number;
  highestScore: number;
}

export interface ApiResponse<T> {
  code: number;
  data?: T;
  message?: string;
}
