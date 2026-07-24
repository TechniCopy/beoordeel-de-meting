import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { C } from "./shared.jsx";
import MetingGame from "./MetingGame.jsx";

// Alle schermen, voor het Ctrl-D controlemenu
const DEV_SCREENS = [
  { id: "start", label: "Startscherm" },
  { id: "m1intro", label: "Missie 1: introductie" },
  { id: "r1", label: "Ronde 1: De meetklus (stand, meetpunt, sonde)" },
  { id: "r1mc", label: "Ronde 1: MC-controle" },
  { id: "m2intro", label: "Missie 2: introductie" },
  { id: "r2", label: "Ronde 2: Goed of bijstellen? (rapporten)" },
  { id: "r2mc", label: "Ronde 2: MC-controle" },
  { id: "r3", label: "Ronde 3: Welke schroef? (+ CO-tabel)" },
  { id: "r3mc", label: "Ronde 3: MC-controle (laatste)" },
  { id: "end", label: "Eindscherm" },
];

function DevMenu({ onJump, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="rounded-2xl border-2 shadow-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: C.bgCard, borderColor: C.brownText }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold italic text-lg" style={{ color: C.brownText }}>
            Controlemenu <span className="text-xs font-normal not-italic" style={{ color: C.brown }}>(Ctrl-D)</span>
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10">
            <X className="w-5 h-5" style={{ color: C.brownText }} />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {DEV_SCREENS.map((s) => (
            <button
              key={s.id}
              onClick={() => onJump(s.id)}
              className="text-left px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:shadow"
              style={{ borderColor: C.beigeMid, color: C.brownText, backgroundColor: "white" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.oliveLight)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState({ screen: "start", key: 0 });
  const [devOpen, setDevOpen] = useState(false);

  useEffect(() => {
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";
    if (debug) setDevOpen(true);
    const handler = (e) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setDevOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const devJump = (screen) => {
    setDevOpen(false);
    setView((prev) => ({ screen, key: prev.key + 1 }));
  };

  return (
    <>
      <MetingGame key={view.key} initialScreen={view.screen} />
      {devOpen && <DevMenu onJump={devJump} onClose={() => setDevOpen(false)} />}
    </>
  );
}
