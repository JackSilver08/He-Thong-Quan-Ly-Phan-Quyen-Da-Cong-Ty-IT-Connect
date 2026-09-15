'use client';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { Modal } from './Modal';

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  tone?: 'danger' | 'primary';
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Hộp thoại xác nhận dạng popup, trả về Promise<boolean> thay cho window.confirm(). */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; open: boolean } | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setState({ options, open: true });
      }),
    [],
  );

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState((current) => current && { ...current, open: false });
  };

  const danger = state?.options.tone !== 'primary';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          open={state.open}
          onClose={() => close(false)}
          size="sm"
          tone={danger ? 'red' : 'blue'}
          icon={<Icon name={danger ? 'triangle-alert' : 'info'} size={22} />}
          title={state.options.title}
          description={state.options.description}
          footer={
            <>
              <Button variant="secondary" onClick={() => close(false)} data-autofocus>
                Huỷ
              </Button>
              <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {state.options.confirmText ?? 'Xác nhận'}
              </Button>
            </>
          }
        />
      )}
    </ConfirmContext.Provider>
  );
}
