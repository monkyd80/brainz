import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COM_MANAGE",
  description: "업체 정보 통합 관리 시스템",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
