export type Provider = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  bio?: string | null;
  qualifications: string;
  references?: string | null;
  sop: string;
  categories: string[];
  serviceAreas: string[];
  kycStatus: string;
  rating: number;
  reviewCount: number;
  completedJobs?: number;
  reviews?: Review[];
};

export type Review = { id: string; rating: number; emoji: string; comment: string; createdAt: string };

export type Job = {
  id: string;
  requestId: string;
  providerId: string;
  status: string;
  request: any;
};
