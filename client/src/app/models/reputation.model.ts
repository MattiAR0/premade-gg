import { User } from './user.model';

export interface Reputation {
  _id: string;
  author: User;
  target: User;
  rating: number;
  comment: string;
  playedTogether: boolean;
  createdAt: string;
}

export interface ReviewEligibility {
  canReview: boolean;
  reason: 'self' | 'already_reviewed' | null;
  playedTogether: boolean;
  existingReview: Reputation | null;
}
