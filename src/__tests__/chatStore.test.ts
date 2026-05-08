import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatChunk, Product } from '@/types';

const sampleProduct: Product = {
  code: '000961',
  name: '天弘沪深300',
  category: '宽基指数',
  netValue: 1.62,
  changePct: 0.82,
  return1y: 12.4,
  return3y: 26.1,
  maxDrawdown: -18.2,
  sharpe: 0.74,
  sparkline: [1, 1.05, 1.1, 1.15],
  reason: '估值合理'
};

let scriptedEvents: Array<
  | { type: 'thinking'; content: string }
  | { type: 'text'; content: string }
  | { type: 'widget'; widgetName: 'FundCard'; data: Product }
> = [];
let chatStreamShouldThrow: Error | null = null;

vi.mock('@/services/api', () => ({
  chatStream: async function* () {
    if (chatStreamShouldThrow) throw chatStreamShouldThrow;
    for (const e of scriptedEvents) {
      yield {
        id: 'x',
        type: e.type,
        content: 'content' in e ? e.content : undefined,
        widgetName: 'widgetName' in e ? e.widgetName : undefined,
        data: 'data' in e ? e.data : undefined
      } as ChatChunk;
    }
  }
}));

import { useChatStore } from '@/stores/useChatStore';

describe('useChatStore', () => {
  beforeEach(() => {
    scriptedEvents = [];
    chatStreamShouldThrow = null;
    useChatStore.getState().reset();
  });

  afterEach(() => {
    useChatStore.getState().reset();
  });

  it('blocks send when banned word is detected and emits hits', async () => {
    await useChatStore.getState().send('给我一款保本产品');
    const { messages, bannedHits, streaming } = useChatStore.getState();
    expect(streaming).toBe(false);
    expect(bannedHits).toEqual(expect.arrayContaining(['保本']));
    // 仅有种子助手消息，未追加用户/助手
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
  });

  it('clearBannedHits empties the hit list', () => {
    useChatStore.setState({ bannedHits: ['保本'] });
    useChatStore.getState().clearBannedHits();
    expect(useChatStore.getState().bannedHits).toEqual([]);
  });

  it('streams a response: appends user msg + merged assistant chunks', async () => {
    scriptedEvents = [
      { type: 'thinking', content: '分析中…' },
      { type: 'text', content: 'Hello' },
      { type: 'text', content: ' world' },
      { type: 'widget', widgetName: 'FundCard', data: sampleProduct }
    ];

    await useChatStore.getState().send('稳健配置建议');
    const { messages, streaming } = useChatStore.getState();
    expect(streaming).toBe(false);
    // seed + user + assistant
    expect(messages).toHaveLength(3);
    const user = messages[1];
    const assistant = messages[2];
    expect(user.role).toBe('user');
    expect(user.chunks[0].content).toBe('稳健配置建议');

    expect(assistant.role).toBe('assistant');
    expect(assistant.streaming).toBe(false);

    const types = assistant.chunks.map((c) => c.type);
    expect(types).toEqual(['thinking', 'text', 'widget']);

    const textChunk = assistant.chunks.find((c) => c.type === 'text')!;
    expect(textChunk.content).toBe('Hello world'); // merged

    const widgetChunk = assistant.chunks.find((c) => c.type === 'widget')!;
    expect(widgetChunk.data?.code).toBe('000961');
  });

  it('masks PII in the user message before send', async () => {
    scriptedEvents = [{ type: 'text', content: 'ok' }];
    await useChatStore.getState().send('请帮我开户 13812345678 张总');
    const user = useChatStore.getState().messages[1];
    expect(user.chunks[0].content).not.toContain('13812345678');
    expect(user.chunks[0].content).toContain('手机号已脱敏');
  });

  it('toggleCompare adds, removes, caps at 4 items', () => {
    const s = useChatStore.getState();
    const mk = (code: string): Product => ({ ...sampleProduct, code });
    s.toggleCompare(mk('A'));
    s.toggleCompare(mk('B'));
    s.toggleCompare(mk('C'));
    s.toggleCompare(mk('D'));
    s.toggleCompare(mk('E')); // should be ignored (cap at 4)
    expect(useChatStore.getState().selectedCompare.map((p) => p.code)).toEqual([
      'A',
      'B',
      'C',
      'D'
    ]);
    s.toggleCompare(mk('B')); // remove B
    expect(useChatStore.getState().selectedCompare.map((p) => p.code)).toEqual([
      'A',
      'C',
      'D'
    ]);
    s.clearCompare();
    expect(useChatStore.getState().selectedCompare).toEqual([]);
  });

  it('appends an apology when the stream throws a non-abort error', async () => {
    chatStreamShouldThrow = new Error('network down');
    scriptedEvents = [];
    await useChatStore.getState().send('请帮我配置');
    const msgs = useChatStore.getState().messages;
    const assistant = msgs[msgs.length - 1];
    const text = assistant.chunks.map((c: { content?: string }) => c.content ?? '').join('');
    expect(text).toContain('生成中断');
  });

  it('does not append apology on aborted error', async () => {
    const e = new DOMException('aborted', 'AbortError');
    chatStreamShouldThrow = e;
    await useChatStore.getState().send('请帮我配置');
    const msgs = useChatStore.getState().messages;
    const assistant = msgs[msgs.length - 1];
    const text = assistant.chunks.map((c: { content?: string }) => c.content ?? '').join('');
    expect(text).not.toContain('生成中断');
  });

  it('ignores empty input', async () => {
    await useChatStore.getState().send('   ');
    expect(useChatStore.getState().messages).toHaveLength(1); // seed only
  });

  it('reset clears messages back to seed', () => {
    useChatStore.setState({
      messages: [],
      selectedCompare: [{ ...sampleProduct }],
      bannedHits: ['x']
    });
    useChatStore.getState().reset();
    const s = useChatStore.getState();
    expect(s.messages).toHaveLength(1);
    expect(s.selectedCompare).toEqual([]);
    expect(s.bannedHits).toEqual([]);
  });
});
