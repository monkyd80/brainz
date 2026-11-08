"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export default function PasswordResetPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API}/auth/password-reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      setMessage(response.ok ? "초기화 되었습니다." : data.detail ?? "요청을 처리하지 못했습니다.");
      setDone(response.ok);
    } catch {
      setMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell title="비밀번호 초기화" subtitle="등록된 이름, 사번, ID를 입력하세요.">
    {!done && <form onSubmit={submit} className="mt-6 space-y-3">
      <input aria-label="이름" name="name" required placeholder="이름" autoComplete="name" className="w-full rounded-lg border p-3" />
      <input aria-label="사번" name="employee_number" required placeholder="사번" className="w-full rounded-lg border p-3" />
      <input aria-label="ID" name="username" required placeholder="ID" autoComplete="username" className="w-full rounded-lg border p-3" />
      <button disabled={busy} className="w-full rounded-lg bg-blue-600 p-3 font-bold text-white disabled:opacity-50">{busy ? "처리 중…" : "비밀번호 초기화"}</button>
    </form>}
    {message && <p role="status" className="mt-4 rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
    <p className="mt-5 text-center text-sm"><Link href="/" className="underline">로그인으로 돌아가기</Link></p>
  </AuthShell>;
}
