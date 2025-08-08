'use client';

import React, { useState } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { LayoutWrapper } from './components/layout/LayoutWrapper';
import DiagramInputPanel from './components/panels/DiagramInputPanel';
import DiagramViewer from './components/panels/DiagramViewer';
import { DiagramPlan } from './types';

export default function MoleculeDiagram() {
  const [diagramImage, setDiagramImage] = useState<string | null>(null);
  const [diagramPlan, setDiagramPlan] = useState<DiagramPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDiagramUpdate = (image: string, plan: DiagramPlan) => {
    setDiagramImage(image);
    setDiagramPlan(plan);
  };

  return (
    <div className="app-container">
      <Header onOpenTimeMachine={() => {}} onSettingsChange={() => {}} />
      <main className="main-content">
        <LayoutWrapper>
          <div className="panels-container">
            <div className="input-panel-container">
              <DiagramInputPanel
                onDiagramUpdate={handleDiagramUpdate}
                onLoadingChange={setIsLoading}
              />
            </div>
            <div className="molecule-viewer-container">
              {diagramPlan && (
                <DiagramViewer
                  isLoading={isLoading}
                  diagramImage={diagramImage || ''}
                  diagramPlan={diagramPlan}
                />
              )}
            </div>
          </div>
        </LayoutWrapper>
      </main>
      <Footer />
    </div>
  );
}
