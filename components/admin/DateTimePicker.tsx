"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  label: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  disabled?: boolean;
  name?: string;
};

const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pad = (value: number) => String(value).padStart(2, "0");

function formatValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString(undefined, { month: "short" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${weekday}, ${day} ${month} · ${time}`;
}

function hour12(date: Date) {
  return date.getHours() % 12 || 12;
}

function withTime(date: Date, hour: number, minute: number, period: "AM" | "PM") {
  const next = new Date(date);
  next.setHours((hour % 12) + (period === "PM" ? 12 : 0), minute, 0, 0);
  return next;
}

export default function DateTimePicker({ label, value, defaultValue = null, onChange, disabled = false, name }: Props) {
  const [open, setOpen] = useState(false);
  const [workingDate, setWorkingDate] = useState<Date | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [clockMode, setClockMode] = useState<"hour" | "minute">("hour");
  const [localValue, setLocalValue] = useState<string | null>(defaultValue);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const selectedValue = value === undefined ? localValue : value;

  const updateValue = (next: string | null) => {
    setLocalValue(next);
    onChange?.(next);
  };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const begin = () => {
    const date = selectedValue ? new Date(selectedValue) : new Date();
    setWorkingDate(date);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setClockMode("hour");
    setOpen(true);
  };

  const commit = (date: Date) => {
    setWorkingDate(date);
    updateValue(date.toISOString());
  };

  const period = workingDate && workingDate.getHours() >= 12 ? "PM" : "AM";
  const startDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dateCells = Array.from({ length: 42 }, (_, index) => {
    const day = index - startDay + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const clockItems = clockMode === "hour" ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.from({ length: 12 }, (_, i) => i * 5);
  const handAngle = clockMode === "hour" ? (hour12(workingDate ?? new Date()) % 12) * 30 : (workingDate?.getMinutes() ?? 0) * 6;

  return (
    <div className="datetime-picker" ref={root}>
      {name && <input type="hidden" name={name} value={selectedValue ?? ""} />}
      <button
        type="button"
        className="dropdown-trigger datetime-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : begin()}
      >
        <span>{formatValue(selectedValue) || "Choose date and time"}</span>
        <svg className={`dropdown-chevron${open ? " is-open" : ""}`} aria-hidden="true" viewBox="0 0 16 16">
          <path d="m3 6 5 5 5-5" />
        </svg>
      </button>
      {open && workingDate && (
        <div className="datetime-panel" id={panelId} role="dialog" aria-label={`${label} picker`}>
          <section className="calendar-pane" aria-label="Calendar">
            <div className="calendar-heading">
              <button type="button" className="calendar-nav" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
              <strong>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
              <button type="button" className="calendar-nav" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
            </div>
            <div className="calendar-grid" role="grid" aria-label={month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}>
              {weekDays.map((day) => <span className="calendar-weekday" key={day} role="columnheader">{day}</span>)}
              {dateCells.map((day, index) => {
                const isSelected = day !== null && workingDate.getFullYear() === month.getFullYear()
                  && workingDate.getMonth() === month.getMonth() && workingDate.getDate() === day;
                return day === null
                  ? <span className="calendar-empty" key={`empty-${index}`} role="gridcell" />
                  : (
                    <button
                      type="button"
                      role="gridcell"
                      aria-label={new Date(month.getFullYear(), month.getMonth(), day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      aria-selected={isSelected}
                      className={`calendar-day${isSelected ? " is-selected" : ""}`}
                      key={day}
                      onClick={() => {
                        const next = new Date(workingDate);
                        next.setFullYear(month.getFullYear(), month.getMonth(), day);
                        commit(next);
                      }}
                    >
                      {day}
                    </button>
                  );
              })}
            </div>
          </section>

          <section className="clock-pane" aria-label="Clock">
            <div className="clock-time">
              <button type="button" className={clockMode === "hour" ? "time-part is-active" : "time-part"} onClick={() => setClockMode("hour")}>{pad(hour12(workingDate))}</button>
              <span>:</span>
              <button type="button" className={clockMode === "minute" ? "time-part is-active" : "time-part"} onClick={() => setClockMode("minute")}>{pad(workingDate.getMinutes())}</button>
            </div>
            <div className="clock-face" aria-label={clockMode === "hour" ? "Select hour" : "Select minute"}>
              <span className="clock-hand" style={{ transform: `translate(-50%, -100%) rotate(${handAngle}deg)` }} />
              <span className="clock-pin" />
              {clockItems.map((item, index) => {
                const angle = index * 30;
                const isSelected = clockMode === "hour" ? item === hour12(workingDate) : item === workingDate.getMinutes();
                return (
                  <button
                    type="button"
                    className={`clock-number${isSelected ? " is-selected" : ""}`}
                    key={item}
                    style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-68px) rotate(-${angle}deg)` }}
                    aria-label={clockMode === "hour" ? `${item} o'clock` : `${pad(item)} minutes`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (clockMode === "hour") {
                        commit(withTime(workingDate, item, workingDate.getMinutes(), period));
                        setClockMode("minute");
                      } else {
                        commit(withTime(workingDate, hour12(workingDate), item, period));
                      }
                    }}
                  >
                    {clockMode === "hour" ? item : pad(item)}
                  </button>
                );
              })}
            </div>
            <div className="ampm-toggle" role="group" aria-label="AM or PM">
              {(["AM", "PM"] as const).map((part) => (
                <button
                  type="button"
                  className={period === part ? "is-selected" : ""}
                  aria-pressed={period === part}
                  key={part}
                  onClick={() => commit(withTime(workingDate, hour12(workingDate), workingDate.getMinutes(), part))}
                >
                  {part}
                </button>
              ))}
            </div>
          </section>
          <button type="button" className="datetime-clear" onClick={() => { updateValue(null); setOpen(false); }}>Clear date and time</button>
        </div>
      )}
    </div>
  );
}
