import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Open_Sans } from 'next/font/google';
import Providers from '@/components/Providers';
import './globals.css';

// Open Sans là font biến thiên: một file cho mỗi kiểu chữ, đủ mọi độ đậm và dấu tiếng Việt.
const openSans = Open_Sans({ subsets: ['latin', 'vietnamese'], style: ['normal', 'italic'], display: 'swap', variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'IT Connect',
  description: 'Hệ thống quản lý phân quyền đa công ty IT Connect',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={openSans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
