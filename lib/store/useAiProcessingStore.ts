import { create } from 'zustand';

export type AiProcessingStatus = 
  | 'idle' 
  | 'pending' 
  | 'active_categorizing' 
  | 'active_prioritizing' 
  | 'processing_complete_pending_final_count'
  | 'completed' 
  | 'failed_categorization'
  | 'failed_prioritization'
  | 'failed_unknown';

interface AiProcessingState {
  jobId: string | null;
  processedCount: number;
  totalToProcess: number;
  status: AiProcessingStatus;
  errorMessage: string | null;
  setJob: (jobId: string, totalToProcess: number) => void;
  updateJobProgress: (processedCount: number, status: AiProcessingStatus) => void;
  completeJob: (finalProcessedCount?: number) => void;
  failJob: (status: AiProcessingStatus, message: string) => void;
  resetJob: () => void;
}

export const useAiProcessingStore = create<AiProcessingState>((set, get) => ({
  jobId: null,
  processedCount: 0,
  totalToProcess: 0,
  status: 'idle',
  errorMessage: null,
  setJob: (jobId, totalToProcess) => {
    // If there's an ongoing job different from the new one, log it or handle as needed.
    // For now, a new job replaces the old one for monitoring.
    if (get().jobId && get().jobId !== jobId && get().status !== 'completed' && get().status !== 'idle' && !get().status.startsWith('failed')) {
      console.warn(`[useAiProcessingStore] New job ${jobId} started while job ${get().jobId} was active with status ${get().status}. Monitoring switched to new job.`);
    }
    set({ 
      jobId, 
      totalToProcess, 
      processedCount: 0, 
      status: 'pending', 
      errorMessage: null 
    });
  },
  updateJobProgress: (processedCount, status) => {
    // console.log('[Store] updateJobProgress called. New Count:', processedCount, 'New Status:', status, 'Current Total:', get().totalToProcess);
    set((state) => {
      let newStatus = status;
      let newProcessedCount = Math.min(processedCount, state.totalToProcess);

      // If the incoming status from backend is one of the active/interim ones, 
      // but the count now matches total, client can mark as completed.
      if (state.totalToProcess > 0 && newProcessedCount >= state.totalToProcess && 
          (status === 'active_categorizing' || status === 'active_prioritizing' || status === 'processing_complete_pending_final_count')) {
        newStatus = 'completed';
      }
      // If backend explicitly says completed, ensure count is total.
      if (status === 'completed') {
        newProcessedCount = state.totalToProcess;
      }

      return {
        processedCount: newProcessedCount,
        status: newStatus,
        errorMessage: null,
      };
    });
  },
  completeJob: (finalProcessedCount?: number) => {
    // console.log('[Store] completeJob called. Final Count:', finalProcessedCount);
    set((state) => ({
      processedCount: finalProcessedCount !== undefined ? finalProcessedCount : state.totalToProcess,
      status: 'completed',
      errorMessage: null,
    }));
  },
  failJob: (status: AiProcessingStatus, message: string) => {
    // console.log('[Store] failJob called. Status:', status, 'Message:', message);
    set({ 
    status: status, 
    errorMessage: message 
  })},
  resetJob: () => {
    // console.log('[Store] resetJob called.');
    set({ 
    jobId: null, 
    processedCount: 0, 
    totalToProcess: 0, 
    status: 'idle', 
    errorMessage: null 
  })},
})); 