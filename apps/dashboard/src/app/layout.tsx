import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DRP Control',
  description: 'Emergency Hamburg roleplay community control dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
