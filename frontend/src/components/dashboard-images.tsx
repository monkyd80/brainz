/* eslint-disable @next/next/no-img-element -- Image blobs are fetched with the signed-in user's authorization. */
"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardImage, DashboardImageTarget, validateDashboardImage } from "@/lib/dashboard-images";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

function useImageSource(image?: DashboardImage | null, file?: File | null, thumbnail = false) {
  const imageId = image?.id;
  const key = file ? `local:${file.name}:${file.size}:${file.lastModified}` : image ? `${image.id}:${image.uploaded_at}:${thumbnail}` : "";
  const [state, setState] = useState({ key: "", url: "", error: "" });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let url = "";
    let active = true;
    async function load() {
      try {
        let blob: Blob;
        if (file) blob = file;
        else {
          const response = await fetch(`${API}/dashboard-images/${imageId}/${thumbnail ? "thumbnail" : "content"}/`, { signal: controller.signal, headers: { Authorization: `Token ${localStorage.getItem("kdy_auth_token")}` } });
          if (!response.ok) throw new Error("대시보드 이미지를 불러오지 못했습니다.");
          blob = await response.blob();
        }
        if (!active) return;
        url = URL.createObjectURL(blob);
        setState({ key, url, error: "" });
      } catch (e) {
        if (active) setState({ key, url: "", error: e instanceof Error ? e.message : "이미지를 불러오지 못했습니다." });
      }
    }
    void load();
    return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [key, imageId, file, thumbnail]);
  return state.key === key ? state : { key, url: "", error: "" };
}

function DashboardImageDisplay({ image, file, thumbnail = false, alt, className }: { image?: DashboardImage | null; file?: File | null; thumbnail?: boolean; alt: string; className: string }) {
  const { url, error } = useImageSource(image, file, thumbnail);
  if (error) return <span role="alert" className="p-3 text-xs text-red-600">{error}</span>;
  return url ? <img src={url} alt={alt} className={className} /> : <span className="p-3 text-xs text-slate-500">이미지 불러오는 중…</span>;
}

