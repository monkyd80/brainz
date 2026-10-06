"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-5"><section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-300/40"><p className="text-xs font-bold tracking-[.2em] text-blue-600">COM_MANAGE</p><h1 className="mt-2 text-2xl font-bold">{title}</h1><p className="mt-2 text-sm text-slate-500">{subtitle}</p>{children}</section></main>;
}

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setMessage("로그인 정보를 확인하고 있습니다."); try { const form = new FormData(event.currentTarget); const response = await fetch(`${API}/auth/login/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); const data = await response.json(); if (response.ok) { localStorage.setItem("kdy_auth_token", data.token); localStorage.setItem("kdy_auth_user", JSON.stringify(data.user)); setMessage(data.user.is_admin ? "관리자 로그인에 성공했습니다. 화면으로 이동합니다." : "로그인에 성공했습니다. 화면으로 이동합니다."); window.setTimeout(() => router.push("/dashboard"), 500); } else setMessage(data.detail ?? "로그인에 실패했습니다."); } catch { setMessage("서버에 연결할 수 없습니다. 서비스를 실행했는지 확인하세요."); } finally { setLoading(false); } }
  return <AuthShell title="로그인" subtitle="업체·사이트 관리 시스템"><form onSubmit={submit} className="mt-7 space-y-4"><input name="username" required placeholder="아이디" className="w-full rounded-lg border p-3" /><input name="password" type="password" required placeholder="비밀번호" className="w-full rounded-lg border p-3" /><button disabled={loading} className="w-full rounded-lg bg-blue-600 p-3 font-bold text-white disabled:cursor-wait disabled:bg-blue-400">{loading ? "로그인 중…" : "로그인"}</button></form><p className="mt-5 text-center text-sm text-slate-600"><Link href="/signup" className="underline">회원가입</Link><span className="mx-3">|</span><Link href="/password-reset" className="underline">비밀번호 찾기</Link></p><p aria-live="polite" className="mt-5 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message || "아이디와 비밀번호를 입력한 뒤 로그인하세요."}</p></AuthShell>;
}

export function SignupForm() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch(`${API}/auth/signup/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); const data = await response.json(); setMessage(response.ok ? "가입되었습니다. 로그인 페이지에서 사용할 수 있습니다." : data.detail); }
  return <AuthShell title="회원가입" subtitle="일반 사용자 계정을 만듭니다. 관리자 계정은 별도 관리됩니다."><form onSubmit={submit} className="mt-7 space-y-4"><input name="username" required placeholder="아이디" className="w-full rounded-lg border p-3" /><input name="email" type="email" required placeholder="이메일" className="w-full rounded-lg border p-3" /><input name="password" type="password" minLength={8} required placeholder="비밀번호 (8자 이상)" className="w-full rounded-lg border p-3" /><button className="w-full rounded-lg bg-blue-600 p-3 font-bold text-white">가입하기</button></form><p className="mt-5 text-center text-sm"><Link href="/" className="underline">로그인으로 돌아가기</Link></p>{message && <p className="mt-5 rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}</AuthShell>;
}
