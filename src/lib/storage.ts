// 端末内（localStorage）への保存。プライベートモードなどで使えなくてもエラーにしない。

const PREFIX = 'novel-collab:';

export function loadData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveData(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 保存できなくてもゲームは続ける
  }
}
