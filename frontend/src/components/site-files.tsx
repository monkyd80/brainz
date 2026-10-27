"use client";

import { useRef, useState } from "react";
import { formatSiteFileDate, formatSiteFileSize, SiteAttachment, validateSiteFiles } from "@/lib/site-files";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export function SiteFileList({ files, pending = [], onRemove, onDelete }: { files: SiteAttachment[]; pending?: File[]; onRemove?: (index: number) => void; onDelete?: (file: SiteAttachment) => Promise<void> }) {
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const showActions = Boolean(onRemove || onDelete);
  async function deleteSavedFile(file: SiteAttachment) {
    if (!onDelete || deleting !== null) return;
    setError(""); setDeleting(file.id);
    try { await onDelete(file); }
    catch (e) { setError(e instanceof Error ? e.message : "파일을 삭제하지 못했습니다."); }
    finally { setDeleting(null); }
  }
  async function download(file: SiteAttachment) {
    setError(""); setDownloading(file.id);
    try {
      const response = await fetch(`${API}/site-files/${file.id}/download/`, { headers: { Authorization: `Token ${localStorage.getItem("kdy_auth_token")}` } });
      if (!response.ok) throw new Error("파일을 내려받지 못했습니다. 다시 시도해주세요.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = file.original_name;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "파일을 내려받지 못했습니다."); }
    finally { setDownloading(null); }
  }
  return <div>
    {files.length || pending.length ? <div className="overflow-x-auto"><table className="w-full min-w-[500px] table-fixed text-sm">
      <thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr><th className="w-1/2 px-3 py-3 text-left">이름</th><th className="px-3 py-3">업로드 날짜</th><th className="w-28 px-3 py-3">용량</th>{showActions && <th className="w-24 px-3 py-3"><span className="sr-only">파일 관리</span></th>}</tr></thead>
      <tbody className="divide-y divide-slate-100">
        {files.map(file => <tr key={file.id}><td className="px-3 py-3 text-left"><button type="button" onClick={() => void download(file)} disabled={downloading !== null || deleting !== null} title={file.original_name} className="max-w-full break-all text-left text-blue-700 hover:underline disabled:opacity-50">{downloading === file.id ? "내려받는 중…" : file.original_name}</button></td><td className="px-3 py-3 text-center text-xs text-slate-600">{formatSiteFileDate(file.uploaded_at)}</td><td className="px-3 py-3 text-center whitespace-nowrap text-slate-600">{formatSiteFileSize(file.size)}</td>{showActions && <td className="px-3 py-3">{onDelete && <div className="flex justify-end"><button type="button" onClick={() => void deleteSavedFile(file)} disabled={deleting !== null || downloading !== null} aria-label={`${file.original_name} 삭제`} className="shrink-0 whitespace-nowrap rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:border-red-400 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50">{deleting === file.id ? "삭제 중…" : "삭제"}</button></div>}</td>}</tr>)}
        {pending.map((file, index) => <tr key={`${file.name}:${file.lastModified}:${index}`} className="bg-blue-50/50">
          <td className="break-all px-3 py-3 text-left text-slate-800">{file.name}</td>
          <td className="px-3 py-3 text-center text-xs text-blue-700">저장 대기</td>
          <td className="px-3 py-3 text-center whitespace-nowrap text-slate-600">{formatSiteFileSize(file.size)}</td>
          {showActions && <td className="px-3 py-3">{onRemove && <div className="flex justify-end"><button type="button" onClick={() => onRemove(index)} aria-label={`${file.name} 삭제`} className="shrink-0 rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:border-red-400 hover:bg-red-50">삭제</button></div>}</td>}
        </tr>)}
      </tbody>
    </table></div> : <p className="py-5 text-center text-sm text-slate-500">등록된 파일이 없습니다.</p>}
    {error && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}

export function SiteFilesEditor({ existingFiles = [], files, onChange, readOnly = false, busy = false }: { existingFiles?: SiteAttachment[]; files: File[]; onChange: (files: File[]) => void; readOnly?: boolean; busy?: boolean }) {
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  function select(incoming: File[]) {
    setError("");
    try {
      validateSiteFiles(incoming);
      const next = [...files];
      for (const file of incoming) if (!next.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file);
      onChange(next);
    } catch (e) { setError(e instanceof Error ? e.message : "파일을 선택하지 못했습니다."); }
  }
  return <section aria-label="추가 정보 파일" className="mt-5 rounded-xl border border-slate-300 bg-white p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800">추가정보파일</h3><p className="mt-1 text-xs text-slate-500">파일당 최대 5MB · 여러 파일 선택 가능{!readOnly && " · 확인을 누르면 함께 저장됩니다."}</p></div>
      {!readOnly && <><input ref={picker} type="file" multiple disabled={busy} aria-label="추가 정보 파일 선택" className="hidden" onChange={event => { select(Array.from(event.target.files ?? [])); event.target.value = ""; }} /><button type="button" disabled={busy} onClick={() => picker.current?.click()} className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-600 hover:text-white disabled:opacity-50">+ 파일 선택</button></>}
    </div>
    {error && <p role="alert" className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <SiteFileList files={existingFiles} pending={files} onRemove={readOnly || busy ? undefined : index => onChange(files.filter((_, current) => current !== index))} />
  </section>;
}

export function SiteFilesPanel({ files = [], onDelete }: { files?: SiteAttachment[]; onDelete?: (file: SiteAttachment) => Promise<void> }) {
  return <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h3 className="sticky top-0 z-10 mb-3 border-b border-slate-100 bg-white py-3 font-bold">추가정보파일</h3><SiteFileList files={files} onDelete={onDelete} /></section>;
}
