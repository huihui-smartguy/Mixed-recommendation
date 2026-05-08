import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportPayload, UserProfile } from '@/types';

const profile: UserProfile = {
  id: 'CUST-A',
  displayName: '客户A',
  riskLevel: 'C3',
  aum: 1_000_000,
  age: 40,
  preferenceTags: ['稳健']
};

const fakePayload: ReportPayload = {
  taskId: 'T-1',
  title: '测试报告',
  generatedAt: '2026-05-08T00:00:00.000Z',
  profileSummary: '客户A · C3',
  markdown: '# 报告',
  allocations: [{ asset: 'bond', label: '债券', weight: 100 }],
  backtest: { dates: ['2026-01'], portfolio: [100], benchmark: [100] },
  products: []
};

const submitMock = vi.fn();
const pollMock = vi.fn();

vi.mock('@/services/api', () => ({
  submitReport: (...args: unknown[]) => submitMock(...args),
  pollReportUntilDone: (...args: unknown[]) => pollMock(...args)
}));

import { useReportStore } from '@/stores/useReportStore';

describe('useReportStore', () => {
  beforeEach(() => {
    submitMock.mockReset();
    pollMock.mockReset();
    useReportStore.setState({
      task: { stage: 'idle', stageMessage: '', progress: 0 },
      form: { selectedProfileId: undefined, preferenceTags: [], intent: '' }
    });
  });

  afterEach(() => {
    useReportStore.getState().reset();
  });

  it('setForm patches form fields', () => {
    useReportStore.getState().setForm({ selectedProfileId: 'CUST-A' });
    useReportStore.getState().setForm({ intent: '生成报告' });
    expect(useReportStore.getState().form.selectedProfileId).toBe('CUST-A');
    expect(useReportStore.getState().form.intent).toBe('生成报告');
  });

  it('startGeneration drives task stages from queued → done', async () => {
    submitMock.mockResolvedValueOnce({ taskId: 'T-1' });
    pollMock.mockImplementation(async (_taskId: string, onProgress: (s: unknown) => void) => {
      onProgress({ taskId: 'T-1', stage: 'profiling', message: '画像', progress: 22 });
      onProgress({ taskId: 'T-1', stage: 'recall', message: '召回', progress: 45 });
      onProgress({
        taskId: 'T-1',
        stage: 'done',
        message: '完成',
        progress: 100,
        payload: fakePayload
      });
    });

    await useReportStore.getState().startGeneration(profile);

    const { task } = useReportStore.getState();
    expect(submitMock).toHaveBeenCalledWith('CUST-A', [], '', expect.anything());
    expect(task.stage).toBe('done');
    expect(task.progress).toBe(100);
    expect(task.payload?.taskId).toBe('T-1');
  });

  it('records an error stage when poll throws', async () => {
    submitMock.mockResolvedValueOnce({ taskId: 'T-2' });
    pollMock.mockRejectedValueOnce(new Error('boom'));
    await useReportStore.getState().startGeneration(profile);
    const { task } = useReportStore.getState();
    expect(task.stage).toBe('error');
    expect(task.error).toBe('boom');
  });

  it('returns to idle on AbortError without surfacing as error stage', async () => {
    submitMock.mockResolvedValueOnce({ taskId: 'T-3' });
    pollMock.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    await useReportStore.getState().startGeneration(profile);
    expect(useReportStore.getState().task.stage).toBe('idle');
  });

  it('cancelGeneration aborts and resets to idle', () => {
    const ctrl = new AbortController();
    useReportStore.setState({
      abortRef: ctrl,
      task: { stage: 'recall', stageMessage: '召回中', progress: 45 }
    });
    useReportStore.getState().cancelGeneration();
    expect(ctrl.signal.aborted).toBe(true);
    expect(useReportStore.getState().task.stage).toBe('idle');
  });
});
