export type CleaningState = 'CLEAN' | 'NEEDS_CLEANING' | 'IN_PROGRESS';

export interface CleaningStatus {
  roomId: string;
  room?: {
    id: string;
    name: string;
    slug: string;
  };
  state: CleaningState;
  updatedAt: string;
  updatedBy?: string;
}

export interface UpdateCleaningRequest {
  state: CleaningState;
}

export interface CleaningLog {
  id: string;
  roomId: string;
  userId: string;
  action: string;
  method: string;
  createdAt: string;
}
