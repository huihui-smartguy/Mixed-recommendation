import { create } from 'zustand';
import { fetchProfiles } from '@/services/api';
import type { UserProfile } from '@/types';

/**
 * 当前活跃客户档案。被交互式推荐 UserProfileCard 显示，并随每次 chat 请求
 * 传给后端：
 *   - profile.id 用于 onerec 个性化召回
 *   - profile.{riskLevel, age, aum, preferenceTags} 注入 LLM prompt 做风险匹配
 */

const STORAGE_KEY = 'deeprec-active-profile-id';

interface ProfileStoreState {
  profiles: UserProfile[];
  loaded: boolean;
  loading: boolean;
  activeId?: string;
  /** 拉取画像列表（仅首次有效） */
  load: () => Promise<void>;
  setActive: (id: string) => void;
  /** 获取当前活跃画像（衍生值） */
  getActive: () => UserProfile | undefined;
}

function readStoredId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
}

export const useProfileStore = create<ProfileStoreState>((set, get) => ({
  profiles: [],
  loaded: false,
  loading: false,
  activeId: readStoredId(),
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const list = await fetchProfiles();
      set({ profiles: list, loaded: true, loading: false });
      // 若 localStorage 没有或对应 id 不在列表，用第一条兜底
      const cur = get().activeId;
      const valid = cur && list.some((p) => p.id === cur);
      if (!valid && list[0]) {
        set({ activeId: list[0].id });
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, list[0].id);
        }
      }
    } catch {
      set({ loaded: true, loading: false });
    }
  },
  setActive: (id) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, id);
    set({ activeId: id });
  },
  getActive: () => {
    const { profiles, activeId } = get();
    return profiles.find((p) => p.id === activeId);
  }
}));
