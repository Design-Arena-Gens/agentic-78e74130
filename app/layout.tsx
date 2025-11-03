import type { Metadata } from 'next';
import './globals.css';
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans'
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono'
});

export const metadata: Metadata = {
  title: 'WhisperDrop · Daily ASMR Short',
  description: 'A calming agent that gifts you a fresh, satisfying ASMR short every day at 1pm.',
  manifest: '/manifest.json'
};

export const viewport = {
  themeColor: '#0c1021'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
