const STYLE_ID = 'nodevision-input-dialog-styles';

function ensureDialogStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.nodevision-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 9999;
}

.nodevision-dialog-overlay:focus {
  outline: none;
}

.nodevision-dialog {
  width: min(420px, calc(100% - 32px));
  background: #0f1114;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
  padding: 24px;
  color: #f7f7f7;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.nodevision-dialog-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.nodevision-dialog-description {
  margin: 6px 0 16px;
  color: #c7c7c7;
  font-size: 0.9rem;
  line-height: 1.4;
}

.nodevision-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nodevision-dialog input {
  font: inherit;
  font-size: 1rem;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
  color: #f7f7f7;
}

.nodevision-dialog input:focus {
  outline: 2px solid rgba(255, 255, 255, 0.45);
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
}

.nodevision-dialog-error {
  min-height: 18px;
  color: #ffbaba;
  font-size: 0.85rem;
  margin-bottom: 0;
}

.nodevision-dialog-error.hidden {
  visibility: hidden;
}

.nodevision-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.nodevision-dialog button {
  font: inherit;
  border-radius: 8px;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  transition: transform 0.12s ease;
}

.nodevision-dialog button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.nodevision-dialog button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.nodevision-dialog button.secondary {
  background: rgba(255, 255, 255, 0.12);
  color: #f7f7f7;
}

.nodevision-dialog button.primary {
  background: #0a84ff;
  color: #fff;
}

@media (prefers-reduced-motion: reduce) {
  .nodevision-dialog button:hover:not(:disabled) {
    transform: none;
  }
}
  `;

  const head = document.head || document.body;
  head.appendChild(style);
}

const defaultOptions = {
  title: 'Enter value',
  description: '',
  placeholder: '',
  defaultValue: '',
  confirmText: 'OK',
  cancelText: 'Cancel',
  allowEmpty: false,
  inputType: 'text',
  returnTrimmed: true,
  closeOnOutsideClick: true,
  closeOnEscape: true,
  selectOnFocus: true,
  emptyMessage: 'Please enter a value.',
  invalidMessage: 'Please provide a valid value.',
  validator: null,
  container: null,
  ariaLabel: '',
};

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function showInputDialog(customOptions = {}) {
  ensureDialogStyles();

  const options = { ...defaultOptions, ...customOptions };
  const host = options.container ?? document.body;
  if (!host) {
    throw new Error('Document body is not available to render the dialog.');
  }

  return new Promise((resolve) => {
    let settled = false;

    const overlay = document.createElement('div');
    overlay.className = 'nodevision-dialog-overlay';
    overlay.tabIndex = -1;

    const dialog = document.createElement('div');
    dialog.className = 'nodevision-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    if (options.ariaLabel) {
      dialog.setAttribute('aria-label', options.ariaLabel);
    }

    const headerId = createId('nodevision-dialog-title');
    if (options.title) {
      const header = document.createElement('h2');
      header.className = 'nodevision-dialog-title';
      header.id = headerId;
      header.textContent = options.title;
      dialog.appendChild(header);
      dialog.setAttribute('aria-labelledby', headerId);
    }

    const descId = createId('nodevision-dialog-desc');
    if (options.description) {
      const description = document.createElement('p');
      description.className = 'nodevision-dialog-description';
      description.id = descId;
      description.textContent = options.description;
      dialog.appendChild(description);
      dialog.setAttribute('aria-describedby', descId);
    }

    const form = document.createElement('form');
    form.className = 'nodevision-dialog-form';

    const inputId = createId('nodevision-dialog-input');
    const input = document.createElement('input');
    input.id = inputId;
    input.type = options.inputType;
    input.value = options.defaultValue ?? '';
    input.placeholder = options.placeholder ?? '';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', options.title || 'Input field');
    form.appendChild(input);

    const errorElement = document.createElement('div');
    errorElement.className = 'nodevision-dialog-error hidden';
    errorElement.setAttribute('role', 'alert');
    form.appendChild(errorElement);

    const actions = document.createElement('div');
    actions.className = 'nodevision-dialog-actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'secondary';
    cancelButton.textContent = options.cancelText;

    const confirmButton = document.createElement('button');
    confirmButton.type = 'submit';
    confirmButton.className = 'primary';
    confirmButton.textContent = options.confirmText;

    actions.appendChild(cancelButton);
    actions.appendChild(confirmButton);

    form.appendChild(actions);
    dialog.appendChild(form);
    overlay.appendChild(dialog);

    const cleanup = () => {
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
      document.removeEventListener('keydown', handleKeydown, true);
      input.removeEventListener('input', handleInput);
      overlay.removeEventListener('click', handleOverlayClick);
      cancelButton.removeEventListener('click', handleCancel);
      form.removeEventListener('submit', handleSubmit);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const showError = (message) => {
      if (!message) {
        errorElement.classList.add('hidden');
        errorElement.textContent = '';
        return;
      }
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    };

    const attemptSubmit = () => {
      const rawValue = input.value;
      const trimmedValue = rawValue.trim();

      if (!options.allowEmpty && trimmedValue === '') {
        showError(options.emptyMessage);
        return;
      }

      if (options.validator) {
        const validation = options.validator(rawValue, trimmedValue);
        if (typeof validation === 'string') {
          showError(validation);
          return;
        }
        if (validation === false) {
          showError(options.invalidMessage);
          return;
        }
      }

      showError('');
      const finalValue = options.returnTrimmed ? trimmedValue : rawValue;
      finish(finalValue);
    };

    const handleSubmit = (event) => {
      event.preventDefault();
      attemptSubmit();
    };

    const handleCancel = () => {
      showError('');
      finish(null);
    };

    const handleOverlayClick = (event) => {
      if (options.closeOnOutsideClick && event.target === overlay) {
        finish(null);
      }
    };

    const handleKeydown = (event) => {
      if (options.closeOnEscape && event.key === 'Escape') {
        event.preventDefault();
        finish(null);
      }
    };

    const handleInput = () => {
      if (!errorElement.classList.contains('hidden')) {
        showError('');
      }
    };

    overlay.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleKeydown, true);
    input.addEventListener('input', handleInput);
    cancelButton.addEventListener('click', handleCancel);
    form.addEventListener('submit', handleSubmit);

    const previousActiveElement = document.activeElement;

    host.appendChild(overlay);
    overlay.focus();
    if (options.selectOnFocus) {
      input.select();
    }

    setTimeout(() => {
      if (options.selectOnFocus) {
        input.select();
      }
      input.focus();
    }, 0);
  });
}
