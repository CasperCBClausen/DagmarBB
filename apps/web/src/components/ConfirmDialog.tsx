import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' = red confirm button (deletions). 'warning' = amber icon, primary button (proceed-with-caution). */
  variant?: 'danger' | 'warning';
}

interface DialogState extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

export function useConfirm() {
  const { t } = useTranslation();
  const [state, setState] = React.useState<DialogState | null>(null);

  const confirm = React.useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => setState({ ...options, resolve }));
  }, []);

  const handleConfirm = React.useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = React.useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const dialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel ?? (state.variant === 'danger' ? t('common.delete') : t('common.confirm'))}
      cancelLabel={state.cancelLabel ?? t('common.cancel')}
      variant={state.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, dialog };
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel }: ConfirmDialogProps) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  const iconBg = variant === 'danger' ? '#fef2f2' : '#fffbeb';
  const iconColor = variant === 'danger' ? '#ef4444' : '#f59e0b';
  const icon = variant === 'danger' ? '🗑' : '⚠';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: '10px',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          maxWidth: '420px',
          width: '100%',
          padding: '2rem',
          animation: 'dialogIn 0.15s ease',
        }}
      >
        {/* Icon */}
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          backgroundColor: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.375rem',
          marginBottom: '1.25rem',
        }}>
          <span style={{ color: iconColor }}>{icon}</span>
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.25rem',
          color: 'var(--color-text)',
          marginBottom: '0.625rem',
        }}>
          {title}
        </h2>

        {/* Message */}
        <p style={{
          color: '#666',
          fontSize: '0.9375rem',
          lineHeight: 1.6,
          marginBottom: '1.75rem',
        }}>
          {message}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn-secondary" style={{ fontSize: '0.9375rem' }}>
            {cancelLabel}
          </button>
          {variant === 'danger' ? (
            <button
              onClick={onConfirm}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                padding: '0.5rem 1.25rem',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.9375rem',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#dc2626')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ef4444')}
            >
              {confirmLabel}
            </button>
          ) : (
            <button onClick={onConfirm} className="btn-primary" style={{ fontSize: '0.9375rem' }}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dialogIn {
          from { opacity: 0; transform: scale(0.96) translateY(-6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}
