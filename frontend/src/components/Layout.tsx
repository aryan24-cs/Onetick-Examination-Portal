"use client";
import { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
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
  );
}
