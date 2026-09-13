import type { Metadata } from 'next';
import document from '@/components/sections/markup/document.json';
import {BrandMarks} from '@/components/BrandMarks';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aurora | Authentication and User Management',
  description: 'More than authentication. Complete user management, beautiful components, and tools for your next idea.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={document.htmlClass} suppressHydrationWarning>
    <head>
      {['fd31a43f9b','1c85341ad4','ea1283a1b9','504fc9ffd0','044aff8402','8f5d926433','89d3a7b0ec'].map(font=><link key={font} rel="preload" href={`/assets/font-${font}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />)}
      <link rel="stylesheet" href="/base.css" />
    </head>
    <body className={document.bodyClass}>{children}<BrandMarks /></body>
  </html>;
}
