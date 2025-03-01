import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { VisualizationPanel } from '@/components/panels/VisualizationPanel';
import { InputPanel } from '@/components/panels/InputPanel';

export default function Home() {
  const [currentScript, setCurrentScript] = useState<string>();

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header />
      
      <main className="flex-grow container mx-auto px-2 py-4 relative">
        <div className="grid grid-cols-12 gap-2 h-[calc(100vh-8rem)]">
          <div className="col-span-3">
            <InputPanel onVisualizationUpdate={setCurrentScript} />
          </div>
          <div className="col-span-9 relative">
            <VisualizationPanel script={currentScript} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
} 