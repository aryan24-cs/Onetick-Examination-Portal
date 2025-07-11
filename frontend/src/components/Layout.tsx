'use client';

import { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Test System',
  description: 'Student Test System Dashboard',
};

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?display=swap&family=Noto+Sans:wght@400;500;700;900&family=Public+Sans:wght@400;500;700;900"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="layout">
          <nav className="nav">
            <button onClick={() => router.push('/')}>Home</button>
            {pathname.includes('admin') && (
              <button onClick={() => router.push('/admin/dashboard')}>
                Admin Dashboard
              </button>
            )}
            {pathname.includes('user') && (
              <button onClick={() => router.push('/user/dashboard')}>
                User Dashboard
              </button>
            )}
          </nav>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}