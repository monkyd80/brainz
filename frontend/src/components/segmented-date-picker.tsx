"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Part = "year" | "month" | "day";

export function SegmentedDatePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [year, month, day] = value.split("-").map(Number);
  const [part, setPart] = useState<Part | null>(null);
  const [yearBase, setYearBase] = useState(year - 5);
  const [view, setView] = useState({ year, month });
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeButton = useRef<HTMLButtonElement | null>(null);

  const close = () => { setPart(null); activeButton.current?.focus(); };
  useEffect(() => {
    if (!part) return;
    const outside = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) setPart(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setPart(null); activeButton.current?.focus(); } };
    const move = (event: Event) => { if (!panelRef.current?.contains(event.target as Node)) setPart(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", move);
    document.addEventListener("scroll", move, true);
    panelRef.current?.querySelector<HTMLButtonElement>("button[aria-pressed='true'], button:not(:disabled)")?.focus();
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", move);
      document.removeEventListener("scroll", move, true);
    };
  }, [part]);

  function open(next: Part, button: HTMLButtonElement) {
    if (part === next) { close(); return; }
    activeButton.current = button;
    const rect = triggerRef.current!.getBoundingClientRect();
    const height = 330;
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 276)), top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - height - 12)) });
    setYearBase(Math.max(1, Math.min(9988, year - 5)));
    setView({ year, month }); setPart(next);
  }
  function choose(y: number, m: number, d: number) {
    const lastDay = new Date(y, m, 0).getDate();
    onChange(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`);
    close();
  }
  const optionClass = (selected: boolean) => `rounded-md border px-2 py-2 text-xs font-medium hover:border-blue-500 hover:bg-blue-600 hover:text-white ${selected ? "border-blue-300 bg-blue-50 text-blue-700" : "border-transparent text-slate-600"}`;
  const navClass = "grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-600 disabled:opacity-30";
  const lastDay = new Date(view.year, view.month, 0).getDate();
  const weekday = new Date(view.year, view.month - 1, 1).getDay();
  function shiftMonth(offset: number) {
    const next = new Date(view.year, view.month - 1 + offset, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() + 1 });
  }

  return <div data-date-picker className="min-w-0">
    <p className="mb-1 text-[11px] font-semibold text-slate-500">{label}</p>
    <div ref={triggerRef} className="flex items-center justify-center rounded-lg border border-slate-300 bg-white px-1 py-1.5">
      {([['year', `${year}년`], ['month', `${String(month).padStart(2, '0')}월`], ['day', `${String(day).padStart(2, '0')}일`]] as [Part, string][]).map(([key, text]) => <button key={key} type="button" onClick={event => open(key, event.currentTarget)} aria-label={`${label} ${key === 'year' ? '연도' : key === 'month' ? '월' : '일'} 선택`} aria-expanded={part === key} aria-haspopup="dialog" className={`rounded px-1 py-1 text-[11px] hover:bg-blue-50 hover:text-blue-700 ${part === key ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700'}`}>{text}</button>)}
    </div>
    {part && createPortal(<div ref={panelRef} data-date-picker role="dialog" aria-label={`${label} ${part === 'year' ? '연도' : part === 'month' ? '월' : '일'} 선택`} style={position} className="fixed z-[80] max-h-[calc(100dvh-24px)] w-[264px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="mb-3 flex items-center justify-between"><b className="text-sm text-slate-700">{label} · {part === 'year' ? '연도 선택' : part === 'month' ? '월 선택' : '날짜 선택'}</b><button type="button" onClick={close} aria-label="날짜 선택 닫기" className="grid h-7 w-7 place-items-center rounded-full text-lg text-slate-500 hover:bg-slate-100">×</button></div>
      {part === 'year' && <><div className="mb-2 flex items-center justify-between"><button type="button" disabled={yearBase <= 1} onClick={() => setYearBase(Math.max(1, yearBase - 12))} aria-label="이전 연도 목록" className={navClass}>‹</button><span className="text-xs text-slate-500">{yearBase}–{yearBase + 11}</span><button type="button" disabled={yearBase >= 9988} onClick={() => setYearBase(Math.min(9988, yearBase + 12))} aria-label="다음 연도 목록" className={navClass}>›</button></div><div className="grid grid-cols-3 gap-1">{Array.from({ length: 12 }, (_, index) => yearBase + index).map(y => <button key={y} type="button" aria-pressed={y === year} onClick={() => choose(y, month, day)} className={optionClass(y === year)}>{y}년</button>)}</div></>}
      {part === 'month' && <><p className="mb-2 text-center text-xs text-slate-500">{year}년</p><div className="grid grid-cols-3 gap-1">{Array.from({ length: 12 }, (_, index) => index + 1).map(m => <button key={m} type="button" aria-pressed={m === month} onClick={() => choose(year, m, day)} className={optionClass(m === month)}>{m}월</button>)}</div></>}
      {part === 'day' && <><div className="mb-3 flex items-center justify-between"><button type="button" disabled={view.year <= 1 && view.month === 1} onClick={() => shiftMonth(-1)} aria-label="이전 달" className={navClass}>‹</button><span className="text-sm font-semibold text-slate-600">{view.year}년 {view.month}월</span><button type="button" disabled={view.year >= 9999 && view.month === 12} onClick={() => shiftMonth(1)} aria-label="다음 달" className={navClass}>›</button></div><div className="grid grid-cols-7 gap-1 text-center">{'일월화수목금토'.split('').map((text, index) => <span key={text} className={`py-1 text-[11px] ${index === 0 ? 'text-red-400' : 'text-slate-400'}`}>{text}</span>)}{Array.from({ length: weekday }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: lastDay }, (_, index) => index + 1).map(d => <button key={d} type="button" aria-pressed={view.year === year && view.month === month && d === day} onClick={() => choose(view.year, view.month, d)} className={optionClass(view.year === year && view.month === month && d === day)}>{d}</button>)}</div></>}
    </div>, document.body)}
  </div>;
}
