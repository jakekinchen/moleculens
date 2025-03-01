import type { NextPage } from 'next';
import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { VisualizationPanel } from '@/components/panels/VisualizationPanel';
import { InputPanel } from '@/components/panels/InputPanel';

const Home: NextPage = () => {
  const [currentScript, setCurrentScript] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header />
      
      <main className="container mx-auto px-2 py-4 relative h-[calc(100vh-8rem)] min-h-[calc(100vh-8rem)] max-h-[calc(100vh-8rem)]">
        <div className="grid grid-cols-12 gap-2 h-full">
          <div className="col-span-3">
            <InputPanel 
              onVisualizationUpdate={setCurrentScript} 
              onLoadingChange={setIsLoading}
            />
          </div>
          <div className="col-span-9 relative">
            <VisualizationPanel 
              script={currentScript} 
              isLoading={isLoading}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Home; 