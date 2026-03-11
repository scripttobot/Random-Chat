import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import AppAlert, { AppAlertConfig, AlertButton } from '@/components/ui/AppAlert';

interface AlertContextValue {
  showAlert: (config: AppAlertConfig) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
  ) => void;
  showSuccess: (title: string, message?: string, onOk?: () => void) => void;
  showError: (title: string, message?: string) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

interface QueueItem extends AppAlertConfig {
  id: number;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const [visible, setVisible] = useState(false);
  const queue = useRef<QueueItem[]>([]);
  const idRef = useRef(0);

  const processQueue = useCallback(() => {
    if (queue.current.length > 0) {
      const next = queue.current.shift()!;
      setCurrent(next);
      setVisible(true);
    }
  }, []);

  const enqueue = useCallback((config: AppAlertConfig) => {
    const item: QueueItem = { ...config, id: ++idRef.current };
    if (!visible && queue.current.length === 0) {
      setCurrent(item);
      setVisible(true);
    } else {
      queue.current.push(item);
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setCurrent(null);
      processQueue();
    }, 220);
  }, [processQueue]);

  const showAlert = useCallback((config: AppAlertConfig) => {
    enqueue(config);
  }, [enqueue]);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
  ) => {
    enqueue({
      title,
      message,
      type: options?.destructive ? 'destructive' : 'confirm',
      buttons: [
        { text: options?.cancelText || 'Cancel', style: 'cancel' },
        {
          text: options?.confirmText || 'Confirm',
          style: options?.destructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ],
    });
  }, [enqueue]);

  const showSuccess = useCallback((title: string, message?: string, onOk?: () => void) => {
    enqueue({
      title,
      message,
      type: 'success',
      buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
    });
  }, [enqueue]);

  const showError = useCallback((title: string, message?: string) => {
    enqueue({
      title,
      message,
      type: 'error',
      buttons: [{ text: 'OK', style: 'cancel' }],
    });
  }, [enqueue]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, showSuccess, showError }}>
      {children}
      {current && (
        <AppAlert
          key={current.id}
          visible={visible}
          onDismiss={handleDismiss}
          title={current.title}
          message={current.message}
          type={current.type}
          buttons={current.buttons}
          icon={current.icon}
        />
      )}
    </AlertContext.Provider>
  );
}

export function useAppAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAppAlert must be used within AlertProvider');
  return ctx;
}
