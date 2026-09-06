export type ToastLevel = 'info' | 'error';

export interface Toast {
  id: number;
  message: string;
  level: ToastLevel;
  sticky: boolean;
}

let counter = 0;

class ToastStore {
  list = $state<Toast[]>([]);

  push(message: string, level: ToastLevel = 'info', sticky = false): number {
    counter += 1;
    const toast: Toast = { id: counter, message, level, sticky };
    this.list = [...this.list, toast];
    if (!sticky) setTimeout(() => this.dismiss(toast.id), 6000);
    return toast.id;
  }

  error(message: string): number {
    return this.push(message, 'error', true);
  }

  dismiss(id: number): void {
    this.list = this.list.filter((t) => t.id !== id);
  }
}

export const toasts = new ToastStore();
