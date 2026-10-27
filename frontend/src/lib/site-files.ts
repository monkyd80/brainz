export const MAX_SITE_FILE_BYTES = 5 * 1024 * 1024;

export type SiteAttachment = {
  id: number;
  company: number;
  original_name: string;
  uploaded_at: string;
  size: number;
};

export function validateSiteFiles(files: File[]) {
  for (const file of files) {
    if (file.size > MAX_SITE_FILE_BYTES) throw new Error(`${file.name}: 파일당 5MB 이하만 업로드할 수 있습니다.`);
    if (file.size === 0) throw new Error(`${file.name}: 비어 있는 파일은 업로드할 수 없습니다.`);
  }
}

export function siteWriteRequest(payload: Record<string, unknown>, files: File[], headers: Record<string, string>, dashboardImage: File | null = null, removeDashboardImage = false) {
  validateSiteFiles(dashboardImage ? [...files, dashboardImage] : files);
  const data = removeDashboardImage ? { ...payload, remove_dashboard_image: true } : payload;
  if (files.length === 0 && !dashboardImage) return { headers, body: JSON.stringify(data) };
  const body = new FormData();
  body.append("data", JSON.stringify(data));
  for (const file of files) body.append("files", file, file.name);
  if (dashboardImage) body.append("dashboard_image", dashboardImage, dashboardImage.name);
  return { headers: { Authorization: headers.Authorization }, body };
}

export function formatSiteFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatSiteFileDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value));
}
