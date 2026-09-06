import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "public-private-innovation-dashboard.vercel.app").split(",")[0].trim();
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(host) ? host : "public-private-innovation-dashboard.vercel.app";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol : /^(localhost|127\.0\.0\.1)(:|$)/.test(safeHost) ? "http" : "https";
  const origin = new URL(`${protocol}://${safeHost}`);
  const title = "AX 조직관리 레이더 | AX Management Radar";
  const description = "공공·민간 비교로 찾는 AX 조직관리 인사이트. 핵심 문항, 통제 후 관계, 실제 패널자료를 사용한 선행연구의 변수와 방법을 확인하고 관측자료의 연관성을 인과효과와 구분합니다.";
  const image = new URL("/og.png", origin).href;
  return {
    metadataBase: origin,
    title,
    description,
    openGraph: {
      type: "website", locale: "ko_KR", siteName: "AX 조직관리 레이더 / AX Management Radar", title, description,
      images: [{ url: image, alt: "AX 조직관리 레이더 — 공공·민간 비교로 찾는 AX 조직관리 인사이트." }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
