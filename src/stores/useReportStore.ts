import { create } from 'zustand';
import type { ReportStage, ReportTaskState, UserProfile } from '@/types';
import { pollReportUntilDone, submitReport } from '@/services/api';

interface ReportFormState {
  selectedProfileId?: string;
  preferenceTags: string[];
  intent: string;
}

interface ReportStoreState {
  form: ReportFormState;
  task: ReportTaskState;
  abortRef?: AbortController;
  setForm: (patch: Partial<ReportFormState>) => void;
  reset: () => void;
  startGeneration: (profile: UserProfile) => Promise<void>;
  cancelGeneration: () => void;
}

const idleTask: ReportTaskState = {
  stage: 'idle',
  stageMessage: '',
  progress: 0
};

export const useReportStore = create<ReportStoreState>((set, get) => ({
  form: {
    selectedProfileId: undefined,
    preferenceTags: [],
    intent: ''
  },
  task: idleTask,
  setForm: (patch) => set((s) => ({ form: { ...s.form, ...patch } })),
  reset: () => set({ task: idleTask }),
  cancelGeneration: () => {
    const { abortRef } = get();
    abortRef?.abort();
    set({ abortRef: undefined, task: { ...idleTask, stage: 'idle' } });
  },
  startGeneration: async (profile) => {
    get().abortRef?.abort();
    const ctrl = new AbortController();
    const { form } = get();
    set({
      abortRef: ctrl,
      task: { stage: 'queued', stageMessage: '排队中…', progress: 5 }
    });
    try {
      const { taskId } = await submitReport(profile.id, form.preferenceTags, form.intent, ctrl.signal);
      set({ task: { ...get().task, taskId } });
      await pollReportUntilDone(
        taskId,
        (s) => {
          set({
            task: {
              taskId: s.taskId,
              stage: s.stage as ReportStage,
              stageMessage: s.message,
              progress: s.progress,
              payload: s.payload ?? get().task.payload,
              error: s.error
            }
          });
        },
        ctrl.signal
      );
    } catch (err) {
      const aborted =
        (err as DOMException)?.name === 'AbortError' ||
        (err as Error)?.message === 'aborted';
      set({
        task: {
          stage: aborted ? 'idle' : 'error',
          stageMessage: aborted ? '已取消' : '生成失败，请重试',
          progress: 0,
          error: aborted ? undefined : (err as Error).message
        }
      });
    } finally {
      set({ abortRef: undefined });
    }
  }
}));
