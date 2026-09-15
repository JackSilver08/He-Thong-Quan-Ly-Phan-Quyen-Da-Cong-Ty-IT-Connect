'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, errorMessage } from './api';
import { useToast } from '@/components/ui/Toast';

/** Tải một danh sách `{ data: T[] }` từ API, báo lỗi bằng toast. `reload()` trả về true nếu tải thành công. */
export function useList<T>(path: string) {
  const toast = useToast();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await api<{ data: T[] }>(path);
      setData(res.data ?? []);
      return true;
    } catch (err) {
      // 401 đã tự chuyển về trang đăng nhập.
      if (!(err instanceof ApiError && err.status === 401)) toast.error('Không tải được dữ liệu', errorMessage(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, [path, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, reload };
}

type Errors<T> = Partial<Record<keyof T, string>>;

/** Trạng thái form trong popup: giá trị, lỗi từng ô và cờ đang gửi. */
export function useForm<T extends object>(initial: T) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [busy, setBusy] = useState(false);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }, []);

  const reset = useCallback((next: T) => {
    setValues(next);
    setErrors({});
    setBusy(false);
  }, []);

  /** Nhận thông báo lỗi cho từng ô (falsy = hợp lệ); focus vào ô lỗi đầu tiên. */
  const validate = (rules: Partial<Record<keyof T, string | false | null | undefined>>) => {
    const next: Errors<T> = {};
    for (const key of Object.keys(rules) as Array<keyof T>) {
      const message = rules[key];
      if (typeof message === 'string' && message) next[key] = message;
    }
    setErrors(next);
    const valid = Object.keys(next).length === 0;
    if (!valid) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.modal .is-invalid :is(input, select, textarea)')?.focus());
    }
    return valid;
  };

  return { values, set, errors, busy, setBusy, reset, validate };
}
