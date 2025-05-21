import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './styles/globals.css';
import './styles/MoleculeViewer.css';
import './styles/audio-waveform.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sci-Viz AI',
  description: 'Scientific Visualization AI Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
