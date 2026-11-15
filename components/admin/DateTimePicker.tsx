"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fromLagosWall, lagosNowWall, LAGOS_TZ, toLagosWall } from "@/lib/time";

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

// Everything below works on Lagos wall-clock dates: a Date whose UTC fields hold the Lagos clock reading.
const firstOfMonth = (wall: Date) => new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1));
const monthTitle = (wall: Date) => wall.toLocaleDateString("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

function formatValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const zone = { timeZone: LAGOS_TZ };
  const weekday = date.toLocaleDateString("en-GB", { ...zone, weekday: "short" });
  const day = date.toLocaleDateString("en-GB", { ...zone, day: "numeric" });
  const month = date.toLocaleDateString("en-GB", { ...zone, month: "short" });
  const time = date.toLocaleTimeString("en-GB", { ...zone, hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  return `${weekday}, ${day} ${month} · ${time}`;
}

function dayLabel(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month, day));
  const part = (opts: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
  return `${part({ weekday: "long" })}, ${day} ${part({ month: "long" })} ${year}`;
}

function hour12(wall: Date) {
  return wall.getUTCHours() % 12 || 12;
}

function withTime(wall: Date, hour: number, minute: number, period: "AM" | "PM") {
  const next = new Date(wall);
  next.setUTCHours((hour % 12) + (period === "PM" ? 12 : 0), minute, 0, 0);
  return next;
}

export default function DateTimePicker({ label, value, defaultValue = null, onChange, disabled = false, name }: Props) {
  const [open, setOpen] = useState(false);
  // The date being edited inside the panel. It only becomes the field's value when Select is pressed.
  const [workingDate, setWorkingDate] = useState<Date | null>(null);
  const [month, setMonth] = useState(() => firstOfMonth(lagosNowWall()));
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
    const date = selectedValue ? toLagosWall(selectedValue) : lagosNowWall();
    setWorkingDate(date);
    setMonth(firstOfMonth(date));
    setClockMode("hour");
    setOpen(true);
  };

  const accept = () => {
    if (workingDate) updateValue(fromLagosWall(workingDate));
    setOpen(false);
  };

  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const period = workingDate && workingDate.getUTCHours() >= 12 ? "PM" : "AM";
  const startDay = month.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const dateCells = Array.from({ length: 42 }, (_, index) => {
    const day = index - startDay + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const clockItems = clockMode === "hour" ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.from({ length: 12 }, (_, i) => i * 5);
  const handAngle = clockMode === "hour" ? (hour12(workingDate ?? lagosNowWall()) % 12) * 30 : (workingDate?.getUTCMinutes() ?? 0) * 6;

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
              <button type="button" className="calendar-nav" aria-label="Previous month" onClick={() => setMonth(new Date(Date.UTC(year, monthIndex - 1, 1)))}>‹</button>
              <strong>{monthTitle(month)}</strong>
              <button type="button" className="calendar-nav" aria-label="Next month" onClick={() => setMonth(new Date(Date.UTC(year, monthIndex + 1, 1)))}>›</button>
            </div>
            <div className="calendar-grid" role="grid" aria-label={monthTitle(month)}>
              {weekDays.map((day) => <span className="calendar-weekday" key={day} role="columnheader">{day}</span>)}
              {dateCells.map((day, index) => {
                const isSelected = day !== null && workingDate.getUTCFullYear() === year
                  && workingDate.getUTCMonth() === monthIndex && workingDate.getUTCDate() === day;
                return day === null
                  ? <span className="calendar-empty" key={`empty-${index}`} role="gridcell" />
                  : (
                    <button
                      type="button"
                      role="gridcell"
                      aria-label={dayLabel(year, monthIndex, day)}
                      aria-selected={isSelected}
                      className={`calendar-day${isSelected ? " is-selected" : ""}`}
                      key={day}
                      onClick={() => {
                        const next = new Date(workingDate);
                        next.setUTCFullYear(year, monthIndex, day);
                        setWorkingDate(next);
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
              <button type="button" className={clockMode === "minute" ? "time-part is-active" : "time-part"} onClick={() => setClockMode("minute")}>{pad(workingDate.getUTCMinutes())}</button>
            </div>
            <div className="clock-face" aria-label={clockMode === "hour" ? "Select hour" : "Select minute"}>
              <span className="clock-hand" style={{ transform: `translate(-50%, -100%) rotate(${handAngle}deg)` }} />
              <span className="clock-pin" />
              {clockItems.map((item, index) => {
                const angle = index * 30;
                const isSelected = clockMode === "hour" ? item === hour12(workingDate) : item === workingDate.getUTCMinutes();
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
                        setWorkingDate(withTime(workingDate, item, workingDate.getUTCMinutes(), period));
                        setClockMode("minute");
                      } else {
                        setWorkingDate(withTime(workingDate, hour12(workingDate), item, period));
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
                  onClick={() => setWorkingDate(withTime(workingDate, hour12(workingDate), workingDate.getUTCMinutes(), part))}
                >
                  {part}
                </button>
              ))}
            </div>
          </section>
          <div className="datetime-footer">
            <span className="datetime-zone">Lagos time</span>
            <button type="button" className="datetime-select" onClick={accept}>Select</button>
          </div>
        </div>
      )}
    </div>
  );
}
