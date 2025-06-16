export interface UserScore {
  userId: string;
  totalScore: number;
  evaluationCount: number;
  lastUpdated: {
    _seconds: number;
    _nanoseconds: number;
  };
  breakdown: {
    technicalAdvice: number;
    problemSolving: number;
    feasibility: number;
    communication: number;
    deliverables: number;
    penalties: number;
  };
}

export interface Thread {
  id: string;
  channelId: string;
  channelName: string;
  messageCount: number;
  participantCount: number;
  participants: string[];
  startTime: {
    _seconds: number;
    _nanoseconds: number;
  };
  endTime: {
    _seconds: number;
    _nanoseconds: number;
  };
  messages: Message[];
  evaluatedAt?: {
    _seconds: number;
    _nanoseconds: number;
  };
  evaluationId?: string;
}

export interface Message {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: {
    _seconds: number;
    _nanoseconds: number;
  };
  attachments: number;
  mentions: string[];
  isReply: boolean;
}

export interface Evaluation {
  id: string;
  threadId: string;
  evaluation: {
    participants: {
      [userId: string]: {
        score: number;
        technicalAdvice: number;
        problemSolving: number;
        feasibility: number;
        communication: number;
        deliverables: number;
        penalties: number;
        comments: string[];
      };
    };
    summary: string;
    highlights: string[];
    concerns: string[];
    totalScore: number;
  };
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  };
}

export interface Summary {
  id: string;
  statistics: {
    totalEvaluations: number;
    totalUsers: number;
    topContributors: UserScore[];
    averageScore: number;
    totalScore: number;
  };
  aiSummary: string;
  evaluationCount: number;
  periodStart: {
    _seconds: number;
    _nanoseconds: number;
  };
  periodEnd: {
    _seconds: number;
    _nanoseconds: number;
  };
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  };
}