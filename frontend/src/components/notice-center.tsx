"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

type Notice = {
  id: number;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
};

function noticeHeaders() {
  return { Authorization: "Token " + localStorage.getItem("kdy_auth_token") };
}

const noticeDate = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export function NoticeCenter({ api, isAdmin }: { api: string; isAdmin: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const manuallyOpened = useRef(false);
  const readIds = useRef(new Set<number>());
  const [view, setView] = useState<"list" | "detail" | "create" | "edit" | null>(null);
  const [current, setCurrent] = useState<Notice | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [readingAll, setReadingAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const editingNotice = view === "edit" ? current : null;

  useEffect(() => {
    const controller = new AbortController();
    fetch(api + "/notices/?unread=1", { headers: noticeHeaders(), signal: controller.signal })
      .then(response => response.ok ? response.json() : [])
      .then(([notice]: Notice[]) => {
        if (notice && !controller.signal.aborted && !manuallyOpened.current) {
          setCurrent(notice);
          setView("detail");
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [api]);

  useEffect(() => {
    if (view && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [view]);

  useEffect(() => {
    if ((view !== "detail" && view !== "edit") || !current || current.is_read || readIds.current.has(current.id)) return;
    const id = current.id;
    fetch(api + "/notices/" + id + "/read/", {
      method: "POST",
      headers: noticeHeaders(),
    }).then(response => {
      if (!response.ok) throw new Error();
      readIds.current.add(id);
      setNotices(items => items.map(item => item.id === id ? { ...item, is_read: true } : item));
    }).catch(() => setError("읽음 상태를 저장하지 못했습니다."));
  }, [api, current, view]);

  async function openList() {
    manuallyOpened.current = true;
    setView("list");
    setConfirmDeleteId(null);
    setLoading(true);
    setError("");
    try {
      const response = await fetch(api + "/notices/", { headers: noticeHeaders() });
      if (!response.ok) throw new Error();
      const items: Notice[] = await response.json();
      setNotices(items.map(item => readIds.current.has(item.id) ? { ...item, is_read: true } : item));
    } catch {
      setError("공지사항을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function readAll() {
    setReadingAll(true);
    setError("");
    try {
      const response = await fetch(api + "/notices/read-all/", { method: "POST", headers: noticeHeaders() });
      if (!response.ok) throw new Error();
      setNotices(items => items.map(item => ({ ...item, is_read: true })));
    } catch {
      setError("전체읽기를 저장하지 못했습니다.");
    } finally {
      setReadingAll(false);
    }
  }

  async function saveNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || saving) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();
    if (!title || !body) {
      setError("제목과 내용을 입력하세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(api + "/notices/" + (editingNotice ? editingNotice.id + "/" : ""), {
        method: editingNotice ? "PATCH" : "POST",
        headers: { ...noticeHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (!response.ok) throw new Error();
      await openList();
    } catch {
      setError(editingNotice ? "공지사항을 수정하지 못했습니다." : "공지사항을 등록하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNotice(id: number) {
    if (!isAdmin || saving || confirmDeleteId !== id) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(api + "/notices/" + id + "/", {
        method: "DELETE",
        headers: noticeHeaders(),
      });
      if (!response.ok && response.status !== 404) throw new Error();
      setNotices(items => items.filter(item => item.id !== id));
      await openList();
    } catch {
      setError("공지사항을 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <button type="button" aria-label="공지사항" title="공지사항" onClick={() => void openList()} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    </button>
    <dialog ref={dialog} aria-labelledby="notice-heading" onClose={() => setView(null)} onCancel={event => { if (saving) event.preventDefault(); }} className="m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/30">
      <div className="flex items-center justify-between gap-3">
        <h2 id="notice-heading" className="text-lg font-bold">공지사항</h2>
        <button type="button" disabled={saving} onClick={() => dialog.current?.close()} aria-label="공지사항 닫기" className="rounded-md px-2 py-1 text-lg text-slate-600 hover:bg-slate-100">×</button>
      </div>
      {view === "detail" && current && <>
        <h3 className="mt-4 break-words font-semibold">{current.title}</h3>
        <time dateTime={current.created_at} className="mt-1 block text-xs text-slate-500">{noticeDate.format(new Date(current.created_at))}</time>
        <p className="my-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{current.body}</p>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" disabled={saving} onClick={() => void openList()} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">리스트 보기</button>
        </div>
      </>}
      {isAdmin && (view === "create" || editingNotice) && <form onSubmit={saveNotice} className="mt-4 space-y-3">
        <h3 className="font-semibold">{editingNotice ? "공지 수정" : "공지 등록"}</h3>
        <label className="block text-sm font-semibold">제목
          <input name="title" defaultValue={editingNotice?.title ?? ""} required maxLength={200} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="block text-sm font-semibold">내용
          <textarea name="body" defaultValue={editingNotice?.body ?? ""} required rows={5} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={() => void openList()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">취소</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{editingNotice ? "저장" : "등록"}</button>
        </div>
      </form>}
      {view === "list" && <>
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">최근 공지사항</p>
          <div className="flex gap-2">
            {isAdmin && <button type="button" disabled={readingAll || saving} onClick={() => { setError(""); setView("create"); }} className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">공지 등록</button>}
            <button type="button" disabled={loading || readingAll || saving || notices.length === 0} onClick={() => void readAll()} className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">전체읽기</button>
          </div>
        </div>
        {loading ? <p className="mt-3 text-sm text-slate-500">공지사항을 불러오는 중입니다.</p>
          : notices.length === 0 ? <p className="mt-3 text-sm text-slate-500">등록된 공지사항이 없습니다.</p>
          : <ul className="mt-2 divide-y divide-slate-200">
            {notices.map(notice => <li key={notice.id}>
              <div className="flex items-center gap-2">
                <button type="button" disabled={readingAll || saving} onClick={() => { setError(""); setCurrent(notice); setView(isAdmin ? "edit" : "detail"); }} className="min-w-0 flex-1 rounded px-2 py-3 text-left hover:bg-slate-50">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-semibold">{notice.title}</span>
                    <span className={'shrink-0 rounded px-1.5 text-xs font-semibold ' + (notice.is_read ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700')}>
                      {notice.is_read ? "읽음" : "새 공지"}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-600">{notice.body}</span>
                  <time dateTime={notice.created_at} className="mt-1 block text-xs text-slate-500">{noticeDate.format(new Date(notice.created_at))}</time>
                </button>
                {isAdmin && <button type="button" aria-label={`${notice.title} 삭제`} aria-expanded={confirmDeleteId === notice.id} disabled={readingAll || saving} onClick={() => { setError(""); setConfirmDeleteId(confirmDeleteId === notice.id ? null : notice.id); }} className="shrink-0 rounded-md border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">삭제</button>}
              </div>
              {isAdmin && confirmDeleteId === notice.id && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                <p className="font-semibold text-red-800">이 공지사항을 삭제할까요?</p>
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" disabled={saving} onClick={() => setConfirmDeleteId(null)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5">취소</button>
                  <button type="button" disabled={readingAll || saving} onClick={() => void deleteNotice(notice.id)} className="rounded-md bg-red-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50">삭제 확인</button>
                </div>
              </div>}
            </li>)}
          </ul>}
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </dialog>
  </>;
}
