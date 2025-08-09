import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './styles/globals.css';
import './styles/MoleculeViewer.css';
import './styles/audio-waveform.css';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { LayoutWrapper } from './components/layout/LayoutWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Moleculens',
  description: 'Molecular Visualization AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="app-container">
          <Header useConstraints={true} />
          <main className="main-content">
            <LayoutWrapper useConstraints={true}>{children}</LayoutWrapper>
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
