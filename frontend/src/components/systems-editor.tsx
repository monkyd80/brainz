"use client";

import { useEffect, useState } from "react";

const categories: Record<string, string> = { set_configuration: "Set 구성", os_type: "OS", database_type: "DB" };

function SystemOption({ name, initial, options }: { name: string; initial: string; options: string[] }) {
  const [value, setValue] = useState(initial);
  return <select name={name} value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 block h-7 w-full border-b text-sm font-normal"><option value="">선택</option>{Array.from(new Set([initial, ...options])).filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

export const SYSTEM_FIELDS = [
  ["name", "시스템명"], ["set_configuration", "Set 구성"], ["os_type", "OS"],
  ["os_version", "OS 버전"], ["database_type", "DB"], ["database_version", "DB 버전"],
  ["ip_address", "IP Address"], ["system_access_info", "시스템 접속 정보"],
  ["web_access_info", "Web 접속 정보"], ["web_port", "Web 포트"],
  ["database_port", "DB 포트"], ["dashboard_port", "Dashboard 포트"],
] as const;

export function readSystemRows(form: FormData) {
  return form.getAll("system_row").map((index) => {
    const row: Record<string, unknown> = {};
    for (const [key] of SYSTEM_FIELDS) row[key] = String(form.get(`system_row_${index}_${key}`) ?? "").trim();
    const id = Number(form.get(`system_row_${index}_id`));
    if (id) row.id = id;
    return row;
  }).filter((row) => SYSTEM_FIELDS.some(([key]) => row[key] !== "")).map((row) => ({
    ...row, name: row.name || row.set_configuration || "시스템",
    database_port: row.database_port === "" ? null : Number(row.database_port),
  }));
}

export function SystemsEditor({ initial }: { initial?: string }) {
  const [options, setOptions] = useState<{ category: string; value: string }[]>([]);
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"}/lookup-options/`, { headers: { Authorization: `Token ${localStorage.getItem("kdy_auth_token")}` } })
      .then((response) => response.ok ? response.json() : []).then((data) => setOptions(Array.isArray(data) ? data : data.results ?? [])).catch(() => setOptions([]));
  }, []);
  const [rows, setRows] = useState<{ key: number; data: Record<string, unknown> }[]>(() => {
    const values: Record<string, unknown>[] = initial ? JSON.parse(initial) : [];
    return (values.length ? values : [{}]).map((data, key) => ({ key, data }));
  });
  const [nextKey, setNextKey] = useState(rows.length);
  return <section className="bg-white p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">시스템 구성</h3><button type="button" aria-label="시스템 정보 추가" onClick={() => { setRows([...rows, { key: nextKey, data: {} }]); setNextKey(nextKey + 1); }} className="rounded border px-3 py-1 text-sm">+ 추가</button></div>
    <div className="space-y-3">{rows.map(({ key, data }, index) => <div key={key} className="rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="system_row" value={key} /><input type="hidden" name={`system_row_${key}_id`} value={String(data.id ?? "")} />
      <div className="mb-2 flex justify-between text-sm"><b>시스템 {index + 1}</b><button type="button" onClick={() => setRows(rows.filter((row) => row.key !== key))} className="rounded border px-2 py-1">삭제</button></div>
      <div className="grid grid-cols-3 gap-3">{SYSTEM_FIELDS.map(([field, label]) => <label key={field} className="min-w-0 text-xs font-semibold text-slate-600">{label}{categories[field] ? <SystemOption name={`system_row_${key}_${field}`} initial={String(data[field] ?? "")} options={options.filter((option) => option.category === categories[field]).map((option) => option.value)} /> : field === "database_port" ? <input type="number" min={0} name={`system_row_${key}_${field}`} defaultValue={String(data[field] ?? "")} className="mt-1 block h-7 w-full border-b text-sm font-normal" /> : <textarea rows={1} name={`system_row_${key}_${field}`} defaultValue={String(data[field] ?? "")} className="mt-1 block h-7 min-h-7 w-full resize-y border-b text-sm font-normal" />}</label>)}</div>
    </div>)}</div>
  </section>;
}
