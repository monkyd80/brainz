"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readSystemRows } from "@/components/systems-editor";
import { AddSiteDialog } from "@/components/site-add-dialog";
import { SegmentedDatePicker } from "@/components/segmented-date-picker";

function AdminSwitchPanel({ onClose }: { onClose: () => void }) { const [users, setUsers] = useState<{ id: number; username: string; name: string; is_admin: boolean }[]>([]); const [nameQuery, setNameQuery] = useState(""); const token = typeof window === "undefined" ? "" : localStorage.getItem("kdy_auth_token") ?? ""; useEffect(() => { fetch(`${API}/admin/users/`, { headers: { Authorization: `Token ${token}` } }).then((response) => response.ok ? response.json() : []).then((data) => setUsers(Array.isArray(data) ? data : [])); }, [token]); const switchTo = async (id: number) => { const response = await fetch(`${API}/auth/switch-user/`, { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ user_id: id }) }); const data = await response.json(); if (!response.ok) return; localStorage.setItem("kdy_admin_return_token", token); localStorage.setItem("kdy_admin_return_user", localStorage.getItem("kdy_auth_user") ?? ""); localStorage.setItem("kdy_auth_token", data.token); localStorage.setItem("kdy_auth_user", JSON.stringify(data.user)); window.location.reload(); }; return <div className="fixed right-5 top-16 z-[60] flex max-h-[calc(100dvh-5rem)] w-64 max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><div className="mb-2 flex shrink-0 items-center justify-between"><b className="text-sm">사용자 전환</b><button type="button" onClick={onClose} aria-label="닫기" className="text-lg">×</button></div><p className="shrink-0 border-t pt-2 text-xs font-semibold text-slate-500">전환할 사용자를 선택하세요.</p><input type="search" aria-label="전환할 사용자 이름 검색" placeholder="사용자 이름 검색" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} className="my-2 w-full shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{!users.some((item) => !item.is_admin && (item.name || item.username).toLocaleLowerCase().includes(nameQuery.trim().toLocaleLowerCase())) && <p className="px-2 py-3 text-center text-xs text-slate-500">검색 결과가 없습니다.</p>}{users.filter((item) => !item.is_admin && (item.name || item.username).toLocaleLowerCase().includes(nameQuery.trim().toLocaleLowerCase())).sort((a, b) => (a.name.trim() || a.username).localeCompare(b.name.trim() || b.username, "ko") || a.username.localeCompare(b.username, "ko")).map((item) => <button key={item.id} type="button" onClick={() => switchTo(item.id)} className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-blue-50">{item.name || item.username}<span className="ml-1 text-xs text-slate-400">({item.username})</span></button>)}</div></div> }
function AdminReturnControl() { const [available, setAvailable] = useState(false); useEffect(() => setAvailable(Boolean(localStorage.getItem("kdy_admin_return_token"))), []); if (!available) return null; return <button type="button" onClick={() => { const token = localStorage.getItem("kdy_admin_return_token"); const user = localStorage.getItem("kdy_admin_return_user"); if (!token || !user) return; localStorage.setItem("kdy_auth_token", token); localStorage.setItem("kdy_auth_user", user); localStorage.removeItem("kdy_admin_return_token"); localStorage.removeItem("kdy_admin_return_user"); window.location.reload(); }} className="fixed right-5 top-4 z-[60] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-lg hover:border-blue-600 hover:bg-blue-600 hover:text-white">관리자로 복귀</button>; }

function AdminUserManagementEditor({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<{ id: number; username: string; name: string; email: string; is_admin: boolean; employee_number: string }[]>([]);
  const [adding, setAdding] = useState(false); const [form, setForm] = useState({ username: "", name: "", email: "", password: "" }); const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Record<number, Record<string, string | boolean>>>({});
  const [passwords, setPasswords] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const headers = { Authorization: `Token ${typeof window === "undefined" ? "" : localStorage.getItem("kdy_auth_token")}` };
  const load = async () => { const response = await fetch(`${API}/admin/users/`, { headers }); if (response.ok) setUsers(await response.json()); };
  useEffect(() => { void load(); }, []);
  const request = async (path: string, method: string, body?: Record<string, string | boolean>) => { const response = await fetch(`${API}${path}`, { method, headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail ?? "처리하지 못했습니다."); return data; };
  const create = async () => { try { const data = await request("/admin/users/", "POST", form); setUsers((current) => [...current, data]); setForm({ username: "", name: "", email: "", password: "" }); setAdding(false); setMessage(`${data.username} 사용자를 추가했습니다.`); } catch (error) { setMessage(error instanceof Error ? error.message : "사용자를 추가하지 못했습니다."); } };
  const update = (id: number, data: Record<string, string | boolean>) => {
    setUsers(current => current.map(item => item.id === id ? { ...item, ...data } : item));
    setPending(current => ({ ...current, [id]: { ...current[id], ...data } }));
    setMessage("변경 내용은 확인을 눌러야 저장됩니다.");
  };
  const changePassword = (id: number) => {
    const password = window.prompt("새 비밀번호를 입력하세요. 확인을 눌러야 저장됩니다. (8자 이상)");
    if (!password) return;
    if (password.length < 8) { setMessage("비밀번호는 8자 이상이어야 합니다."); return; }
    setPasswords(current => ({ ...current, [id]: password }));
    setMessage("비밀번호 변경을 준비했습니다. 아래 확인을 눌러 저장하세요.");
  };
  const save = async () => {
    if (savePending.current) return;
    savePending.current = true; setSaving(true); setMessage("");
    try {
      for (const [id, values] of Object.entries(pending)) {
        await request(`/admin/users/${id}/`, "PATCH", values);
        setPending(current => { const next = { ...current }; delete next[Number(id)]; return next; });
      }
      for (const [id, password] of Object.entries(passwords)) {
        await request(`/admin/users/${id}/password/`, "POST", { password });
        setPasswords(current => { const next = { ...current }; delete next[Number(id)]; return next; });
      }
      onClose();
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { savePending.current = false; setSaving(false); }
  };
  const remove = async (id: number, username: string) => { if (!window.confirm(`'${username}' 사용자를 삭제할까요?`)) return; try { await request(`/admin/users/${id}/`, "DELETE"); setUsers((current) => current.filter((item) => item.id !== id)); setPending(current => { const next = { ...current }; delete next[id]; return next; }); setPasswords(current => { const next = { ...current }; delete next[id]; return next; }); setMessage(`${username} 사용자를 삭제했습니다.`); } catch (error) { setMessage(error instanceof Error ? error.message : "사용자를 삭제하지 못했습니다."); } };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"><section className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl"><fieldset disabled={saving} className="min-w-0"><div className="flex items-center"><h2 className="flex-1 text-center text-xl font-bold">사용자 관리</h2><button type="button" onClick={() => setAdding(true)} className="mr-3 rounded-lg border border-blue-600 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-600 hover:text-white">+ 사용자 추가</button><button type="button" onClick={onClose} aria-label="닫기" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-2xl font-bold ring-1 ring-slate-300">×</button></div>{adding && <div className="mt-4 grid grid-cols-5 gap-2 rounded-xl bg-slate-50 p-3"><input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="사용자 ID" className="rounded border p-2 text-sm" /><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="이름" className="rounded border p-2 text-sm" /><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="이메일" className="rounded border p-2 text-sm" /><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="비밀번호 (8자 이상)" className="rounded border p-2 text-sm" /><button type="button" onClick={create} className="rounded bg-blue-600 px-3 text-sm font-semibold text-white">추가</button></div>}<div className="mt-4 max-h-[65vh] overflow-auto"><div className="min-w-[800px]"><div className="sticky top-0 z-20 grid grid-cols-[1fr_1fr_1.5fr_1fr_96px_132px] gap-2 border-b bg-white py-3 text-center text-sm font-bold text-slate-500"><span>사용자 ID</span><span>이름</span><span>이메일</span><span>사번</span><span>관리자 권한</span><span>관리</span></div>{users.map((item) => <div key={item.id} className="grid grid-cols-[1fr_1fr_1.5fr_1fr_96px_132px] items-center gap-2 border-b py-2 text-center text-sm"><b className="min-w-0 break-words">{item.username}</b><input value={item.name} onChange={(event) => update(item.id, { name: event.currentTarget.value })} placeholder="이름" className="min-w-0 w-full rounded border p-2 text-center" /><input value={item.email} onChange={(event) => update(item.id, { email: event.currentTarget.value })} placeholder="이메일" className="min-w-0 w-full rounded border p-2 text-center" /><input aria-label={`${item.username} 사번`} value={item.employee_number} onChange={(event) => update(item.id, { employee_number: event.currentTarget.value })} placeholder="미등록" className="min-w-0 w-full rounded border p-2 text-center" /><label className="flex justify-center"><input type="checkbox" aria-label={`${item.username} 관리자 권한`} disabled={item.username === "brainz"} checked={item.is_admin} onChange={(event) => update(item.id, { is_admin: event.target.checked })} className="h-4 w-4" /></label><span className="flex justify-center gap-2 whitespace-nowrap">{item.username !== "brainz" && <button type="button" onClick={() => void changePassword(item.id)} className="rounded border border-slate-300 px-2 py-1.5 text-xs hover:border-blue-600 hover:bg-blue-600 hover:text-white">{passwords[item.id] ? "PW 변경 대기" : "PW 수정"}</button>}{!["brainz", "brainz_admin"].includes(item.username) && <button type="button" onClick={() => void remove(item.id, item.username)} className="rounded border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:border-red-500 hover:bg-red-500 hover:text-white">삭제</button>}</span></div>)}</div></div>{message && <p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}<div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4"><p className="text-xs text-slate-500">수정 내용은 확인을 눌러야 저장됩니다.</p><div className="flex shrink-0 gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">취소</button><button type="button" onClick={() => void save()} className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold">{saving ? "저장 중…" : "확인"}</button></div></div></fieldset></section></div>;
}

type History = { id: number; table_name: string; action: string; changed_fields: string[]; changed_at: string; after_data: Record<string, unknown> };
type Company = { id: number; created_by: number | null; name: string; status: string; business_code: string; maintenance_code: string; contract_type: string; sales_manager: string; support_staff: string; current_file_date: string | null; build_year: number | null; address: string; remote_support: boolean; systems: { id: number; name: string; os_type: string; database_type: string; ip_address: string | null }[]; hardware_specs: { id: number; target: string; cpu: string; memory: string; disk: string }[]; hardware_capacities?: { id: number; directory: string; used_capacity: string; total_capacity: string; available_capacity: string }[]; contacts?: Record<string, unknown>[]; contract_products?: Record<string, unknown>[]; solutions?: Record<string, unknown>[]; integrations?: Record<string, unknown>[]; installation_locations?: Record<string, unknown>[]; change_history: History[] };
type Tab = "detail" | "basic" | "solutions" | "hardware" | "search" | "history";

function editInitialValues(company: Company): Record<string, string | boolean | null> {
  const text = (value: unknown) => value == null ? "" : String(value);
  const product = (company.contract_products ?? []) as Record<string, unknown>[];
  const ems = product.find((item) => String(item.product_name).toUpperCase() === "EMS") ?? {};
  const dashboard = product.find((item) => String(item.product_name).toLowerCase() === "dashboard") ?? {};
  const contact = ((company.contacts ?? [])[0] ?? {}) as Record<string, unknown>;
  const system = ((company.systems ?? [])[0] ?? {}) as unknown as Record<string, unknown>;
  const hardware = (company.hardware_specs ?? []) as unknown as Record<string, unknown>[];
  const spec = (target: string) => hardware.find((item) => item.target === target) ?? {};
  const install = (type: string) => ((company.installation_locations ?? []) as Record<string, unknown>[]).find((item) => item.location_type === type) ?? {};
  const values: Record<string, string | boolean | null> = {
    systems_json: JSON.stringify(company.systems ?? []),
    name: company.name, build_year: text((company as unknown as Record<string, unknown>).build_date) || (company.build_year ? `${company.build_year}-01-01` : ""), contract_period: company.contract_type, business_code: company.business_code, maintenance_code: company.maintenance_code,
    sales_manager: company.sales_manager, support_staff_primary: company.support_staff.split(" / ")[0] ?? "", support_staff_secondary: company.support_staff.split(" / ").slice(1).join(" / "),
    address: company.address, current_file_date: company.current_file_date, remote_support: company.remote_support,
    ems_package: text(ems.package_name), ems_version: text(ems.version), dashboard_enabled: Boolean(dashboard.product_name),
    dashboard_package: text(dashboard.package_name), dashboard_version: text(dashboard.version), dashboard_location: text(dashboard.installation_location),
    datamanager_version: text(dashboard.configuration).replace(/^Datamanager:\s*/i, ""),
    contact_0_name: text(contact.name), contact_0_phone: text(contact.phone), contact_0_mobile: text(contact.mobile), contact_0_email: text(contact.email), contact_0_fax: text(contact.fax),
    inspection_report_submitted: Boolean(contact.inspection_report_submitted), inspection_report_detail: text(contact.inspection_report_detail),
    system_name: text(system.name), system_set: text(system.set_configuration), system_os: text(system.os_type), system_os_version: text(system.os_version), system_db: text(system.database_type), system_db_version: text(system.database_version), system_ip: text(system.ip_address), system_access: text(system.system_access_info), web_access: text(system.web_access_info), web_port: text(system.web_port), db_port: text(system.database_port), dashboard_port: text(system.dashboard_port),
    install_db: text(install("database").path), install_datafile: text(install("datafile").path), install_java: text(install("java").path), install_tomcat: text(install("tomcat").path), install_manager: text(install("manager").path), install_log: text(install("log").path),
    manager1_cpu: text(spec("manager_1").cpu), manager1_memory: text(spec("manager_1").memory), manager1_disk: text(spec("manager_1").disk), manager2_cpu: text(spec("manager_2").cpu), manager2_memory: text(spec("manager_2").memory), manager2_disk: text(spec("manager_2").disk), db_cpu: text(spec("database").cpu), db_memory: text(spec("database").memory), db_disk: text(spec("database").disk), hw_other: text(spec("database").other_detail),
  };
  ((company.solutions ?? []) as Record<string, unknown>[]).forEach((item) => { const baseCode = text(item.category).toLowerCase(); const code = baseCode === "other" ? `custom_${text(item.id)}` : baseCode; values[`license_${code}_label`] = text(item.product_name); values[`license_${code}_used`] = text(item.used_quantity); values[`license_${code}_total`] = text(item.total_quantity); values[`license_${code}_other`] = text(item.other_detail); values[`license_${code}_additional`] = text(item.additional_info); });
  ((company.integrations ?? []) as Record<string, unknown>[]).forEach((item) => { const code = text(item.integration_type); values[`integration_${code}`] = Boolean(item.enabled); values[`integration_${code}_detail`] = text(item.detail); if (code === "other") values.integration_other_enabled = Boolean(item.enabled); });
  const base = company as unknown as Record<string, unknown>;
  values.notes = text(base.notes); values.special_notes = text(base.special_notes); values.supplied_server_os_db = Boolean(base.supplied_server_os_db);
  return values;
}
type SearchScope = "all" | "name" | "contract" | "code";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

function preventEnterSubmit(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter") return;
  if (event.target instanceof HTMLElement && event.target.closest("[data-date-picker]")) return;
  if (event.target instanceof HTMLTextAreaElement) return;
  const target = event.target as HTMLInputElement;
  if (target.placeholder?.includes("검색")) return;
  event.preventDefault();
}

export default function DashboardPage() {
  const router = useRouter();
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [myCompanies, setMyCompanies] = useState<Company[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("detail");
  const [query, setQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [contractFilter, setContractFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSiteManagement, setShowSiteManagement] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showUserSwitch, setShowUserSwitch] = useState(false);
  const [showAssignments, setShowAssignments] = useState(false);
  const [fromSiteManagement, setFromSiteManagement] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [editingReadOnly, setEditingReadOnly] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [notice, setNotice] = useState("사이트 정보를 불러오는 중입니다.");
  const [user, setUser] = useState<{ id?: number; username: string; is_admin: boolean } | null>(null);
  const [userGroups, setUserGroups] = useState<{ id: number; username: string; name: string; company_ids: number[] }[]>([]);
  const [siteListMode, setSiteListMode] = useState<"all" | "users">("all");

  async function refreshSiteData() {
    const token = localStorage.getItem("kdy_auth_token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };
    try {
      const [all, mine, groups] = await Promise.all([fetch(`${API}/companies/`, { headers }), fetch(`${API}/companies/mine/`, { headers }), fetch(`${API}/auth/site-user-groups/`, { headers })]);
      if (!all.ok || !mine.ok) throw new Error();
      const allData = await all.json(); const mineData = await mine.json(); const groupData = groups.ok ? await groups.json() : [];
      setAllCompanies(Array.isArray(allData) ? allData : allData.results ?? []);
      setMyCompanies(Array.isArray(mineData) ? mineData : mineData.results ?? []);
      setUserGroups(Array.isArray(groupData) ? groupData : []);
      setNotice("");
    } catch { setNotice("사이트 정보를 불러오지 못했습니다. API 서비스를 확인하세요."); }
  }

  useEffect(() => {
    const token = localStorage.getItem("kdy_auth_token");
    const savedUser = localStorage.getItem("kdy_auth_user");
    if (!token || !savedUser) { router.replace("/"); return; }
    setUser(JSON.parse(savedUser));
    void refreshSiteData();
  }, [router]);

  const selected = selectedIds.map((id) => allCompanies.find((company) => company.id === id)).filter((company): company is Company => Boolean(company));
  const mainCompany = selected.find((company) => company.id === activeCompanyId) ?? selected[0];
  const filtered = (items: Company[]) => {
    const keyword = query.trim().toLowerCase();
    const matchingContracts = items.filter((company) => contractFilter === null || (company.contract_type ?? "").trim() === contractFilter);
    if (!keyword) return matchingContracts;
    const fields: Record<SearchScope, string[]> = {
      all: ["name", "contract_type", "business_code", "maintenance_code"],
      name: ["name"],
      contract: ["contract_type"],
      code: ["business_code", "maintenance_code"],
    };
    return matchingContracts.filter((company) => fields[searchScope].some((field) => String(company[field as keyof Company] ?? "").toLowerCase().includes(keyword)));
  };
  const contractOptions = [...new Set(allCompanies.map((company) => (company.contract_type ?? "").trim()))].sort((a, b) => a.localeCompare(b, "ko"));
  const sidebarSearching = Boolean(query.trim()) || contractFilter !== null;
  const siteLists = useMemo(() => ({ mine: filtered(myCompanies), others: filtered(allCompanies.filter((company) => !myCompanies.some((mine) => mine.id === company.id))) }), [allCompanies, myCompanies, query, searchScope, contractFilter]);
  // Keep opening order independent of the active tab: eviction is FIFO, not recently viewed.
  function openCompany(id: number) {
    setSelectedIds((current) => current.includes(id) ? current : [...current, id].slice(-10));
    setActiveCompanyId(id);
  }
  function toggleCompany(id: number) {
    if (selectedIds.includes(id)) {
      setSelectedIds((current) => current.filter((value) => value !== id));
    } else {
      openCompany(id);
    }
  }
  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("kdy_auth_token");
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const year = text("build_year");
    const headers = { Authorization: `Token ${token}`, "Content-Type": "application/json" };
    const supportStaff = [text("support_staff_primary"), text("support_staff_secondary")].filter(Boolean).join(" / ");
    const payload = { name: text("name"), contract_type: text("contract_type") || text("contract_period"), business_code: text("business_code"), maintenance_code: text("maintenance_code"), sales_manager: text("sales_manager"), support_staff: supportStaff, address: text("address"), build_year: null, build_date: year || null, current_file_date: text("current_file_date") || null, supplied_server_os_db: form.get("supplied_server_os_db") === "on", remote_support: form.get("remote_support") === "on", notes: text("notes"), special_notes: text("special_notes"), status: "active" };
    const response = await fetch(`${API}/companies/`, { method: "POST", headers, body: JSON.stringify(payload) });
    const companyData = await response.json();
    if (!response.ok) throw new Error(companyData.detail ?? "사이트를 등록하지 못했습니다.");
    const company: Company = companyData;
    const createRelated = async (path: string, data: Record<string, unknown>) => {
      const related = await fetch(`${API}/${path}/`, { method: "POST", headers, body: JSON.stringify({ company: company.id, ...data }) });
      if (!related.ok) { const error = await related.json(); throw new Error(error.detail ?? "세부 정보를 저장하지 못했습니다."); }
    };
    const tasks: Promise<void>[] = [];
    if (text("ems_package") || text("ems_version")) tasks.push(createRelated("contract-products", { product_name: "EMS", package_name: text("ems_package"), version: text("ems_version"), configuration: text("contract_period") }));
    if (text("dashboard_name") || text("dashboard_package") || text("dashboard_version") || text("datamanager_version")) tasks.push(createRelated("contract-products", { product_name: text("dashboard_name") || "Dashboard", package_name: text("dashboard_package"), version: text("dashboard_version"), installation_location: text("dashboard_location"), configuration: `Datamanager: ${text("datamanager_version")}` }));
    const contactIds = Array.from(form.keys()).filter((key) => key.startsWith("contact_") && key.endsWith("_name")).map((key) => key.slice("contact_".length, -"_name".length));
    contactIds.forEach((id) => { const name = text(`contact_${id}_name`); if (name) tasks.push(createRelated("contacts", { role: "customer", name, phone: text(`contact_${id}_phone`), mobile: text(`contact_${id}_mobile`), email: text(`contact_${id}_email`), fax: text(`contact_${id}_fax`) })); });
    const knownCategories: Record<string, string> = { sms: "sms", nms: "nms", dbms: "dbms", apm: "apm", syslog: "syslog", trap: "trap", oz: "oz" };
    const solutionCodes = Array.from(form.keys()).filter((key) => key.startsWith("license_") && key.endsWith("_used")).map((key) => key.slice("license_".length, -"_used".length));
    solutionCodes.forEach((code) => { const used = text(`license_${code}_used`); const total = text(`license_${code}_total`); const other = text(`license_${code}_other`); const additional = text(`license_${code}_additional`); const label = text(`license_${code}_label`); if (used || total || other || additional || (code.startsWith("custom_") && label)) tasks.push(createRelated("solutions", { category: knownCategories[code] ?? "other", product_name: label || "기타 솔루션", used_quantity: used ? Number(used) : null, total_quantity: total ? Number(total) : null, other_detail: other, additional_info: additional })); });
    if (form.get("integration_sms") === "on") tasks.push(createRelated("integrations", { integration_type: "sms", enabled: true, detail: text("integration_sms_detail") }));
    if (form.get("integration_email") === "on") tasks.push(createRelated("integrations", { integration_type: "email", enabled: true, detail: text("integration_email_detail") }));
    if (form.get("integration_push") === "on") tasks.push(createRelated("integrations", { integration_type: "push", enabled: true, detail: text("integration_push_detail") }));
    if (form.get("integration_other_enabled") === "on") tasks.push(createRelated("integrations", { integration_type: "other", enabled: true, detail: text("integration_other") }));
    for (const row of readSystemRows(form)) tasks.push(createRelated("systems", row));
    [["database", "install_db"], ["datafile", "install_datafile"], ["java", "install_java"], ["tomcat", "install_tomcat"], ["manager", "install_manager"], ["log", "install_log"]].forEach(([location_type, field]) => { if (text(field)) tasks.push(createRelated("installation-locations", { location_type, path: text(field) })); });
    if (text("manager1_cpu") || text("manager1_memory") || text("manager1_disk")) tasks.push(createRelated("hardware-specs", { target: "manager_1", cpu: text("manager1_cpu"), memory: text("manager1_memory"), disk: text("manager1_disk") }));
    if (text("manager2_cpu") || text("manager2_memory") || text("manager2_disk")) tasks.push(createRelated("hardware-specs", { target: "manager_2", cpu: text("manager2_cpu"), memory: text("manager2_memory"), disk: text("manager2_disk") }));
    if (text("db_cpu") || text("db_memory") || text("db_disk") || text("hw_other")) tasks.push(createRelated("hardware-specs", { target: "database", cpu: text("db_cpu"), memory: text("db_memory"), disk: text("db_disk"), other_detail: text("hw_other") }));
    Array.from(form.keys()).filter((key) => key.startsWith("capacity_") && key.endsWith("_directory")).forEach((key) => { const id = key.slice("capacity_".length, -"_directory".length); const directory = text(key); if (directory) tasks.push(createRelated("hardware-capacities", { directory, used_capacity: text(`capacity_${id}_used`), total_capacity: text(`capacity_${id}_total`), available_capacity: text(`capacity_${id}_available`) })); });
    await Promise.all(tasks);
    const detail = await fetch(`${API}/companies/${company.id}/`, { headers });
    const fullCompany: Company = detail.ok ? await detail.json() : company;
    setAllCompanies((current) => [fullCompany, ...current]);
    setMyCompanies((current) => [fullCompany, ...current]);
    openCompany(company.id); await refreshSiteData();
  }
  async function responseData(response: Response) { const text = await response.text(); try { return JSON.parse(text); } catch { return { detail: `서버 응답을 처리하지 못했습니다. API 주소와 서비스를 확인하세요. (HTTP ${response.status})` }; } }
  async function previewImport(file: File) { const body = new FormData(); body.append("file", file); const response = await fetch(`${API}/companies/import-preview/`, { method: "POST", headers: { Authorization: `Token ${localStorage.getItem("kdy_auth_token")}` }, body }); const data = await responseData(response); if (!response.ok) throw new Error(data.detail ?? "엑셀 파일을 분석하지 못했습니다."); return data as ImportPreview; }
  async function commitImport(file: File, expectedUpdatedAt?: string) {
    const body = new FormData(); body.append("file", file);
    if (expectedUpdatedAt) { body.append("confirm_update", "true"); body.append("expected_updated_at", expectedUpdatedAt); }
    const response = await fetch(`${API}/companies/import-commit/`, { method: "POST", headers: { Authorization: `Token ${localStorage.getItem("kdy_auth_token")}` }, body });
    const data = await responseData(response);
    if (!response.ok) throw new Error(data.detail ?? "사이트를 등록하지 못했습니다.");
    const company = data as Company;
    setAllCompanies(current => [company, ...current.filter(item => item.id !== company.id)]);
    openCompany(company.id); await refreshSiteData();
  }
  async function updateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const headers = { Authorization: `Token ${localStorage.getItem("kdy_auth_token")}`, "Content-Type": "application/json" };
    const supportStaff = [text("support_staff_primary"), text("support_staff_secondary")].filter(Boolean).join(" / ");
    const payload = { name: text("name"), contract_type: text("contract_period"), business_code: text("business_code"), maintenance_code: text("maintenance_code"), sales_manager: text("sales_manager"), support_staff: supportStaff, address: text("address"), current_file_date: text("current_file_date") || null, remote_support: form.get("remote_support") === "on" };
    const response = await fetch(`${API}/companies/${editing.id}/`, { method: "PATCH", headers, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail ?? "수정하지 못했습니다.");

    const createRelated = async (path: string, values: Record<string, unknown>) => {
      const related = await fetch(`${API}/${path}/`, { method: "POST", headers, body: JSON.stringify({ company: editing.id, ...values }) });
      if (!related.ok) { const error = await related.json().catch(() => ({})); throw new Error(error.detail ?? "세부 정보를 저장하지 못했습니다."); }
    };
    const solutionCodes = Array.from(form.keys()).filter((key) => key.startsWith("license_") && key.endsWith("_used")).map((key) => key.slice("license_".length, -"_used".length));
    const existingNames = new Set((editing.solutions ?? []).map((solution) => String(solution.product_name ?? "").toLowerCase()));
    const tasks: Promise<void>[] = [];
    tasks.push((async () => {
      const result = await fetch(`${API}/companies/${editing.id}/system-rows/`, { method: "PUT", headers, body: JSON.stringify({ systems: readSystemRows(form) }) });
      if (!result.ok) { const error = await result.json().catch(() => ({})); throw new Error(error.detail ?? "시스템 정보를 저장하지 못했습니다."); }
    })());
    solutionCodes.forEach((code) => {
      const used = text(`license_${code}_used`); const total = text(`license_${code}_total`); const other = text(`license_${code}_other`); const additional = text(`license_${code}_additional`);
      const productName = text(`license_${code}_label`) || code.toUpperCase();
      if ((used || total || other || additional || (code.startsWith("custom_") && productName)) && !existingNames.has(productName.toLowerCase())) tasks.push(createRelated("solutions", { category: code.startsWith("custom_") ? "other" : code, product_name: productName, used_quantity: used ? Number(used) : null, total_quantity: total ? Number(total) : null, other_detail: other, additional_info: additional }));
    });
    Array.from(form.keys()).filter((key) => key.startsWith("capacity_") && key.endsWith("_directory")).forEach((key) => {
      const id = key.slice("capacity_".length, -"_directory".length); const directory = text(key);
      if (directory) tasks.push(createRelated("hardware-capacities", { directory, used_capacity: text(`capacity_${id}_used`), total_capacity: text(`capacity_${id}_total`), available_capacity: text(`capacity_${id}_available`) }));
    });
    await Promise.all(tasks);
    const detail = await fetch(`${API}/companies/${editing.id}/`, { headers });
    const fullCompany: Company = detail.ok ? await detail.json() : data;
    setAllCompanies((current) => current.map((company) => company.id === fullCompany.id ? fullCompany : company));
    setMyCompanies((current) => current.map((company) => company.id === fullCompany.id ? fullCompany : company));
    setEditing(null);
  }
  async function deleteCompany(company: Company) { if (!window.confirm(`'${company.name}' 사이트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return; const response = await fetch(`${API}/companies/${company.id}/`, { method: "DELETE", headers: { Authorization: `Token ${localStorage.getItem("kdy_auth_token")}` } }); if (!response.ok) { const data = await response.json().catch(() => ({})); alert(data.detail ?? "사이트를 삭제하지 못했습니다."); return; } setAllCompanies((current) => current.filter((item) => item.id !== company.id)); setMyCompanies((current) => current.filter((item) => item.id !== company.id)); setSelectedIds((current) => current.filter((id) => id !== company.id)); }
  function logout() { localStorage.removeItem("kdy_auth_token"); localStorage.removeItem("kdy_auth_user"); localStorage.removeItem("kdy_admin_return_token"); localStorage.removeItem("kdy_admin_return_user"); router.replace("/"); }

  return <main onKeyDownCapture={preventEnterSubmit} className="min-h-screen bg-slate-100 text-slate-900">
    <header className="flex h-16 items-center border-b border-slate-200 bg-white px-6"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 font-bold text-white">C</div><div><p className="text-sm font-bold">COM_MANAGE</p><p className="text-xs text-slate-500">업체·사이트 관리</p></div></div></header>
    <div className={`workspace-grid min-h-[calc(100vh-64px)] ${!leftOpen ? "workspace-grid--left-collapsed" : ""} ${!rightOpen ? "workspace-grid--right-collapsed" : ""}`}>
      <aside className="max-h-[calc(100vh-64px)] overflow-y-auto border-r border-slate-200 bg-white p-4">{leftOpen ? <><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><button type="button" onClick={() => setShowPassword(true)} title="내 정보 수정" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-600 hover:bg-blue-600 hover:text-white">{user?.username ?? "접속 ID"}</button><button onClick={logout} aria-label="로그아웃" title="로그아웃" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-lg text-slate-600 hover:border-blue-600 hover:bg-blue-600 hover:text-white"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 3v18" /></svg></button></div><button onClick={() => setLeftOpen(false)} aria-label="사이트 목록 접기" className="rounded-md border px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">‹</button></div><div className="mb-4 flex gap-3"><label className="sr-only">사이트 검색</label><select value={searchScope} onChange={(event) => setSearchScope(event.target.value as SearchScope)} aria-label="검색 분류" className="w-16 shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-sm font-medium outline-none focus:border-blue-500"><option value="all">전체</option><option value="name">이름</option><option value="contract">계약구분</option><option value="code">코드</option></select><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchScope === "all" ? "전체 항목 검색" : searchScope === "name" ? "사이트명 검색" : searchScope === "contract" ? "계약구분 검색" : "사업·유지보수 코드 검색"} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div><div className="mb-4"><label htmlFor="sidebar-contract-filter" className="mb-2 block text-xs font-bold text-slate-600">계약 구분</label><select id="sidebar-contract-filter" value={contractFilter === null ? "all" : `value:${contractFilter}`} onChange={(event) => setContractFilter(event.target.value === "all" ? null : event.target.value.slice(6))} className="w-full rounded-lg border border-slate-300 bg-white p-1 text-sm outline-none focus:border-blue-500"><option value="all" className="px-2 py-1">전체 계약 구분</option>{contractOptions.map((value) => <option key={value} value={`value:${value}`} className="px-2 py-1">{value || "미입력"}</option>)}</select></div>{user?.is_admin && <div className="mb-4 flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm"><label className={`flex-1 cursor-pointer rounded-md px-2 py-2 text-center ${siteListMode === "all" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-slate-500"}`}><input type="radio" className="sr-only" checked={siteListMode === "all"} onChange={() => setSiteListMode("all")} />전체 사이트</label><label className={`flex-1 cursor-pointer rounded-md px-2 py-2 text-center ${siteListMode === "users" ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-slate-500"}`}><input type="radio" className="sr-only" checked={siteListMode === "users"} onChange={() => setSiteListMode("users")} />사용자별 사이트</label></div>}{user?.is_admin ? (siteListMode === "all" ? <SiteSection title="전체 사이트" searching={sidebarSearching} count={filtered(allCompanies).length} sites={filtered(allCompanies)} selectedIds={selectedIds} onToggle={toggleCompany} onAdd={() => setShowAdd(true)} /> : <UserSiteGroups key={`${searchScope}:${query.trim()}:${contractFilter}`} searching={sidebarSearching} groups={userGroups} companies={filtered(allCompanies)} selectedIds={selectedIds} onToggle={toggleCompany} />) : <RegularSiteLists key={`${sidebarSearching}:${contractFilter}`} searching={sidebarSearching} mine={siteLists.mine} others={siteLists.others} selectedIds={selectedIds} onToggle={toggleCompany} onAdd={() => setShowAdd(true)} />}<ManagementMenu isAdmin={Boolean(user?.is_admin)} onManageSites={() => setShowSiteManagement(true)} onUsers={() => setShowUserManagement(true)} /></> : <button onClick={() => setLeftOpen(true)} aria-label="사이트 목록 펼치기" className="grid h-9 w-full place-items-center rounded-md border text-lg text-slate-600 hover:bg-slate-50">›</button>}</aside>
      <section onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = Number(event.dataTransfer.getData("company-id")); if (id && allCompanies.some((company) => company.id === id)) openCompany(id); }} className="center-workspace min-w-0 p-5 lg:p-7"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-medium text-blue-600">사이트 정보</p><h1 className="mt-1 text-2xl font-bold">{mainCompany ? mainCompany.name : "사이트를 선택하세요"}</h1><p className="mt-1 text-sm text-slate-500">좌측 사이트를 이 영역으로 끌어 놓아 추가할 수 있습니다.</p></div><div>{mainCompany?.current_file_date && <p className="text-xs text-slate-500">등록·수정 날짜 <b className="ml-1 text-slate-700">{mainCompany.current_file_date}</b></p>}{mainCompany && <button onClick={() => { const canEdit = Boolean(user?.is_admin || myCompanies.some((item) => item.id === mainCompany.id)); setEditingReadOnly(!canEdit); setEditing(mainCompany); }} className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white">{user?.is_admin || myCompanies.some((item) => item.id === mainCompany.id) ? "수정" : "정보 확인"}</button>}</div></div>
        {notice ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">{notice}</div> : !mainCompany ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-14 text-center"><p className="text-lg font-semibold">표시할 사이트가 없습니다.</p><p className="mt-2 text-sm text-slate-500">좌측 목록에서 + 버튼을 눌러 상세 정보를 열어보세요.</p></div> : <><div className="mb-5 flex flex-wrap gap-2">{selected.map((company) => <button key={company.id} onClick={() => { setActiveCompanyId(company.id); }} className={`rounded-full px-3 py-1.5 text-[11px] ${company.id === mainCompany.id ? "bg-blue-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>{company.name}<span onClick={(event) => { event.stopPropagation(); toggleCompany(company.id); }} className="ml-2 opacity-70">×</span></button>)}<button type="button" onClick={() => { setSelectedIds([]); setActiveCompanyId(null); }} title="열린 사이트 탭 모두 닫기" aria-label="열린 사이트 탭 모두 닫기 clear" className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-600 hover:bg-blue-600 hover:text-white">clear</button></div><nav className="mb-5 flex overflow-x-auto border-b border-slate-200">{([['detail','상세 정보'],['basic','기본 정보'],['solutions','구축 솔루션'],['hardware','HW 정보'],['search','검색']] as [Tab,string][]).map(([key,label]) => <button key={key} onClick={() => setActiveTab(key)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>{label}</button>)}</nav><Content tab={activeTab} company={mainCompany} allCompanies={allCompanies} onOpenSearchCompany={(company) => { setEditingReadOnly(!myCompanies.some((item) => item.id === company.id)); setEditing(company); }} /></>}</section>
      <aside className="border-l border-slate-200 bg-white p-4">{rightOpen ? <><div className="mb-4"><button onClick={() => setRightOpen(false)} aria-label="변경 이력 접기" className="rounded-md border px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">›</button></div><HistoryPanel company={mainCompany} /></> : <button onClick={() => setRightOpen(true)} aria-label="변경 이력 펼치기" className="grid h-9 w-full place-items-center rounded-md border text-lg text-slate-600 hover:bg-slate-50">‹</button>}</aside>
    </div>{showAdd && <AddSiteDialog onClose={() => setShowAdd(false)} onCreate={createCompany} onPreview={previewImport} onImport={commitImport} onBackToManagement={fromSiteManagement ? () => { setShowAdd(false); setEditing(null); setFromSiteManagement(false); setShowSiteManagement(true); } : undefined} />}{editing && <AddSiteDialog onClose={() => { setEditing(null); setEditingReadOnly(false); }} onCreate={updateCompany} onPreview={previewImport} onImport={commitImport} onBackToManagement={fromSiteManagement ? () => { setShowAdd(false); setEditing(null); setFromSiteManagement(false); setShowSiteManagement(true); } : undefined} editMode readOnly={editingReadOnly} initialValues={editInitialValues(editing)} />}
    {showSiteManagement && <SiteManagementModal companies={user?.is_admin ? allCompanies : myCompanies} onClose={() => setShowSiteManagement(false)} onAdd={() => { setShowSiteManagement(false); setFromSiteManagement(true); setShowAdd(true); }} onEdit={(company) => { setShowSiteManagement(false); setFromSiteManagement(true); setEditing(company); }} onDelete={deleteCompany} isAdmin={Boolean(user?.is_admin)} onAssignments={() => { setShowSiteManagement(false); setShowAssignments(true); }} />}
    {showPassword && <PasswordModal onClose={() => setShowPassword(false)} />}
    {user?.is_admin && <button type="button" onClick={() => setShowUserSwitch((current) => !current)} className="fixed right-5 top-4 z-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-600 hover:bg-blue-600 hover:text-white">사용자 전환</button>}
    {user && <AdminReturnControl />}
    {showUserManagement && <AdminUserManagementEditor onClose={() => setShowUserManagement(false)} />}
    {showUserSwitch && user?.is_admin && <AdminSwitchPanel onClose={() => setShowUserSwitch(false)} />}
    {showAssignments && <AssignmentModal companies={allCompanies} onClose={() => { setShowAssignments(false); void refreshSiteData(); }} onBack={() => { setShowAssignments(false); setShowSiteManagement(true); }} />}
  </main>;
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem("kdy_auth_user") ?? "{}"); return { username: saved.username ?? "", name: saved.name ?? "", email: saved.email ?? "" }; }
    catch { return { username: "", name: "", email: "" }; }
  });
  const [message, setMessage] = useState("");
  const headers = { Authorization: `Token ${typeof window === "undefined" ? "" : localStorage.getItem("kdy_auth_token")}`, "Content-Type": "application/json" };
  useEffect(() => { fetch(`${API}/auth/profile/`, { headers }).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.username) setProfile((current) => ({ ...current, ...data })); }).catch(() => undefined); }, []);
  async function saveProfile(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const response = await fetch(`${API}/auth/profile/`, { method: "PATCH", headers, body: JSON.stringify({ name: profile.name, email: profile.email }) }); const data = await response.json(); setMessage(data.detail ?? "내 정보를 저장하지 못했습니다."); }
  async function changePassword() { const current = window.prompt("현재 비밀번호를 입력하세요."); if (current === null) return; const password = window.prompt("새 비밀번호를 입력하세요. (8자 이상)"); if (password === null) return; const response = await fetch(`${API}/auth/change-password/`, { method: "POST", headers, body: JSON.stringify({ current_password: current, password }) }); const data = await response.json(); setMessage(data.detail ?? "비밀번호를 변경하지 못했습니다."); }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"><form onSubmit={saveProfile} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center"><h2 className="flex-1 text-center text-xl font-bold">내 정보 수정</h2><button type="button" onClick={onClose} aria-label="닫기" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-2xl font-bold text-slate-700 ring-1 ring-slate-300">×</button></div><label className="mt-5 block text-sm font-semibold text-slate-600">사용자 ID<input value={profile.username} readOnly className="mt-1 w-full rounded border border-slate-200 bg-slate-100 p-3 text-slate-500" /></label><label className="mt-3 block text-sm font-semibold text-slate-600">이름<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className="mt-1 w-full rounded border p-3 font-normal" /></label><label className="mt-3 block text-sm font-semibold text-slate-600">이메일<input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} className="mt-1 w-full rounded border p-3 font-normal" /></label><div className="mt-5 flex justify-end gap-2">{profile.username !== "brainz" && <button type="button" onClick={changePassword} className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold">PW 수정</button>}<button className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold">저장</button></div><p className="mt-3 text-sm text-slate-600">{message}</p></form></div>
}
function AssignmentModal({ companies, onClose, onBack }: { companies: Company[]; onClose: () => void; onBack: () => void }) { const [users, setUsers] = useState<{id:number;username:string;name:string;company_ids:number[]}[]>([]); const [userId,setUserId]=useState(0); const [availableQuery,setAvailableQuery]=useState(""); const [assignedQuery,setAssignedQuery]=useState(""); const [availableScope,setAvailableScope]=useState<"site"|"code">("site"); const [assignedScope,setAssignedScope]=useState<"site"|"code">("site"); const [userQuery,setUserQuery]=useState(""); const headers={Authorization:`Token ${typeof window === "undefined" ? "" : localStorage.getItem("kdy_auth_token")}`}; useEffect(()=>{fetch(`${API}/admin/users/`,{headers}).then(r=>r.json()).then(rows=>{const eligible=rows.filter((u: {is_admin:boolean;is_active:boolean})=>!u.is_admin&&u.is_active);setUsers(eligible);setUserId(eligible[0]?.id??0);});},[]); const current=users.find(u=>u.id===userId); const matches=(company:Company, query:string, scope:"site"|"code")=>(scope==="site"?company.name:`${company.business_code} ${company.maintenance_code}`).toLowerCase().includes(query.toLowerCase()); const matchesUser=(u: {username:string;name:string}, query:string)=>[u.username,u.name ?? ""].some(value=>value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())); const orderedUsers=[...users].sort((a,b)=>(a.name.trim()||a.username).localeCompare(b.name.trim()||b.username,"ko")||a.username.localeCompare(b.username,"ko")); const visibleUsers=orderedUsers.filter(u=>matchesUser(u,userQuery)); const userOptionsKey=JSON.stringify(orderedUsers.map(u=>[u.id,u.username,u.name])); const assigned=(current?.company_ids??[]).map(id=>companies.find(c=>c.id===id)).filter((c): c is Company => Boolean(c)).filter(c=>matches(c,assignedQuery,assignedScope));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dropTarget, setDropTarget] = useState<"available" | "assigned" | null>(null);
  const [latestAssignment, setLatestAssignment] = useState<{ userId: number; siteId: number } | null>(null);
  const assignedListRef = useRef<HTMLDivElement>(null);
  function toggle(id: number) {
    if (!current || saving) return;
    const removing = current.company_ids.includes(id);
    if (!removing) {
      setAssignedQuery("");
      setLatestAssignment({ userId, siteId: id });
    } else if (latestAssignment?.siteId === id && latestAssignment.userId === userId) {
      setLatestAssignment(null);
    }
    setUsers(rows => rows.map(user => {
      if (user.id === userId) return { ...user, company_ids: removing ? user.company_ids.filter(siteId => siteId !== id) : [id, ...user.company_ids] };
      if (!removing) return { ...user, company_ids: user.company_ids.filter(siteId => siteId !== id) };
      if (user.username === "brainz") return { ...user, company_ids: [id, ...user.company_ids.filter(siteId => siteId !== id)] };
      return user;
    }));
  }
  useEffect(() => {
    if (latestAssignment?.userId === userId) assignedListRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [latestAssignment, userId]);
  useEffect(() => {
    const keyword = userQuery.trim().toLocaleLowerCase();
    const matches = orderedUsers.filter(user => [user.username, user.name ?? ""].some(value => value.toLocaleLowerCase().includes(keyword)));
    setUserId(selectedId => {
      if (keyword && matches.length) return matches[0].id;
      return matches.some(user => user.id === selectedId) ? selectedId : 0;
    });
  }, [userOptionsKey, userQuery]);
  const available = companies.filter(c => matches(c, availableQuery, availableScope));
  const fieldClass = "h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500";
  const siteName = current ? (current.name ? `${current.name} (${current.username})` : current.username) : "";
  async function saveAssignments() {
    if (!current || saving) return;
    setSaving(true); setSaveError("");
    try {
      const response = await fetch(`${API}/admin/assignments/`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ user_id: current.id, company_ids: current.company_ids }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.detail ?? "할당 정보를 저장하지 못했습니다."); }
      onClose();
    } catch (error) { setSaveError(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  function dropSite(event: React.DragEvent, target: "available" | "assigned") {
    event.preventDefault(); setDropTarget(null);
    const id = Number(event.dataTransfer.getData("company-id"));
    if (!current || saving || !companies.some(c => c.id === id)) return;
    if (target === "assigned" ? !current.company_ids.includes(id) : current.company_ids.includes(id)) toggle(id);
  }
  return <div role="dialog" aria-modal="true" aria-labelledby="assignment-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 sm:p-6">
    <section className="flex max-h-[calc(100dvh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
      <header className="grid shrink-0 grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-200 px-5 py-5 sm:grid-cols-[160px_1fr_160px] sm:px-6">
        <button type="button" disabled={saving} onClick={onBack} className="w-fit rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"><span aria-hidden="true" className="mr-2">←</span>사이트 관리</button>
        <div className="order-3 col-span-2 text-center sm:order-none sm:col-span-1"><h2 id="assignment-title" className="text-xl font-bold text-slate-900">사이트 사용자 할당 관리</h2><p className="mt-1 text-xs text-slate-500">사용자를 선택한 뒤 사이트를 클릭하거나 끌어서 할당하세요.</p></div>
        <button type="button" disabled={saving} onClick={onClose} aria-label="닫기" className="grid h-10 w-10 justify-self-end place-items-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 disabled:opacity-40">×</button>
      </header>
      <div className="min-h-0 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px_minmax(0,1fr)]">
          <section onDragOver={event => { event.preventDefault(); setDropTarget("available"); }} onDragLeave={() => setDropTarget(null)} onDrop={event => dropSite(event, "available")} className={`min-w-0 overflow-hidden rounded-xl border bg-white ${dropTarget === "available" ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="text-sm font-bold text-slate-700">전체 사이트</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{available.length}개</span></div>
            <div className="flex gap-2 border-b border-slate-100 p-3"><select aria-label="전체 사이트 검색 기준" value={availableScope} onChange={e => setAvailableScope(e.target.value as "site" | "code")} className={`${fieldClass} w-32 shrink-0 px-3`}><option value="site">사이트명</option><option value="code">코드</option></select><input aria-label="전체 사이트 검색" value={availableQuery} onChange={e => setAvailableQuery(e.target.value)} placeholder={availableScope === "site" ? "사이트명 검색" : "코드 검색"} className={`${fieldClass} flex-1`} /></div>
            <div className="h-64 overflow-y-auto overscroll-contain p-2 lg:h-[min(42vh,420px)]">
              {available.length ? available.map(c => <button type="button" disabled={!current || saving} draggable={Boolean(current) && !saving} onDragStart={e => e.dataTransfer.setData("company-id", String(c.id))} onClick={() => toggle(c.id)} key={c.id} className="mb-1 flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"><span className="min-w-0 flex-1"><span className="block truncate font-medium" title={c.name}>{c.name}</span><span className="block text-xs opacity-60">{c.business_code || c.maintenance_code || "코드 미입력"}</span></span><span className="shrink-0 text-xs">{current?.company_ids.includes(c.id) ? "✓ 할당됨" : "+"}</span></button>) : <p className="p-8 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>}
            </div>
          </section>
          <section className="order-first min-w-0 rounded-xl border border-slate-200 bg-white p-4 lg:order-none">
            <h3 className="mb-4 text-center text-sm font-bold text-slate-700">사용자 선택</h3>
            <label className="mb-2 block text-xs font-semibold text-slate-500" htmlFor="assignment-user-search">ID · 이름 검색</label>
            <input id="assignment-user-search" type="search" disabled={saving} value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder="ID 또는 사용자 이름" className={`${fieldClass} mb-3 w-full`} />
            <select aria-label="할당할 사용자 선택" disabled={saving} value={userId} onChange={e => setUserId(Number(e.target.value))} className={`${fieldClass} w-full`}><option value={0} disabled>{visibleUsers.length ? "사용자를 선택하세요" : "검색 결과가 없습니다"}</option>{visibleUsers.map(u => <option key={u.id} value={u.id}>{u.name ? `${u.name} (${u.username})` : u.username}</option>)}</select>
            {userQuery.trim() && <p role="status" className="mt-2 text-center text-xs text-slate-500">{visibleUsers.length ? `검색 결과 ${visibleUsers.length}명 · 이름순 첫 사용자를 자동 선택합니다.` : "검색 결과가 없습니다."}</p>}
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-center"><p className="text-xs font-medium text-slate-500">선택한 사용자</p><p className="mt-2 break-words text-sm font-bold text-slate-800">{siteName || "선택해 주세요"}</p><p className="mt-2 text-xs text-blue-700">할당 사이트 {current?.company_ids.length ?? 0}개</p></div>
            <div className="mt-5 text-center text-xs leading-6 text-slate-500"><p>전체 사이트 → 할당 추가</p><p>할당 사이트 → 할당 해제</p><p className="mt-2">변경 후 오른쪽 아래 저장을 눌러주세요.</p></div>
          </section>
          <section onDragOver={event => { event.preventDefault(); setDropTarget("assigned"); }} onDragLeave={() => setDropTarget(null)} onDrop={event => dropSite(event, "assigned")} className={`min-w-0 overflow-hidden rounded-xl border bg-white ${dropTarget === "assigned" ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="text-sm font-bold text-slate-700">할당 사이트</h3><span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{assigned.length}개</span></div>
            <div className="flex gap-2 border-b border-slate-100 p-3"><select aria-label="할당 사이트 검색 기준" value={assignedScope} onChange={e => setAssignedScope(e.target.value as "site" | "code")} className={`${fieldClass} w-32 shrink-0 px-3`}><option value="site">사이트명</option><option value="code">코드</option></select><input aria-label="할당 사이트 검색" value={assignedQuery} onChange={e => setAssignedQuery(e.target.value)} placeholder={assignedScope === "site" ? "사이트명 검색" : "코드 검색"} className={`${fieldClass} flex-1`} /></div>
            <div ref={assignedListRef} className="h-64 overflow-y-auto overscroll-contain p-2 lg:h-[min(42vh,420px)]">
              {assigned.map(c => <button type="button" disabled={saving} draggable={!saving} onDragStart={e => e.dataTransfer.setData("company-id",String(c.id))} onClick={() => toggle(c.id)} key={c.id} className={`mb-1 flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm ${latestAssignment?.userId === userId && latestAssignment.siteId === c.id ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}><span className="min-w-0 flex-1"><span className="block truncate font-medium" title={c.name}>{c.name}</span><span className="block text-xs opacity-60">{c.business_code || c.maintenance_code || "코드 미입력"}</span></span>{latestAssignment?.userId === userId && latestAssignment.siteId === c.id && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">추가됨</span>}<span aria-label="할당 해제" className="text-lg">×</span></button>)}
              {!assigned.length && <div className="m-2 rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm leading-6 text-slate-400">{!current ? "먼저 사용자를 선택하세요." : assignedQuery ? "검색 결과가 없습니다." : "사이트를 이곳으로 끌어 놓으세요."}</div>}
            </div>
          </section>
        </div>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
        <p role={saveError ? "alert" : undefined} className={`text-xs ${saveError ? "text-red-600" : "text-slate-500"}`}>{saveError || "할당을 해제해도 사이트 데이터는 삭제되지 않습니다."}</p>
        <button type="button" disabled={!current || saving} onClick={() => void saveAssignments()} className="ml-auto min-w-24 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">{saving ? "저장 중…" : "저장"}</button>
      </footer>
    </section>
  </div>;
}
function sortSiteList(sites: Company[], descending: boolean) { return [...sites].sort((left, right) => (descending ? -1 : 1) * left.name.localeCompare(right.name, "ko")); }
function SortButton({ descending, onClick }: { descending: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} title={descending ? "사이트명 오름차순으로 정렬" : "사이트명 내림차순으로 정렬"} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-blue-600 hover:bg-blue-600 hover:text-white">정렬 {descending ? "↓" : "↑"}</button> }
function UserSiteGroups({ groups, companies, selectedIds, onToggle, searching = false }: { groups: { id: number; username: string; name: string; company_ids: number[] }[]; companies: Company[]; searching?: boolean; selectedIds: number[]; onToggle: (id: number) => void }) { const [descending, setDescending] = useState(false); const orderedGroups = groups.filter((group) => !searching || group.company_ids.some((id) => companies.some((company) => company.id === id))).sort((left, right) => (descending ? -1 : 1) * (left.name || left.username).localeCompare(right.name || right.username, "ko")); return <section className="mb-6 border-t pt-4"><div className="sticky top-0 z-20 mb-2 flex items-center justify-between border-b border-slate-100 bg-white py-2"><h2 className="text-sm font-bold">사용자별 사이트</h2><SortButton descending={descending} onClick={() => setDescending((current) => !current)} /></div><div className="space-y-2">{searching && orderedGroups.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">검색 결과가 없습니다.</p>}{orderedGroups.map((group) => { const sites = sortSiteList(group.company_ids.map((id) => companies.find((company) => company.id === id)).filter((company): company is Company => Boolean(company)), descending); return <details key={group.id} open={searching} className="rounded-lg border border-slate-200 bg-slate-50"><summary className="sticky top-10 z-10 cursor-pointer rounded-t-lg border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">{group.name || group.username} <span className="text-xs font-normal text-slate-500">({group.username} · {sites.length})</span></summary><div className="divide-y divide-slate-200 border-t border-slate-200 bg-white px-1">{sites.length ? sites.map((site) => <button key={site.id} type="button" draggable onDragStart={(event) => event.dataTransfer.setData("company-id", String(site.id))} onClick={() => onToggle(site.id)} className={`flex w-full cursor-grab items-center gap-2 px-2 py-1 text-left text-[12px] leading-4 active:cursor-grabbing hover:bg-blue-50 ${selectedIds.includes(site.id) ? "bg-blue-50" : ""}`}><span className="text-slate-400">└</span><span className="min-w-0 truncate">{site.name}</span></button>) : <p className="px-2 py-2 text-xs text-slate-400">담당 사이트가 없습니다.</p>}</div></details>; })}</div></section> }
function ManagementMenu({ isAdmin, onManageSites, onUsers }: { isAdmin: boolean; onManageSites: () => void; onUsers: () => void }) {
  const [manage, setManage] = useState<"options" | null>(null);
  const menuClass = "block w-full bg-slate-50 px-3 py-3 text-center text-sm font-medium text-slate-700 hover:bg-blue-600 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:-outline-offset-2";
  return <section className="mt-10 border-t pt-4">
    <p className="mb-3 text-center text-[15px] font-bold text-slate-700">관리 메뉴</p>
    <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
      <button type="button" onClick={onManageSites} className={menuClass}>사이트 관리</button>
      {isAdmin && <button type="button" onClick={onUsers} className={menuClass}>사용자 관리</button>}
      <button type="button" onClick={() => setManage("options")} className={menuClass}>항목 관리</button>
    </div>
    {manage && <ManagementModal kind={manage} onClose={() => setManage(null)} />}
  </section>;
}
function SiteSection({ title, count, sites, selectedIds, onToggle, onAdd, muted = false, searching = false }: { title: string; count: number; sites: Company[]; selectedIds: number[]; onToggle: (id: number) => void; onAdd?: () => void; searching?: boolean; muted?: boolean }) { const [descending, setDescending] = useState(false); const [open, setOpen] = useState(false); useEffect(() => { setOpen(searching); }, [searching]); const orderedSites = sortSiteList(sites, descending); return <section className="mb-6"><div className="sticky top-0 z-20 mb-2 flex items-center justify-between border-b border-slate-100 bg-white py-2"><h2><button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="text-sm font-bold text-slate-800 hover:text-blue-700"><span aria-hidden="true">{open ? "▾" : "▸"}</span> {title}</button></h2><div className="flex items-center gap-2"><SortButton descending={descending} onClick={() => setDescending((current) => !current)} />{onAdd && <button onClick={onAdd} aria-label="사이트 추가" className="grid h-6 w-6 place-items-center rounded-md bg-blue-600 text-lg leading-none text-white hover:bg-blue-700">+</button>}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{count}</span></div></div>{open && <div className="divide-y divide-slate-200">{orderedSites.length === 0 ? <p className="px-2 py-3 text-xs text-slate-400">등록된 사이트가 없습니다.</p> : orderedSites.map((site) => <div key={site.id} draggable onDragStart={(event) => event.dataTransfer.setData("company-id", String(site.id))} className={`flex cursor-grab items-center gap-2 px-2 py-1 active:cursor-grabbing ${selectedIds.includes(site.id) ? "bg-blue-50" : "hover:bg-slate-50"}`}><button onClick={() => onToggle(site.id)} className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-slate-300 text-sm text-slate-600 hover:border-blue-500 hover:text-blue-600">{selectedIds.includes(site.id) ? "−" : "+"}</button><div className="min-w-0"><p className="truncate text-[12px] leading-4 font-medium">{site.name}</p><p className="truncate text-xs text-slate-500">{muted ? site.contract_type || "계약구분 미입력" : site.business_code || site.maintenance_code || "코드 미입력"}</p></div></div>)}</div>}</section> }
function RegularSiteLists({ mine, others, selectedIds, onToggle, onAdd, searching = false }: { searching?: boolean; mine: Company[]; others: Company[]; selectedIds: number[]; onToggle: (id: number) => void; onAdd: () => void }) { const [mineOpen, setMineOpen] = useState(true); const [otherOpen, setOtherOpen] = useState(searching); const [mineDescending, setMineDescending] = useState(false); const [otherDescending, setOtherDescending] = useState(false); const block = (title: string, sites: Company[], open: boolean, setOpen: (value: boolean) => void, descending: boolean, setDescending: (value: boolean) => void, add?: boolean) => <section className="mb-5"><div className="sticky top-0 z-20 mb-2 flex items-center justify-between border-b border-slate-100 bg-white py-2"><button type="button" onClick={() => setOpen(!open)} className="text-sm font-bold text-slate-800 hover:text-blue-700">{open ? "▾" : "▸"} {title}</button><div className="flex items-center gap-2"><SortButton descending={descending} onClick={() => setDescending(!descending)} />{add && <button type="button" onClick={onAdd} aria-label="사이트 추가" className="grid h-6 w-6 place-items-center rounded-md bg-blue-600 text-lg leading-none text-white hover:bg-blue-700">+</button>}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{sites.length}</span></div></div>{open && <div className="divide-y divide-slate-200">{sites.length ? sortSiteList(sites, descending).map((site) => <div key={site.id} draggable onDragStart={(event) => event.dataTransfer.setData("company-id", String(site.id))} className={`flex cursor-grab items-center gap-2 px-2 py-1 active:cursor-grabbing ${selectedIds.includes(site.id) ? "bg-blue-50" : "hover:bg-slate-50"}`}><button type="button" onClick={() => onToggle(site.id)} className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-slate-300 text-sm text-slate-600 hover:border-blue-500 hover:text-blue-600">{selectedIds.includes(site.id) ? "−" : "+"}</button><div className="min-w-0"><p className="truncate text-[12px] leading-4 font-medium">{site.name}</p><p className="truncate text-xs text-slate-500">{site.business_code || site.maintenance_code || "코드 미입력"}</p></div></div>) : <p className="px-2 py-3 text-xs text-slate-400">등록된 사이트가 없습니다.</p>}</div>}</section>; return <>{block("담당 사이트", mine, mineOpen, setMineOpen, mineDescending, setMineDescending, true)}{block("타 사이트", others, otherOpen, setOtherOpen, otherDescending, setOtherDescending)}</>; }
function ManagementModal({ kind, onClose }: { kind: "users" | "options"; onClose: () => void }) { const [items, setItems] = useState<{ id: number; category: string; value: string }[]>([]); const [category, setCategory] = useState("계약구분"); const [value, setValue] = useState(""); const token = typeof window === "undefined" ? "" : localStorage.getItem("kdy_auth_token") ?? ""; useEffect(() => { if (kind === "options") fetch(`${API}/lookup-options/`, { headers: { Authorization: `Token ${token}` } }).then((r) => r.json()).then((data) => setItems(Array.isArray(data) ? data : data.results ?? [])); }, [kind, token]); async function add() { if (!value.trim()) return; const r = await fetch(`${API}/lookup-options/`, { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ category, value: value.trim() }) }); const data = await r.json(); if (!r.ok) { alert(data.detail ?? Object.values(data).flat().join(" ")); return; } setItems((current) => [...current, data]); setValue(""); } async function save() { await Promise.all(items.map((item) => fetch(`${API}/lookup-options/${item.id}/`, { method: "PATCH", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ value: item.value }) }))); alert("저장되었습니다."); } async function remove(id: number) { await fetch(`${API}/lookup-options/${id}/`, { method: "DELETE", headers: { Authorization: `Token ${token}` } }); setItems((current) => current.filter((item) => item.id !== id)); } return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center"><h2 className="flex-1 text-center text-xl font-bold">{kind === "users" ? "사용자 관리" : "항목 관리"}</h2><div className="flex gap-3"><button onClick={onClose} aria-label="닫기" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-2xl font-bold leading-none text-slate-700 ring-1 ring-slate-300 transition hover:bg-red-50 hover:text-red-600 hover:ring-red-300">×</button></div></div>{kind === "users" ? <p className="mt-5 text-sm text-slate-500">사용자 계정과 비밀번호 관리는 관리자 계정 메뉴에서 관리할 수 있습니다.</p> : <><div className="mt-5 flex gap-2"><select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border px-2 text-sm">{["계약구분", "EMS 패키지", "Server/OS/DB 납품여부", "구축 솔루션", "Dashboard 패키지", "점검지 제출여부", "Set 구성", "OS", "DB"].map((v) => <option key={v}>{v}</option>)}</select><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="선택값" className="min-w-0 flex-1 rounded border px-2 text-sm" /><button onClick={add} className="rounded bg-blue-600 px-3 text-sm text-white">추가</button></div><div className="mt-5 max-h-72 overflow-y-auto"><div className="sticky top-0 z-20 grid grid-cols-[1fr_1fr_auto] gap-3 border-b border-slate-200 bg-white py-3 text-center text-xs font-bold text-slate-500"><span>항목</span><span>선택값</span><span>관리</span></div>{items.filter((item) => item.category === category).map((item) => <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-b py-2 text-center text-sm"><span>{item.category} · </span><span onDoubleClick={(event) => { event.currentTarget.contentEditable = "true"; event.currentTarget.focus(); }} onBlur={(event) => { const value = event.currentTarget.textContent?.trim() ?? ""; event.currentTarget.contentEditable = "false"; if (value && value !== item.value) setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, value } : entry)); }} className="cursor-text" title="더블클릭하여 수정">{item.value}</span><button onClick={() => remove(item.id)} className="text-red-600">삭제</button></div>)}</div><div className="mt-5 flex justify-end"><button onClick={save} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white">저장</button></div></>}</div></div> }
function SiteManagementModal({ companies, onClose, onAdd, onEdit, onDelete, isAdmin = false, onAssignments }: { companies: Company[]; onClose: () => void; onAdd: () => void; onEdit: (company: Company) => void; onDelete: (company: Company) => void; isAdmin?: boolean; onAssignments?: () => void }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"name" | "code">("name");
  type SortColumn = "name" | "contract" | "code" | "primary" | "secondary";
  const [sort, setSort] = useState<{ column: SortColumn; descending: boolean } | null>(null);
  const sortColumns: { key: SortColumn; label: string }[] = [
    { key: "name", label: "사이트명" }, { key: "contract", label: "계약구분" },
    { key: "code", label: "코드" }, { key: "primary", label: "담당자 정" }, { key: "secondary", label: "담당자 부" },
  ];
  const sortValue = (company: Company, column: SortColumn) => {
    const staff = (company.support_staff ?? "").split(" / ");
    return (column === "name" ? company.name : column === "contract" ? company.contract_type : column === "code" ? company.business_code || company.maintenance_code : column === "primary" ? staff[0] : staff.slice(1).join(" / "))?.trim() ?? "";
  };
  const searchTerm = query.trim().toLocaleLowerCase();
  const visibleCompanies = companies.filter((company) => {
    const fields = scope === "name" ? [company.name] : [company.business_code, company.maintenance_code];
    return fields.some((value) => (value ?? "").toLocaleLowerCase().includes(searchTerm));
  });
  if (sort) visibleCompanies.sort((a, b) => {
    const left = sortValue(a, sort.column), right = sortValue(b, sort.column);
    if (!left || !right) return left ? -1 : right ? 1 : a.id - b.id;
    return (sort.descending ? -1 : 1) * left.localeCompare(right, "ko", { numeric: true, sensitivity: "base" }) || a.id - b.id;
  });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5">
    <section className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div className="flex-1 text-center"><p className="text-sm font-semibold text-blue-600">관리 메뉴</p><h2 className="mt-1 text-xl font-bold">사이트 관리</h2><p className="mt-1 text-sm text-slate-500">등록된 사이트를 추가·수정·삭제할 수 있습니다.</p></div>
        <div className="flex items-center gap-3">{isAdmin && <button onClick={onAssignments} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white">사이트 할당 관리</button>}<button onClick={onAdd} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white">사이트 추가</button><button onClick={onClose} aria-label="닫기" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-2xl font-bold leading-none text-slate-700 ring-1 ring-slate-300 transition hover:bg-red-50 hover:text-red-600 hover:ring-red-300">×</button></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select aria-label="사이트 관리 검색 기준" value={scope} onChange={(event) => setScope(event.target.value as "name" | "code")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="name">사이트명</option><option value="code">코드</option>
        </select>
        <input type="search" aria-label="사이트 관리 검색어" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={scope === "code" ? "사업·유지보수 코드 검색" : "사이트명 검색"} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
        {query && <button type="button" onClick={() => setQuery("")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-blue-600 hover:text-white">초기화</button>}
        <span role="status" className="text-sm text-slate-500">{visibleCompanies.length} / {companies.length}건</span>
      </div>
      <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[880px] table-fixed text-center text-sm">
          <colgroup><col className="w-[24%]" /><col className="w-[16%]" /><col className="w-[16%]" /><col className="w-[14%]" /><col className="w-[14%]" /><col className="w-[16%]" /></colgroup>
          <thead className="sticky top-0 z-20 bg-slate-50 text-sm font-bold text-slate-500">
            <tr>{sortColumns.map(({ key, label }) => <th key={key} scope="col" aria-sort={sort?.column === key ? sort.descending ? "descending" : "ascending" : "none"} className="border-b px-3 py-3"><button type="button" onClick={() => setSort((current) => ({ column: key, descending: current?.column === key ? !current.descending : false }))} className="w-full rounded px-1 py-1 font-bold" title={`${label} 기준 ${sort?.column === key && !sort.descending ? "내림차순" : "오름차순"} 정렬`}>{label} <span aria-hidden="true">{sort?.column === key ? sort.descending ? "▼" : "▲" : "↕"}</span></button></th>)}<th scope="col" className="border-b px-3 py-3">관리</th></tr>
          </thead>
          <tbody>
            {visibleCompanies.length === 0 ? <tr><td colSpan={6} className="p-8 text-slate-400">{companies.length === 0 ? "등록된 사이트가 없습니다." : "검색 결과가 없습니다."}</td></tr> : visibleCompanies.map((company) => {
              const staff = (company.support_staff ?? "").split(" / ");
              const primary = staff[0]?.trim() || "-";
              const secondary = staff.slice(1).join(" / ").trim() || "-";
              return <tr key={company.id} className="border-b last:border-0">
                <td className="break-words px-3 py-3 font-semibold">{company.name}</td>
                <td className="break-words px-3 py-3 text-slate-600">{company.contract_type || "-"}</td>
                <td className="break-words px-3 py-3 text-slate-600">{company.business_code || company.maintenance_code || "-"}</td>
                <td className="break-words px-3 py-3 text-slate-600">{primary}</td>
                <td className="break-words px-3 py-3 text-slate-600">{secondary}</td>
                <td className="px-2 py-3"><div className="flex justify-center gap-2 whitespace-nowrap"><button type="button" onClick={() => onEdit(company)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white">수정</button><button type="button" onClick={() => onDelete(company)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white">삭제</button></div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}



type ImportPreview = { sheet_name: string; mapped: { field: string; label: string; value: string }[]; missing: { field: string; label: string; reason: string }[]; unmapped_source_labels: string[] };
function AddCompanyModal({ onClose, onCreate, onPreview, onImport }: { onClose: () => void; onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>; onPreview: (file: File) => Promise<ImportPreview>; onImport: (file: File) => Promise<void> }) { const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<ImportPreview | null>(null); async function submit(event: FormEvent<HTMLFormElement>) { setSaving(true); setError(""); try { await onCreate(event); } catch (err) { event.preventDefault(); setError(err instanceof Error ? err.message : "사이트를 등록하지 못했습니다."); } finally { setSaving(false); } } async function inspect() { if (!file) return; setSaving(true); setError(""); try { setPreview(await onPreview(file)); } catch (err) { setError(err instanceof Error ? err.message : "파일을 분석하지 못했습니다."); } finally { setSaving(false); } } async function registerImport() { if (!file) return; setSaving(true); setError(""); try { await onImport(file); } catch (err) { setError(err instanceof Error ? err.message : "사이트를 등록하지 못했습니다."); } finally { setSaving(false); } } return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/35 p-5"><form onSubmit={submit} className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-blue-600">새 사이트</p><h2 className="mt-1 text-xl font-bold">사이트 정보 추가</h2><p className="mt-1 text-sm text-slate-500">엑셀 업로드는 미리보기 후 등록합니다.</p></div><button type="button" onClick={onClose} aria-label="닫기" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-2xl font-bold leading-none text-slate-700 ring-1 ring-slate-300 transition hover:bg-red-50 hover:text-red-600 hover:ring-red-300">×</button></div><div className="mt-5 rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4"><label className="block text-sm font-semibold">엑셀 양식 업로드 <input type="file" accept=".xls,.xlsx" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); }} className="mt-2 block w-full text-sm" /></label><div className="mt-3 flex gap-2"><button type="button" disabled={!file || saving} onClick={inspect} className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40">{saving ? "분석 중…" : "업로드 미리보기"}</button>{preview && <button type="button" disabled={saving} onClick={registerImport} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">이 결과로 등록</button>}</div>{preview && <div className="mt-4 space-y-3 text-sm"><p><b>{preview.sheet_name}</b> 시트를 분석했습니다. 매핑 {preview.mapped.length}건, 빈값 {preview.missing.length}건</p><Report title="빈값으로 등록될 웹 항목" items={preview.missing.map((item) => item.label)} /><Report title="인식하지 못한 엑셀 항목" items={preview.unmapped_source_labels} /></div>}</div><div className="my-5 text-center text-xs font-semibold text-slate-400">또는 직접 입력</div><div className="grid gap-4 sm:grid-cols-2"><Field label="사이트명" name="name" required /><Field label="계약 구분" name="contract_type" /><Field label="사업 코드" name="business_code" /><Field label="유지보수 코드" name="maintenance_code" /><Field label="구축년도" name="build_year" type="number" /><Field label="담당 영업" name="sales_manager" /><Field label="지원 인력" name="support_staff" /><Field label="위치" name="address" /><label className="flex items-center gap-2 text-sm sm:col-span-2"><input name="remote_support" type="checkbox" className="h-4 w-4" /> 원격 지원 사용</label></div>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">취소</button><button disabled={saving} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">{saving ? "등록 중…" : "직접 입력으로 등록"}</button></div></form></div> }
function Report({ title, items }: { title: string; items: string[] }) { return <div><p className="font-semibold">{title}</p><p className="mt-1 text-slate-600">{items.length ? items.join(', ') : '없음'}</p></div> }
function Field({ label, name, required = false, type = "text" }: { label: string; name: string; required?: boolean; type?: string }) { return <label className="text-sm font-medium">{label}{required && <span className="ml-1 text-red-500">*</span>}<input name={name} required={required} type={type} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-blue-500" /></label> }
function EditCompanyModal({ company, onClose, onSave }: { company: Company; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => Promise<void> }) { const [error, setError] = useState(""); return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"><form onSubmit={async (event) => { try { await onSave(event); } catch (err) { setError(err instanceof Error ? err.message : "수정하지 못했습니다."); } }} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><p className="text-sm font-semibold text-blue-600">사이트 수정</p><h2 className="text-xl font-bold">{company.name}</h2></div><button type="button" onClick={onClose} aria-label="닫기" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-2xl font-bold leading-none text-slate-700 ring-1 ring-slate-300 transition hover:bg-red-50 hover:text-red-600 hover:ring-red-300">×</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><FieldEdit label="사이트명" name="name" value={company.name} /><FieldEdit label="계약 구분" name="contract_type" value={company.contract_type} /><FieldEdit label="사업 코드" name="business_code" value={company.business_code} /><FieldEdit label="유지보수 코드" name="maintenance_code" value={company.maintenance_code} /><FieldEdit label="담당 영업" name="sales_manager" value={company.sales_manager} /><FieldEdit label="지원 인력" name="support_staff" value={company.support_staff} /><FieldEdit label="주소" name="address" value={company.address} /><FieldEdit label="등록·수정 날짜" name="current_file_date" value={company.current_file_date ?? ""} type="date" /></div><label className="mt-4 flex gap-2 text-sm"><input name="remote_support" type="checkbox" defaultChecked={company.remote_support} />원격 지원 사용</label>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">취소</button><button className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">저장</button></div></form></div> }
function FieldEdit({ label, name, value, type = "text" }: { label: string; name: string; value: string; type?: string }) { return <label className="text-sm font-medium">{label}<input name={name} type={type} defaultValue={value} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label> }

function Content({ tab, company, allCompanies, onOpenSearchCompany }: { tab: Tab; company: Company; allCompanies: Company[]; onOpenSearchCompany: (company: Company) => void }) { const content = tab === "basic" ? <InfoGrid company={company} /> : tab === "solutions" ? <RecordSection title="구축 솔루션 (License)" rows={company.solutions} /> : tab === "hardware" ? <Hardware company={company} /> : tab === "history" ? <History company={company} /> : tab === "search" ? <Search companies={allCompanies} onOpen={onOpenSearchCompany} /> : <Detail company={company} />; return <div className="max-h-[calc(100vh-270px)] overflow-y-auto pr-2">{content}</div>; }
function Detail({ company }: { company: Company }) { return <div className="space-y-5 pr-2"><InfoGrid company={company} /><RecordSection title="계약·제품" rows={company.contract_products} /><RecordSection title="담당자" rows={company.contacts} /><RecordSection title="구축 솔루션 (License)" rows={company.solutions} /><RecordSection title="연동 개발" rows={company.integrations} /><RecordSection title="시스템 구성" rows={company.systems as unknown as Record<string, unknown>[]} /><RecordSection title="설치 위치 정보" rows={company.installation_locations} /><RecordSection title="H/W 구성 정보" rows={company.hardware_specs as unknown as Record<string, unknown>[]} /></div> }
function RecordSection({ title, rows }: { title: string; rows?: Record<string, unknown>[] }) { return <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h3 className="sticky top-0 z-10 border-b border-slate-100 bg-white py-3 font-bold">{title}</h3>{rows?.length ? <div className="mt-3 space-y-2">{rows.map((row, index) => <dl key={index} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">{Object.entries(row).filter(([key]) => !["id", "company"].includes(key) && !(title === "구축 솔루션 (License)" && ["category", "quantity", "license_detail"].includes(key))).map(([key, value]) => <div key={key}><dt className="text-xs text-slate-500">{HISTORY_FIELD_LABELS[key] ?? key}</dt><dd className="mt-1 break-words text-sm">{String(value ?? "-")}</dd></div>)}</dl>)}</div> : <p className="mt-3 text-sm text-slate-500">등록된 정보가 없습니다.</p>}</section> }
function InfoGrid({ company }: { company: Company }) { const data = [['계약 구분',company.contract_type],['사업 코드',company.business_code],['유지보수 코드',company.maintenance_code],['구축년도',company.build_year?.toString()],['담당 영업',company.sales_manager],['지원 인력',company.support_staff],['위치',company.address],['원격 지원',company.remote_support ? '가능' : '미사용']]; return <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h3 className="sticky top-0 z-10 border-b border-slate-100 bg-white py-3 font-bold">기본 정보</h3><dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{data.map(([label,value]) => <div key={label} className="border-b border-slate-100 pb-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium">{value || "미입력"}</dd></div>)}</dl></div> }
function Hardware({ company }: { company: Company }) {
  const targetLabel: Record<string, string> = { manager_1: "Manager #1", manager_2: "Manager #2", database: "DB" };
  return <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h3 className="sticky top-0 z-10 bg-white py-3 font-bold">H/W 구성 정보</h3>{company.hardware_specs.length ? <div className="mt-4 max-h-[45vh] overflow-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="sticky top-0 z-20 border-b bg-white text-slate-500"><tr><th className="pb-3">대상</th><th className="pb-3">CPU</th><th className="pb-3">메모리 (G)</th><th className="pb-3">디스크 (G)</th></tr></thead><tbody>{company.hardware_specs.map((spec) => <tr key={spec.id} className="border-b border-slate-100"><td className="py-3 font-medium">{targetLabel[spec.target] ?? spec.target}</td><td>{spec.cpu || "-"}</td><td>{spec.memory || "-"}</td><td>{spec.disk || "-"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-slate-500">등록된 H/W 정보가 없습니다.</p>}</section>
}
const HISTORY_FIELD_LABELS: Record<string, string> = { name: "사이트명", status: "상태", contract_type: "계약구분", business_code: "사업 코드", maintenance_code: "유지보수 코드", sales_manager: "담당 영업", support_staff: "지원 인력", build_year: "구축년도", build_date: "구축 날짜", current_file_date: "등록·수정 날짜", address: "위치", notes: "참고 사항", special_notes: "특이사항 및 전달사항", remote_support: "원격 지원 사용 여부", supplied_server_os_db: "Server/OS/DB 납품 여부", role: "담당 역할", phone: "전화번호", mobile: "휴대전화", email: "이메일", fax: "팩스", inspection_report_submitted: "점검지 제출 여부", inspection_report_detail: "점검지 제출 내용", product_name: "제품명", package_name: "패키지", version: "버전", installation_location: "설치 위치", configuration: "구성", category: "분류", license_detail: "라이선스", quantity: "수량", used_quantity: "사용 개수", total_quantity: "전체 개수", other_detail: "기타", additional_info: "추가 정보", integration_type: "연동 유형", enabled: "사용 여부", detail: "상세 정보", set_configuration: "Set 구성", os_type: "OS", os_version: "OS 버전", database_type: "DB", database_version: "DB 버전", ip_address: "IP 주소", system_access_info: "시스템 접속 정보", web_access_info: "Web 접속 정보", web_port: "Web 포트", database_port: "DB 포트", dashboard_port: "Dashboard 포트", location_type: "항목", path: "설치 경로", note: "비고", target: "대상", cpu: "CPU", memory: "메모리 (G)", disk: "디스크 (G)", directory: "디렉토리", used_capacity: "사용량", total_capacity: "전체 용량", available_capacity: "가용량", created_at: "등록일", updated_at: "수정일" };
type SearchCategory = "site" | "product" | "dashboard" | "contact" | "location" | "integration" | "system" | "installation" | "hardware" | "notes" | "specialNotes";
const searchCategoryLabel: Record<SearchCategory, string> = {
  site: "사이트 정보", product: "계약·제품", dashboard: "DASHBOARD", contact: "담당자", location: "위치",
  integration: "연동 개발", system: "시스템 구성", installation: "설치 위치 정보", hardware: "H/W 구성 정보",
  notes: "참고 사항", specialNotes: "사이트 특이사항 및 전달사항",
};
const searchTerms = (value: string) => (value.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? []).map((term) => term.replace(/^(["'])|(["'])$/g, "").toLowerCase()).filter(Boolean);
type SearchRow = { company: Company; item: string; content: string };
type SolutionCondition = { solution: string; minimum: string };
type CapacityCondition = { directory: string; field: "used_capacity" | "total_capacity" | "available_capacity"; minimum: string };

function Search({ companies, onOpen }: { companies: Company[]; onOpen: (company: Company) => void }) {
  const [conditions, setConditions] = useState<{ category: SearchCategory; value: string }[]>([{ category: "site", value: "" }]);
  const [solutionConditions, setSolutionConditions] = useState<SolutionCondition[]>([{ solution: "", minimum: "1" }]);
  const [capacityConditions, setCapacityConditions] = useState<CapacityCondition[]>([{ directory: "", field: "available_capacity", minimum: "" }]);
  const [resultQuery, setResultQuery] = useState("");

  const solutionOptions = useMemo(() => Array.from(new Set(companies.flatMap((company) => (company.solutions ?? []).map((item) => String(item.product_name ?? item.category ?? "").trim())).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko")), [companies]);
  const capacityDirectories = useMemo(() => Array.from(new Set(companies.flatMap((company) => (company.hardware_capacities ?? []).map((item) => item.directory).filter(Boolean)))).sort((a, b) => a.localeCompare(b, "ko")), [companies]);
  const solutionName = (item: Record<string, unknown>) => String(item.product_name ?? item.category ?? "").trim();
  const usedQuantity = (item: Record<string, unknown>) => Number(item.used_quantity ?? item.quantity ?? 0);

  const rowsFor = (company: Company, category: SearchCategory) => {
    const recordRows = (rows: Record<string, unknown>[] | undefined, section: string) =>
      (rows ?? []).flatMap((row) => Object.entries(row).filter(([key, value]) => !["id", "company"].includes(key) && value !== null && value !== undefined && String(value).trim() !== "").map(([key, value]) => ({ item: `${section} · ${HISTORY_FIELD_LABELS[key] ?? key}`, content: String(value) })));
    const basic = [{ item: "사이트명", content: company.name }, { item: "계약구분", content: company.contract_type ?? "" }, { item: "사업 코드", content: company.business_code ?? "" }, { item: "유지보수 코드", content: company.maintenance_code ?? "" }, { item: "담당 영업", content: company.sales_manager ?? "" }, { item: "위치", content: company.address ?? "" }].filter((row) => row.content.trim() !== "");
    const contacts = recordRows(company.contacts, "담당자");
    const products = recordRows(company.contract_products, "계약·제품");
    const integrations = recordRows(company.integrations, "연동 개발");
    const systems = recordRows(company.systems as unknown as Record<string, unknown>[], "시스템 구성");
    const installations = recordRows(company.installation_locations, "설치 위치 정보");
    const hardware = recordRows(company.hardware_specs as unknown as Record<string, unknown>[], "H/W 구성 정보");
    const dashboard = products.filter((row) => /dashboard|dash|datamanager/i.test(row.content));
    const options: Record<SearchCategory, { item: string; content: string }[]> = {
      site: basic.filter((row) => row.item !== "위치"), product: products.filter((row) => !dashboard.includes(row)), dashboard, contact: contacts,
      location: basic.filter((row) => row.item === "위치"), integration: integrations, system: systems, installation: installations, hardware,
      notes: [{ item: "참고 사항", content: String((company as unknown as Record<string, unknown>).notes ?? "") }].filter((row) => row.content.trim() !== ""),
      specialNotes: [{ item: "사이트 특이사항 및 전달사항", content: String((company as unknown as Record<string, unknown>).special_notes ?? "") }].filter((row) => row.content.trim() !== ""),
    };
    return options[category] ?? [];
  };

  const textResults = useMemo(() => {
    const active = conditions.filter((condition) => condition.value.trim());
    const rows = companies.flatMap((company) => {
      if (!active.length) return [];
      const groups = active.map((condition) => rowsFor(company, condition.category).filter((row) => searchTerms(condition.value).some((term) => row.content.toLowerCase().includes(term))));
      if (groups.some((group) => !group.length)) return [];
      const unique = new Map<string, { item: string; content: string }>(); groups.flat().forEach((row) => unique.set(`${row.item}|${row.content}`, row));
      return [...unique.values()].map((row) => ({ company, ...row }));
    });
    const terms = searchTerms(resultQuery);
    return !terms.length ? rows : rows.filter((row) => terms.some((term) => `${row.company.name} ${row.item} ${row.content}`.toLowerCase().includes(term)));
  }, [companies, conditions, resultQuery]);

  const activeSolutionConditions = solutionConditions.filter((condition) => condition.solution);
  const activeCapacityConditions = capacityConditions.filter((condition) => condition.minimum);
  const hasCapacitySearch = activeCapacityConditions.length > 0;
  const capacityNumber = (value: string) => Number(String(value).replace(/[^0-9.]/g, "")) || 0;
  const solutionResults = useMemo(() => companies.filter((company) => activeSolutionConditions.every((condition) => (company.solutions ?? []).some((item) => solutionName(item) === condition.solution && usedQuantity(item) >= Number(condition.minimum || 1))) && activeCapacityConditions.every((condition) => (company.hardware_capacities ?? []).some((capacity) => (!condition.directory || capacity.directory === condition.directory) && capacityNumber(capacity[condition.field]) >= Number(condition.minimum)))), [companies, activeSolutionConditions, activeCapacityConditions]);
  const updateText = (index: number, key: "category" | "value", value: string) => setConditions((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const updateSolution = (index: number, key: keyof SolutionCondition, value: string) => setSolutionConditions((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const updateCapacity = (index: number, key: keyof CapacityCondition, value: string) => setCapacityConditions((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const hasSolutionSearch = activeSolutionConditions.length > 0 || hasCapacitySearch;

  return <section className="space-y-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">구축 솔루션 · H/W 용량 검색</h3><p className="mt-1 text-xs text-slate-600">여러 솔루션을 추가하면 모든 조건을 만족하는 사이트만 조회합니다.</p></div><button type="button" onClick={() => setSolutionConditions((rows) => [...rows, { solution: "", minimum: "1" }])} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white">+ 솔루션 조건</button></div>
      <div className="mt-4 space-y-2">{solutionConditions.map((condition, index) => <div key={index} className="flex flex-wrap items-center gap-2"><select value={condition.solution} onChange={(event) => updateSolution(index, "solution", event.target.value)} className="min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">솔루션 선택</option>{solutionOptions.map((solution) => <option key={solution}>{solution}</option>)}</select><span className="text-sm text-slate-600">사용 개수</span><select value={condition.minimum} onChange={(event) => updateSolution(index, "minimum", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="1">1개 이상</option><option value="5">5개 이상</option><option value="10">10개 이상</option><option value="50">50개 이상</option></select><input type="number" min="1" value={condition.minimum} onChange={(event) => updateSolution(index, "minimum", event.target.value)} aria-label="최소 사용 개수" className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" />{solutionConditions.length > 1 && <button type="button" onClick={() => setSolutionConditions((rows) => rows.filter((_, i) => i !== index))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-red-400 hover:text-red-600">삭제</button>}</div>)}</div>
      <div className="mt-4 border-t border-blue-100 pt-4"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">H/W 용량 조건 <span className="ml-1 text-xs font-normal text-slate-500">(여러 조건은 모두 충족)</span></p><button type="button" onClick={() => setCapacityConditions((rows) => [...rows, { directory: "", field: "available_capacity", minimum: "" }])} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white">+ 용량 조건</button></div><div className="space-y-2">{capacityConditions.map((condition, index) => <div key={index} className="flex flex-wrap items-center gap-2"><select value={condition.directory} onChange={(event) => updateCapacity(index, "directory", event.target.value)} className="min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">전체 디렉토리</option>{capacityDirectories.map((directory) => <option key={directory}>{directory}</option>)}</select><select value={condition.field} onChange={(event) => updateCapacity(index, "field", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="used_capacity">사용량</option><option value="total_capacity">전체 용량</option><option value="available_capacity">가용량</option></select><span className="text-sm text-slate-600">이상 (≥)</span><input type="number" min="0" value={condition.minimum} onChange={(event) => updateCapacity(index, "minimum", event.target.value)} placeholder="용량" className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />{capacityConditions.length > 1 && <button type="button" onClick={() => setCapacityConditions((rows) => rows.filter((_, i) => i !== index))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-red-400 hover:text-red-600">삭제</button>}</div>)}</div></div>
      {hasSolutionSearch && <p className="mt-3 text-sm font-semibold text-blue-700">조건 일치 사이트 {solutionResults.length}건 · H/W 사양 및 현재 용량을 아래에서 확인하세요.</p>}
    </div>
    <div><div className="flex items-center justify-between gap-4"><div><h3 className="font-bold">카테고리 문자열 검색</h3><p className="mt-1 text-xs text-slate-500">한 검색어 칸의 공백은 OR 조건이며, 조건을 추가하면 AND 조건입니다.</p></div><button type="button" onClick={() => setConditions((rows) => [...rows, { category: "site", value: "" }])} className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 bg-white text-xl font-semibold text-slate-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white">+</button></div><div className="mt-4 space-y-2">{conditions.map((condition, index) => <div key={index} className="flex gap-2"><select value={condition.category} onChange={(event) => updateText(index, "category", event.target.value)} className="w-40 rounded border border-slate-300 px-2 py-2 text-sm">{(Object.keys(searchCategoryLabel) as SearchCategory[]).map((key) => <option key={key} value={key}>{searchCategoryLabel[key]}</option>)}</select><input value={condition.value} onChange={(event) => updateText(index, "value", event.target.value)} placeholder="검색 문자열 입력" className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" />{conditions.length > 1 && <button type="button" onClick={() => setConditions((rows) => rows.filter((_, i) => i !== index))} className="rounded border border-slate-300 px-3 text-sm text-slate-600">−</button>}</div>)}</div></div>
    <div className="border-t pt-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">검색 결과 <span className="text-blue-600">{hasSolutionSearch ? solutionResults.length : textResults.length}</span>건</p><input value={resultQuery} onChange={(event) => setResultQuery(event.target.value)} placeholder="검색 결과 내 검색" className="w-56 max-w-full rounded border border-slate-300 px-3 py-2 text-sm" /></div>
      {hasSolutionSearch ? <SolutionResultList companies={solutionResults} conditions={activeSolutionConditions} onOpen={onOpen} /> : <div className="mt-3 max-h-[45vh] overflow-auto rounded-lg border border-slate-200"><div className="sticky top-0 z-20 grid min-w-[560px] grid-cols-[minmax(150px,1fr)_minmax(160px,1.2fr)_minmax(180px,2fr)] gap-3 border-b bg-slate-50 px-4 py-3 text-center text-xs font-semibold text-slate-500"><span>사이트명</span><span>항목</span><span>검색된 내용</span></div>{textResults.length ? textResults.map((row, index) => <div key={`${row.company.id}-${row.item}-${row.content}-${index}`} className="grid min-w-[560px] grid-cols-[minmax(150px,1fr)_minmax(160px,1.2fr)_minmax(180px,2fr)] gap-3 border-b px-4 py-3 text-sm last:border-0"><button type="button" onClick={() => onOpen(row.company)} className="text-left font-semibold text-blue-700 hover:underline">{row.company.name}</button><span>{row.item}</span><span className="break-words text-slate-600">{row.content}</span></div>) : <p className="p-8 text-center text-sm text-slate-400">조건에 맞는 항목이 없습니다.</p>}</div>}
    </div>
  </section>;
}

function SolutionResultList({ companies, conditions, onOpen }: { companies: Company[]; conditions: SolutionCondition[]; onOpen: (company: Company) => void }) {
  const label = (item: Record<string, unknown>) => String(item.product_name ?? item.category ?? "");
  return <div className="mt-3 space-y-3">{companies.length ? companies.map((company) => <article key={company.id} className="rounded-xl border border-slate-200 p-4"><button type="button" onClick={() => onOpen(company)} className="font-bold text-blue-700 hover:underline">{company.name}</button><div className="mt-3 grid gap-3 lg:grid-cols-3"><div><p className="text-xs font-bold text-slate-500">일치한 구축 솔루션</p>{conditions.map((condition) => { const item = (company.solutions ?? []).find((solution) => label(solution) === condition.solution); return <p key={condition.solution} className="mt-1 text-sm">{condition.solution}: <b>{String(item?.used_quantity ?? 0)}개</b></p>; })}</div><div><p className="text-xs font-bold text-slate-500">H/W 사양</p>{company.hardware_specs.length ? company.hardware_specs.map((spec) => <p key={spec.id} className="mt-1 text-sm">{spec.target}: CPU {spec.cpu || "-"} / Memory {spec.memory || "-"}G / DISK {spec.disk || "-"}G</p>) : <p className="mt-1 text-sm text-slate-400">등록 없음</p>}</div><div><p className="text-xs font-bold text-slate-500">현재 H/W 용량</p>{company.hardware_capacities?.length ? company.hardware_capacities.map((capacity) => <p key={capacity.id} className="mt-1 text-sm">{capacity.directory}: 사용 {capacity.used_capacity || "-"} / 전체 {capacity.total_capacity || "-"} / 가용 {capacity.available_capacity || "-"}</p>) : <p className="mt-1 text-sm text-slate-400">등록 없음</p>}</div></div></article>) : <p className="mt-3 rounded-lg border border-dashed p-8 text-center text-sm text-slate-400">조건에 맞는 사이트가 없습니다.</p>}</div>;
}

const HISTORY_TABLE_LABELS: Record<string, string> = { excel_upload: "엑셀 업로드", com_company: "사이트 정보", com_contact: "담당자", com_product: "계약·제품", com_lic: "구축 솔루션", com_dev: "연동 개발", com_system: "시스템 구성", com_install: "설치 위치 정보", com_spec: "H/W 구성 정보", com_hw_capacity: "H/W 용량" };
const historyTableLabel = (tableName: string) => HISTORY_TABLE_LABELS[tableName] ?? "사이트 정보";
const historyActionLabel = (action: string) => ({ create: "추가", update: "수정", delete: "삭제" }[action] ?? action);
const historyFieldsLabel = (fields: string[]) => fields.map((field) => HISTORY_FIELD_LABELS[field] ?? field).join(", ") || "변경 항목 없음";
function History({ company }: { company: Company }) { return <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h3 className="font-bold">변경 이력</h3><div className="mt-4 space-y-3">{company.change_history.length ? company.change_history.map((item) => <div key={item.id} className="border-l-2 border-blue-500 pl-4"><p className="text-sm font-semibold">{company.name} · {historyTableLabel(item.table_name)} {historyActionLabel(item.action)}</p><p title={`변경 항목: ${historyFieldsLabel(item.changed_fields)}`} className="mt-1 line-clamp-2 text-sm text-slate-600">변경 항목: {historyFieldsLabel(item.changed_fields)}</p><time className="text-xs text-slate-400">{new Date(item.changed_at).toLocaleString('ko-KR')}</time></div>) : <p className="text-sm text-slate-500">기록된 변경 이력이 없습니다.</p>}</div></div> }
function HistoryPanel({ company }: { company?: Company }) {
  const localDate = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  const day = (offset: number) => localDate(new Date(Date.now() + offset * 86400000));
  const [startDate, setStartDate] = useState(() => day(-6));
  const [endDate, setEndDate] = useState(() => day(0));
  const [query, setQuery] = useState("");
  const activeDays = endDate === day(0) ? startDate === day(-6) ? 7 : startDate === day(-29) ? 30 : null : null;
  const items = (company?.change_history ?? []).filter((item) => {
    const date = localDate(new Date(item.changed_at));
    const text = `${historyTableLabel(item.table_name)} ${historyActionLabel(item.action)} ${historyFieldsLabel(item.changed_fields)}`.toLowerCase();
    return date >= startDate && date <= endDate && text.includes(query.toLowerCase());
  });
  return <section className="max-h-[calc(100vh-120px)] overflow-y-auto pr-1"><div className="sticky top-0 z-20 mb-4 border-b border-slate-200 bg-white pb-3 pt-1"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">변경 이력</p><div className="flex gap-1">{([7, 30] as const).map(days => <button key={days} type="button" onClick={() => { setStartDate(day(-(days - 1))); setEndDate(day(0)); }} aria-pressed={activeDays === days} title={`오늘 포함 최근 ${days}일 조회`} className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition hover:border-blue-600 hover:bg-blue-600 hover:text-white ${activeDays === days ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>{days}D</button>)}</div></div><p className="mt-1 text-xs text-slate-500">{activeDays ? `최근 ${activeDays}일` : "지정 기간"} · {company ? company.name : "사이트를 선택하세요"}</p></div><div className="mb-4 grid grid-cols-2 gap-2"><SegmentedDatePicker label="시작일" value={startDate} onChange={setStartDate} /><SegmentedDatePicker label="종료일" value={endDate} onChange={setEndDate} /></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="항목 또는 변경 유형 검색" className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />{company ? <div className="space-y-3">{items.length ? items.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-3"><p className="text-sm font-semibold">{company.name} · {historyTableLabel(item.table_name)} {historyActionLabel(item.action)}</p><p title={`변경 항목: ${historyFieldsLabel(item.changed_fields)}`} className="mt-1 line-clamp-2 text-xs text-slate-600">변경 항목: {historyFieldsLabel(item.changed_fields)}</p>{item.table_name === "excel_upload" && <details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer text-blue-700">업로드 결과 보기</summary><p className="mt-2">빈값 항목: {Array.isArray(item.after_data.missing) ? (item.after_data.missing as { label: string }[]).map((value) => value.label).join(", ") || "없음" : "없음"}</p></details>}<time className="mt-2 block text-xs text-slate-400">{new Date(item.changed_at).toLocaleString("ko-KR")}</time></article>) : <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">선택한 기간에 해당하는 변경 이력이 없습니다.</p>}</div> : <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">왼쪽에서 사이트를 추가하면 이력이 표시됩니다.</p>}</section>;
}
