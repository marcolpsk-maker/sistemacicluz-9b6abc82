import { createFileRoute } from "@tanstack/react-router";
import { BrainstormModule } from "@/brainstorm/BrainstormPage";
import { BrainstormMap } from "@/brainstorm/data/types";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/brainstorm-new")({
  ssr: false,
  component: BrainstormPageWrapper,
});

function BrainstormPageWrapper() {
  const [maps, setMaps] = useState<BrainstormMap[]>([]);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<'expanded' | 'collapsed' | 'hidden'>('expanded');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('brainstormMaps');
    if (saved) {
      try {
        setMaps(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load brainstorm maps', e);
      }
    }
  }, []);

  // Save to localStorage
  const handleSaveMaps = (newMaps: BrainstormMap[]) => {
    setMaps(newMaps);
    localStorage.setItem('brainstormMaps', JSON.stringify(newMaps));
  };

  return (
    <BrainstormModule
      maps={maps}
      onSaveMaps={handleSaveMaps}
      activeMapId={activeMapId}
      setActiveMapId={setActiveMapId}
      sidebarMode={sidebarMode}
      setSidebarMode={setSidebarMode}
    />
  );
}
