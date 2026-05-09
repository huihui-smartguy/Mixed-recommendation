import { create } from 'zustand';
import type { ChatChunk, ChatMessage, Product } from '@/types';
import { chatStream } from '@/services/api';
import { checkBannedWords, maskPII } from '@/utils/compliance';
import { useProfileStore } from './useProfileStore';

interface ChatStoreState {
  messages: ChatMessage[];
  streaming: boolean;
  abortRef?: AbortController;
  selectedCompare: Product[];
  bannedHits: string[];
  send: (rawText: string) => Promise<void>;
  cancel: () => void;
  toggleCompare: (p: Product) => void;
  clearCompare: () => void;
  clearBannedHits: () => void;
  reset: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const seedAssistant = (): ChatMessage => ({
  id: uid(),
  role: 'assistant',
  createdAt: Date.now(),
  streaming: false,
  chunks: [
    {
      id: uid(),
      type: 'text',
      content:
        '您好，我是智能资产配置助手。可以试试问我：\n· "稳健型客户下半年应该怎么配？"\n· "纳指 QDII 现在还能上车吗？"\n· "金价创新高，黄金还能加仓吗？"'
    }
  ]
});

export const useChatStore = create<ChatStoreState>((set, get) => ({
  messages: [seedAssistant()],
  streaming: false,
  selectedCompare: [],
  bannedHits: [],
  reset: () => set({ messages: [seedAssistant()], selectedCompare: [], bannedHits: [] }),
  clearBannedHits: () => set({ bannedHits: [] }),
  toggleCompare: (p) =>
    set((s) => {
      const exists = s.selectedCompare.find((x) => x.code === p.code);
      if (exists) return { selectedCompare: s.selectedCompare.filter((x) => x.code !== p.code) };
      if (s.selectedCompare.length >= 4) return s;
      return { selectedCompare: [...s.selectedCompare, p] };
    }),
  clearCompare: () => set({ selectedCompare: [] }),
  cancel: () => {
    get().abortRef?.abort();
    set({ abortRef: undefined, streaming: false });
  },
  send: async (rawText) => {
    const text = rawText.trim();
    if (!text || get().streaming) return;

    const verdict = checkBannedWords(text);
    if (!verdict.ok) {
      set({ bannedHits: verdict.hits });
      return;
    }

    const masked = maskPII(text);
    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      createdAt: Date.now(),
      streaming: false,
      chunks: [{ id: uid(), type: 'text', content: masked }]
    };

    const assistantId = uid();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      createdAt: Date.now(),
      streaming: true,
      chunks: []
    };

    set((s) => ({ messages: [...s.messages, userMsg, assistantMsg], streaming: true }));

    const ctrl = new AbortController();
    set({ abortRef: ctrl });

    const appendChunk = (chunk: ChatChunk) => {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId ? { ...m, chunks: [...m.chunks, chunk] } : m
        )
      }));
    };

    const appendText = (segment: string) => {
      set((s) => ({
        messages: s.messages.map((m) => {
          if (m.id !== assistantId) return m;
          const last = m.chunks[m.chunks.length - 1];
          if (last && last.type === 'text') {
            return {
              ...m,
              chunks: [
                ...m.chunks.slice(0, -1),
                { ...last, content: (last.content ?? '') + segment }
              ]
            };
          }
          return {
            ...m,
            chunks: [...m.chunks, { id: uid(), type: 'text', content: segment }]
          };
        })
      }));
    };

    try {
      const activeProfile = useProfileStore.getState().getActive();
      for await (const evt of chatStream(masked, ctrl.signal, activeProfile)) {
        if (evt.type === 'thinking') {
          appendChunk({ id: uid(), type: 'thinking', content: evt.content });
        } else if (evt.type === 'text') {
          appendText(evt.content ?? '');
        } else if (evt.type === 'widget' && evt.data) {
          appendChunk({
            id: uid(),
            type: 'widget',
            widgetName: evt.widgetName,
            data: evt.data
          });
        } else if (evt.type === 'followup' && evt.suggestions) {
          appendChunk({ id: uid(), type: 'followup', suggestions: evt.suggestions });
        } else if (evt.type === 'trailing_rec' && evt.products) {
          appendChunk({
            id: uid(),
            type: 'trailing_rec',
            title: evt.title,
            products: evt.products
          });
        }
      }
    } catch (err) {
      const aborted =
        (err as DOMException)?.name === 'AbortError' ||
        (err as Error)?.message === 'aborted';
      if (!aborted) appendText('\n\n（生成中断，请稍后重试）');
    } finally {
      set((s) => ({
        streaming: false,
        abortRef: undefined,
        messages: s.messages.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m
        )
      }));
    }
  }
}));
