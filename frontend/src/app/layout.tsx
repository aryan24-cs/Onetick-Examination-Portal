import { ReactNode } from 'react';
import '../styles/globals.css';

interface LayoutProps {
  children: ReactNode;
  role: string; // Added role prop to fix TS2322 error
}

export default function RootLayout({ children, role }: LayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}