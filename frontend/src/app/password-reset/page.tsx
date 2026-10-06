"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export default function PasswordResetPage() {
  const [link, setLink] = useState<{ uid: string; token: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.has("uid") && params.has("token")) setLink({ uid: params.get("uid")!, token: params.get("token")! }); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${API}/auth/password-reset/${link ? "confirm/" : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, ...link }) });
      const data = await response.json();
      setMessage(data.detail ?? "요청을 처리하지 못했습니다.");
      if (response.ok && link) setDone(true);
    } catch { setMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요."); }
    finally { setBusy(false); }
  }
  return <AuthShell title={link ? "새 비밀번호 설정" : "비밀번호 찾기"} subtitle={link ? "새 비밀번호를 두 번 입력하세요." : "계정 정보를 입력하면 등록된 이메일로 재설정 링크를 보내드립니다."}>
    {!done && <form onSubmit={submit} className="mt-6 space-y-3">
      {link ? <><input aria-label="새 비밀번호" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="새 비밀번호 (8자 이상)" className="w-full rounded-lg border p-3" /><input aria-label="비밀번호 확인" name="password_confirm" type="password" required minLength={8} autoComplete="new-password" placeholder="비밀번호 확인" className="w-full rounded-lg border p-3" /></> : <>
        <input aria-label="이름" name="name" required placeholder="이름" className="w-full rounded-lg border p-3" />
        <input aria-label="사번" name="employee_number" placeholder="사번 (미등록 시 비워두세요)" className="w-full rounded-lg border p-3" />
        <input aria-label="아이디" name="username" required placeholder="아이디" className="w-full rounded-lg border p-3" />
      </>}
      <button disabled={busy} className="w-full rounded-lg bg-blue-600 p-3 font-bold text-white disabled:opacity-50">{busy ? "처리 중…" : link ? "비밀번호 변경" : "재설정 링크 받기"}</button>
    </form>}
    {message && <p role="status" className="mt-4 rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
    <p className="mt-5 text-center text-sm"><Link href="/" className="underline">로그인으로 돌아가기</Link></p>
  </AuthShell>;
}
