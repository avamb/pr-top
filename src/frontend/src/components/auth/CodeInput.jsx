import React, { useEffect, useRef } from 'react';

const CODE_LENGTH = 6;

/**
 * CodeInput — six single-digit cells for the login-code flow.
 *
 * Props:
 *   value       string  current code, 0-6 digits (e.g. "12" while typing)
 *   onChange(next: string)   called whenever the composed value changes
 *   onComplete(code: string) called once when the code reaches 6 digits
 *   disabled    bool    disable all cells (e.g. while verifying or CODE_LOCKED)
 *   error       bool    show error styling (red borders)
 *   autoFocus   bool    focus the first cell on mount (default true)
 *
 * Spec: docs/security/SPEC_ANTIBOT_WAVES.md, Трек 2D, п.2.
 */
export default function CodeInput({ value = '', onChange, onComplete, disabled = false, error = false, autoFocus = true }) {
  const inputRefs = useRef([]);
  const firedCompleteRef = useRef(false);
  const prevValueRef = useRef(value);

  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value.length === CODE_LENGTH) {
      if (!firedCompleteRef.current) {
        firedCompleteRef.current = true;
        onComplete?.(value);
      }
    } else {
      firedCompleteRef.current = false;
    }
  }, [value, onComplete]);

  // Refocus the first cell once the code is cleared out from under the user
  // (e.g. the parent resets `value` to '' after a CODE_INVALID response) -
  // without this the focus is left sitting in the last (now empty) cell.
  useEffect(() => {
    if (prevValueRef.current !== '' && value === '') {
      inputRefs.current[0]?.focus();
    }
    prevValueRef.current = value;
  }, [value]);

  function setDigitAt(index, digit) {
    const next = digits.slice();
    next[index] = digit;
    onChange?.(next.join('').slice(0, CODE_LENGTH));
  }

  // Shared by handleChange (multi-char autofill landing in one cell) and
  // handlePaste: distribute digits starting at `index`, overflow fills to
  // the end and moves focus to the last cell.
  function distributeFrom(index, onlyDigits) {
    if (onlyDigits.length >= CODE_LENGTH) {
      const composed = onlyDigits.slice(0, CODE_LENGTH);
      onChange?.(composed);
      inputRefs.current[CODE_LENGTH - 1]?.focus();
      return;
    }
    const next = digits.slice();
    for (let i = 0; i < onlyDigits.length && index + i < CODE_LENGTH; i++) {
      next[index + i] = onlyDigits[i];
    }
    const composed = next.join('').slice(0, CODE_LENGTH);
    onChange?.(composed);
    const focusIndex = Math.min(index + onlyDigits.length, CODE_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  function handleChange(index, e) {
    const raw = e.target.value;
    const onlyDigits = raw.replace(/\D/g, '');
    if (!onlyDigits) {
      setDigitAt(index, '');
      return;
    }
    if (onlyDigits.length > 1) {
      // Mobile OTP autofill (or a fast paste caught by onChange instead of
      // onPaste) can deliver all 6 digits into a single cell - distribute
      // them from the current index exactly like a paste, instead of
      // silently keeping only the last digit.
      distributeFrom(index, onlyDigits);
      return;
    }
    setDigitAt(index, onlyDigits);
    if (index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        setDigitAt(index, '');
      } else if (index > 0) {
        setDigitAt(index - 1, '');
        inputRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      e.preventDefault();
    } else if (/^[0-9]$/.test(e.key) && digits[index]) {
      // Typing over an already-filled cell: let handleChange replace it,
      // but move focus forward the same way an empty cell would.
      // (No preventDefault - handleChange runs on the resulting input event.)
    } else if (!/^[0-9]$/.test(e.key) && !['Tab', 'Shift', 'Backspace', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key)) {
      e.preventDefault();
    }
  }

  function handlePaste(index, e) {
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const onlyDigits = pasted.replace(/\D/g, '');
    if (!onlyDigits) return;
    e.preventDefault();
    distributeFrom(index, onlyDigits);
  }

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label="Verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          onFocus={(e) => e.target.select()}
          className={`w-11 h-12 text-center text-xl font-semibold border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${error ? 'border-error text-error' : 'border-gray-300'}`}
        />
      ))}
    </div>
  );
}