export function DashboardImageModal({ target, onClose }: { target: DashboardImageTarget; onClose: () => void }) {
  const modal = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === "Tab") {
        const elements = modal.current?.querySelectorAll<HTMLElement>('button, [href], [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown, true); previous?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={modal} role="dialog" aria-modal="true" aria-label={`${target.name} 대시보드 이미지`} className="flex max-h-[94vh] w-full max-w-7xl flex-col rounded-2xl bg-white p-4 shadow-2xl">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-4"><h2 className="text-lg font-bold text-slate-800">{target.name} · 대시보드</h2><button ref={close} type="button" onClick={onClose} aria-label="대시보드 닫기" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-2xl text-slate-700 hover:bg-red-50 hover:text-red-600">×</button></div>
      <div tabIndex={0} className="flex min-h-32 min-w-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-slate-100 p-2"><DashboardImageDisplay image={target.image} file={target.file} alt={`${target.name} 대시보드 원본`} className="max-h-[80vh] max-w-full object-contain" /></div>
    </div>
  </div>;
}

export function DashboardImageUploader({ current, file, onChange, readOnly = false, busy = false, removed = false, onDeleteCurrent, onUndoDelete }: { current?: DashboardImage | null; file: File | null; onChange: (file: File | null) => void; readOnly?: boolean; busy?: boolean; removed?: boolean; onDeleteCurrent?: () => void; onUndoDelete?: () => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  return <div className="mt-3 space-y-2 font-normal">
    {!readOnly && <><input ref={picker} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="대시보드 이미지 선택" disabled={busy} className="hidden" onChange={event => {
      const selected = event.target.files?.[0]; event.target.value = "";
      if (!selected) return;
      try { validateDashboardImage(selected); setError(""); onChange(selected); }
      catch (e) { setError(e instanceof Error ? e.message : "이미지를 선택하지 못했습니다."); }
    }} /><button type="button" onClick={() => picker.current?.click()} disabled={busy} className="rounded border border-blue-300 bg-white px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white disabled:opacity-50">이미지 등록</button><p className="text-[10px] text-slate-500">이미지 1장 · 최대 5MB</p></>}
    {(file || current) && <><button type="button" onClick={() => setPreview(true)} aria-label="대시보드 이미지 미리보기" className="flex w-full items-center justify-center overflow-hidden rounded border border-slate-200 bg-white"><DashboardImageDisplay image={current} file={file} thumbnail alt="등록한 대시보드" className="max-h-16 w-full object-contain" /></button><p className="max-w-full break-all text-[10px] text-slate-500">{file?.name ?? current?.original_name}{file && " (저장 대기)"}</p>{file && !readOnly && <button type="button" disabled={busy} onClick={() => onChange(null)} className="text-[10px] text-red-600 hover:underline">선택 취소</button>}</>}
    {current && !file && !readOnly && onDeleteCurrent && <button type="button" disabled={busy} onClick={() => { setPreview(false); onDeleteCurrent(); }} aria-label="등록된 대시보드 이미지 삭제" className="rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:border-red-400 hover:bg-red-50 disabled:opacity-50">삭제</button>}
    {removed && <div role="status" className="space-y-1 text-[10px] text-red-600"><p>이미지 삭제 예정<br />확인을 누르면 반영됩니다.</p>{!readOnly && onUndoDelete && <button type="button" disabled={busy} onClick={onUndoDelete} className="text-slate-600 underline">삭제 취소</button>}</div>}
    {error && <p role="alert" className="text-[10px] text-red-600">{error}</p>}
    {preview && <DashboardImageModal target={{ name: "등록 이미지", image: current, file }} onClose={() => setPreview(false)} />}
  </div>;
}

function DashboardThumbnail({ image, name }: { image: DashboardImage; name: string }) {
  const container = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return <span ref={container} className="flex h-24 w-48 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">{visible ? <DashboardImageDisplay image={image} thumbnail alt={`${name} 대시보드 작은 이미지`} className="h-full w-full object-contain" /> : <span className="text-xs text-slate-400">대시보드 이미지</span>}</span>;
}

export function DashboardImageGallery({ sites, onPreview }: { sites: { id: number; name: string; dashboard_image?: DashboardImage | null }[]; onPreview: (target: DashboardImageTarget) => void }) {
  const [query, setQuery] = useState("");
  const registered = sites.filter(site => site.dashboard_image);
  const matching = registered.filter(site => site.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">대시보드 이미지</h3><p className="mt-1 text-xs text-slate-500">이미지 등록 사이트 {registered.length}개 · 작은 이미지를 누르면 확대됩니다.</p></div><input type="search" aria-label="대시보드 사이트명 검색" placeholder="사이트명 검색" value={query} onChange={event => setQuery(event.target.value)} className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600" /></div>
    {matching.length ? <div className="overflow-x-auto"><table className="w-full min-w-[400px] text-sm"><thead className="border-b bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 text-left">사이트명</th><th className="w-60 px-4 py-3">대시보드</th></tr></thead><tbody className="divide-y divide-slate-100">{matching.map(site => <tr key={site.id}><td className="break-words px-4 py-4 font-semibold text-slate-800">{site.name}</td><td className="px-4 py-3"><button type="button" onClick={() => onPreview({ name: site.name, image: site.dashboard_image })} aria-label={`${site.name} 대시보드 확대`} className="mx-auto block rounded hover:ring-2 hover:ring-blue-400"><DashboardThumbnail image={site.dashboard_image!} name={site.name} /></button></td></tr>)}</tbody></table></div> : <p className="py-12 text-center text-sm text-slate-500">{registered.length ? "검색 결과가 없습니다." : "대시보드 이미지가 등록된 사이트가 없습니다."}</p>}
  </section>;
}
