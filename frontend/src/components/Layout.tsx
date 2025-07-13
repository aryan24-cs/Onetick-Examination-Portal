"use client";
import { ReactNode } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import '../styles/globals.css';

interface LayoutProps {
  children: ReactNode;
  role: string; // Added role prop to fix TS2322 error
}

export default function Layout({ children, role }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = pathname.includes('/admin');
  const isUser = pathname.includes('/user');
  const storedRole = localStorage.getItem('role');
  const profileName = localStorage.getItem(isAdmin ? 'adminEmail' : 'studentName') || (isAdmin ? 'Admin' : 'Student');
  const currentSection = searchParams.get('section') || 'dashboard';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('studentId');
    localStorage.removeItem('adminId');
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('studentName');
    router.push('/');
  };

  return (
    <html lang="en">
      <head>
        <title>Test System</title>
        <meta name="description" content="Student Test System Dashboard" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?display=swap&family=Inter:wght@400;500;700;900&family=Noto+Sans:wght@400;500;700;900&family=Public+Sans:wght@400;500;700;900"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="layout">
          {(isAdmin || isUser) && (
            <aside className="sidebar">
              <div className="profile-section">
                <div className="avatar" aria-label={`${storedRole} avatar`}></div>
                <div>
                  <h1>{profileName}</h1>
                  <p>{storedRole === 'admin' ? 'Administrator' : 'Student'}</p>
                </div>
              </div>
              <nav className="nav-links">
                {isAdmin && (
                  <>
                    <Link href="/admin/dashboard" className={`nav-item ${pathname === '/admin/dashboard' ? 'active' : ''}`}>
                      Dashboard
                    </Link>
                    <Link href="/admin/question" className={`nav-item ${pathname === '/admin/question' ? 'active' : ''}`}>
                      Manage Questions
                    </Link>
                  </>
                )}
                {isUser && (
                  <>
                    <Link
                      href="/user/dashboard?section=dashboard"
                      className={`nav-item ${pathname.includes('/user/dashboard') && currentSection === 'dashboard' ? 'active' : ''}`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/user/dashboard?section=tests"
                      className={`nav-item ${pathname.includes('/user/dashboard') && currentSection === 'tests' ? 'active' : ''}`}
                    >
                      Tests
                    </Link>
                    <Link
                      href="/user/dashboard?section=results"
                      className={`nav-item ${pathname.includes('/user/dashboard') && currentSection === 'results' ? 'active' : ''}`}
                    >
                      Results
                    </Link>
                    <Link
                      href="/user/dashboard?section=profile"
                      className={`nav-item ${pathname.includes('/user/dashboard') && currentSection === 'profile' ? 'active' : ''}`}
                    >
                      Profile
                    </Link>
                  </>
                )}
                <button className="nav-item logout" onClick={handleLogout}>
                  Logout
                </button>
              </nav>
            </aside>
          )}
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}