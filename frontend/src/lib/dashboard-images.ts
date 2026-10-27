export type DashboardImage = {
  id: number;
  company: number;
  original_name: string;
  size: number;
  width: number;
  height: number;
  uploaded_at: string;
};

export type DashboardImageTarget = { name: string; image?: DashboardImage | null; file?: File | null };

export function validateDashboardImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error("PNG, JPG, WEBP, GIF 이미지를 선택하세요.");
  if (file.size > 5 * 1024 * 1024) throw new Error("대시보드 이미지는 5MB 이하만 등록할 수 있습니다.");
  if (file.size === 0) throw new Error("비어 있는 이미지는 등록할 수 없습니다.");
}
