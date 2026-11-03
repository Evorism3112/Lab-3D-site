import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Oswald } from "next/font/google";

import "./taclab.css";

// Root layout of the TACLAB shop: its own look, fonts and chrome, nothing shared with the
// 3D-print site's layout (app/(lab3d)/layout.tsx). Pages live under ./shop (see proxy.ts).

const inter = Inter({ variable: "--font-tl-inter", subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"] });
// Oswald, not the mockup's Barlow Condensed: Barlow has no Cyrillic, so Russian headings fell back.
const display = Oswald({ variable: "--font-tl-display", subsets: ["latin", "cyrillic"], weight: ["500", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-tl-mono", subsets: ["latin", "cyrillic"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "TACLAB — снаряжение собственной разработки", template: "%s — TACLAB" },
  description: "Проектируем, печатаем и собираем сами. Каждое изделие — с серийным номером и гарантией. Доставка СДЭК и Ozon по России.",
};

export default function TaclabRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-tl-bg font-sans text-tl-text">{children}</body>
    </html>
  );
}
