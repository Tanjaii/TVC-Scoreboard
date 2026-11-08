"use client";

import { useEffect, useId, useRef, useState } from "react";

export type DropdownOption = { value: string; label: string };

type Props = {
  label: string;
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  allowCustom?: boolean;
};

export default function CustomDropdown({ label, options, value, defaultValue = "", onChange, disabled = false, name, allowCustom = false }: Props) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(defaultValue || value || "");
  const [customValue, setCustomValue] = useState(value ?? defaultValue);
  const root = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const listId = useId();
  const selectedValue = value ?? localValue;

  const selectValue = (next: string) => {
    setLocalValue(next);
    onChange?.(next);
  };

  useEffect(() => {
    if (!open) return;
    setCustomValue(selectedValue);
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>(".dropdown-trigger")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, selectedValue]);

  const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? selectedValue;

  return (
    <div className="custom-dropdown" ref={root}>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        type="button"
        className="dropdown-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            window.requestAnimationFrame(() => {
              const items = root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
              items?.[event.key === "ArrowDown" ? 0 : items.length - 1]?.focus();
            });
          }
        }}
      >
        <span>{selectedLabel || "Select…"}</span>
        <svg className="dropdown-chevron" aria-hidden="true" viewBox="0 0 16 16">
          <path d="m3 6 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div className="dropdown-panel" id={listId}>
          <div role="listbox" aria-label={`${label} options`}>
            {options.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={selectedValue === option.value}
                className="dropdown-option"
                key={option.value}
                onClick={() => {
                  selectValue(option.value);
                  setOpen(false);
                  root.current?.querySelector<HTMLButtonElement>(".dropdown-trigger")?.focus();
                }}
                onKeyDown={(event) => {
                  const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
                  const index = items.indexOf(event.currentTarget);
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
                  } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    items[event.key === "Home" ? 0 : items.length - 1]?.focus();
                  } else if (event.key === "Escape") {
                    setOpen(false);
                    root.current?.querySelector<HTMLButtonElement>(".dropdown-trigger")?.focus();
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          {allowCustom && (
            <div className="dropdown-custom">
              <span id={`${inputId}-label`}>Custom {label.toLowerCase()}</span>
              <div className="dropdown-custom-row">
                <input
                  id={inputId}
                  aria-labelledby={`${inputId}-label`}
                  maxLength={60}
                  value={customValue}
                  onChange={(event) => setCustomValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      selectValue(customValue.trim());
                      setOpen(false);
                    }
                  }}
                  placeholder="Enter a custom value"
                />
                <button
                  type="button"
                  className="dropdown-apply"
                  disabled={!customValue.trim()}
                  onClick={() => {
                    selectValue(customValue.trim());
                    setOpen(false);
                  }}
                >
                  Use
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
