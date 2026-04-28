import React, { createContext, useContext, useRef, useState } from 'react';
import { AlertTriangle, Trash2, HelpCircle, Info, CheckCircle, Shield } from 'lucide-react';

const AlertContext = createContext(null);

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
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
    confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    confirmClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
  default: {
    icon: HelpCircle,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    confirmClass: 'bg-gray-800 hover:bg-gray-900 text-white',
  },
};

function DialogShell({ children, onBackdropClick }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onBackdropClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: 'saDialogIn 140ms ease-out both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes saDialogIn {
            from { opacity: 0; transform: scale(0.95); }
            to   { opacity: 1; transform: scale(1); }
          }
        `}</style>
        {children}
      </div>
    </div>
  );
}

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
            <h3 className="text-base font-semibold text-gray-900 leading-tight">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-w-[80px]"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors min-w-[80px] ${v.confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </DialogShell>
  );
}

function PromptDialog({ title, description, label, defaultValue = '', placeholder = '', type = 'text', confirmLabel = 'OK', cancelLabel = 'Cancel', variant = 'default', onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);
  const v = VARIANTS[variant] || VARIANTS.default;
  const Icon = v.icon;

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
            <h3 className="text-base font-semibold text-gray-900 leading-tight">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
          <input
            ref={inputRef}
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-w-[80px]"
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => onConfirm(value)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors min-w-[80px] ${v.confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </DialogShell>
  );
}

function MultiPromptDialog({ title, description, fields, confirmLabel = 'Save', cancelLabel = 'Cancel', variant = 'default', onConfirm, onCancel }) {
  const [values, setValues] = useState(() => {
    const init = {};
    fields.forEach((f) => { init[f.name] = f.defaultValue ?? ''; });
    return init;
  });
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
            <h3 className="text-base font-semibold text-gray-900 leading-tight">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              {f.label && <label className="block text-sm font-medium text-gray-700">{f.label}</label>}
              <input
                type={f.type || 'text'}
                value={values[f.name]}
                placeholder={f.placeholder || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-w-[80px]"
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => onConfirm(values)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors min-w-[80px] ${v.confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </DialogShell>
  );
}

export function AlertProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = (options) =>
    new Promise((resolve) => {
      setDialog({ type: 'confirm', options, resolve });
    });

  const prompt = (options) =>
    new Promise((resolve) => {
      setDialog({ type: 'prompt', options, resolve });
    });

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
