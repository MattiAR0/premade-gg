import { User } from './user.model';

export interface Reputation {
  _id: string;
  author: User;
  target: User;
  rating: number;
  comment: string;
  createdAt: string;
}
