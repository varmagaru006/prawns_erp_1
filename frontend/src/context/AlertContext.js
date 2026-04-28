import React, { createContext, useContext, useRef, useState } from 'react';
import { AlertTriangle, Trash2, HelpCircle, Info, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const AlertContext = createContext(null);

// ─── variant config ────────────────────────────────────────────────────────
const VARIANTS = {
  destructive: {
    icon: Trash2,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    confirmClass: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    confirmClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
  default: {
    icon: HelpCircle,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    confirmClass: 'bg-slate-800 hover:bg-slate-900 text-white',
  },
};

// ─── Dialog shell ──────────────────────────────────────────────────────────
function DialogShell({ children, onBackdropClick }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onBackdropClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden
                   animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Confirm dialog ────────────────────────────────────────────────────────
function ConfirmDialog({ title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default', onConfirm, onCancel }) {
  const v = VARIANTS[variant] || VARIANTS.default;
  const Icon = v.icon;
  return (
    <DialogShell onBackdropClick={onCancel}>
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 rounded-full p-2.5 ${v.iconBg}`}>
            <Icon className={`h-5 w-5 ${v.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 leading-tight">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <Button variant="outline" size="sm" onClick={onCancel} className="min-w-[80px]">
          {cancelLabel}
        </Button>
        <Button size="sm" className={`min-w-[80px] ${v.confirmClass} border-0`} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </DialogShell>
  );
}

// ─── Prompt dialog ─────────────────────────────────────────────────────────
function PromptDialog({ title, description, label, defaultValue = '', placeholder = '', type = 'text', confirmLabel = 'OK', cancelLabel = 'Cancel', variant = 'default', onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);
  const v = VARIANTS[variant] || VARIANTS.default;
  const Icon = v.icon;

  // Auto-focus and select on open
  React.useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const handleKey = (e) => {
    if (e.key === 'Enter') onConfirm(value);
    if (e.key === 'Escape') onCancel();
  };

  return (
    <DialogShell onBackdropClick={onCancel}>
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 rounded-full p-2.5 ${v.iconBg}`}>
            <Icon className={`h-5 w-5 ${v.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 leading-tight">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
          <Input
            ref={inputRef}
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            className="h-10"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <Button variant="outline" size="sm" onClick={onCancel} className="min-w-[80px]">
          {cancelLabel}
        </Button>
        <Button size="sm" className={`min-w-[80px] ${v.confirmClass} border-0`} onClick={() => onConfirm(value)}>
          {confirmLabel}
        </Button>
      </div>
    </DialogShell>
  );
}

// ─── Multi-field prompt dialog ─────────────────────────────────────────────
function MultiPromptDialog({ title, description, fields, confirmLabel = 'Save', cancelLabel = 'Cancel', variant = 'default', onConfirm, onCancel }) {
  const [values, setValues] = useState(() => {
    const init = {};
    fields.forEach((f) => { init[f.name] = f.defaultValue ?? ''; });
    return init;
  });
  const v = VARIANTS[variant] || VARIANTS.default;
  const Icon = v.icon;

  const handleKey = (e) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <DialogShell onBackdropClick={onCancel}>
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 rounded-full p-2.5 ${v.iconBg}`}>
            <Icon className={`h-5 w-5 ${v.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 leading-tight">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              {f.label && <label className="text-sm font-medium text-slate-700">{f.label}</label>}
              <Input
                type={f.type || 'text'}
                value={values[f.name]}
                placeholder={f.placeholder || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                onKeyDown={handleKey}
                className="h-10"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <Button variant="outline" size="sm" onClick={onCancel} className="min-w-[80px]">
          {cancelLabel}
        </Button>
        <Button size="sm" className={`min-w-[80px] ${v.confirmClass} border-0`} onClick={() => onConfirm(values)}>
          {confirmLabel}
        </Button>
      </div>
    </DialogShell>
  );
}

// ─── Provider ──────────────────────────────────────────────────────────────
export function AlertProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  /** Imperative confirm — returns Promise<boolean> */
  const confirm = (options) =>
    new Promise((resolve) => {
      setDialog({ type: 'confirm', options, resolve });
    });

  /** Imperative single-field prompt — returns Promise<string|null> */
  const prompt = (options) =>
    new Promise((resolve) => {
      setDialog({ type: 'prompt', options, resolve });
    });

  /** Imperative multi-field prompt — returns Promise<object|null> */
  const multiPrompt = (options) =>
    new Promise((resolve) => {
      setDialog({ type: 'multiPrompt', options, resolve });
    });

  const close = () => setDialog(null);

  return (
    <AlertContext.Provider value={{ confirm, prompt, multiPrompt }}>
      {children}
      {dialog?.type === 'confirm' && (
        <ConfirmDialog
          {...dialog.options}
          onConfirm={() => { dialog.resolve(true); close(); }}
          onCancel={() => { dialog.resolve(false); close(); }}
        />
      )}
      {dialog?.type === 'prompt' && (
        <PromptDialog
          {...dialog.options}
          onConfirm={(v) => { dialog.resolve(v); close(); }}
          onCancel={() => { dialog.resolve(null); close(); }}
        />
      )}
      {dialog?.type === 'multiPrompt' && (
        <MultiPromptDialog
          {...dialog.options}
          onConfirm={(v) => { dialog.resolve(v); close(); }}
          onCancel={() => { dialog.resolve(null); close(); }}
        />
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used inside AlertProvider');
  return ctx;
}
