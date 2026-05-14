import { createFileRoute } from "@tanstack/react-router";
import { BrainstormModule } from "@/brainstorm/BrainstormPage";
import { BrainstormMap } from "@/brainstorm/data/types";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/brainstorm")({
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
        const parsed = JSON.parse(saved);
        setMaps(parsed);
        // Set first map as active if none selected
        if (parsed.length > 0 && !activeMapId) {
          setActiveMapId(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to load brainstorm maps', e);
      }
    }
  }, []);

  // Save to localStorage whenever maps change
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
