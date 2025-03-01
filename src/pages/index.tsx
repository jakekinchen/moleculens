import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LeftPanel } from '@/components/panels/LeftPanel';
import { MiddlePanel } from '@/components/panels/MiddlePanel';
import { RightPanel } from '@/components/panels/RightPanel';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-12rem)]">
          <div className="col-span-3">
            <LeftPanel />
          </div>
          <div className="col-span-6">
            <MiddlePanel />
          </div>
          <div className="col-span-3">
            <RightPanel />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
} 