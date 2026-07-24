// ─────────────────────────────────────────────────────────────────────────────
// MICROGAME — BEOORDEEL DE METING (lesstof cluster 8.3, leerdoel 18)
// Losse game naast "De rookgasanalyse": hier voer je de rookgasmeting zelf
// uit en beoordeel je concrete meetwaarden tegen de fabrikantswaarden van de
// Remeha Avanta Ace (G20). Zonder fabrikantseis val je terug op de algemene
// CO-grenzen per toesteltype.
//
// Opbouw:
// Missie 1 · Ronde 1  De meetklus          → schoorsteenvegerstand, meetpunt, sonde (+MC)
// Missie 2 · Ronde 2  Goed of bijstellen?  → meetrapporten beoordelen (+MC)
// Missie 2 · Ronde 3  Welke schroef?       → V of K + draairichting, dan tabelcasus (+MC)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle, Wrench, Gauge,
  RotateCw, RotateCcw, Flame, FileText,
} from "lucide-react";
import {
  C, ProgressBar, GameButton, FeedbackPopup, IntroScreen, MCControle,
  EndScreen, StepBanner, RondeIntro, UitlegItem, UitlegStrook,
  useEersteFoutVrij, useGameJuice,
} from "./shared.jsx";

// Maximale score:
// r1 interactie 3×5=15 · r2 rapporten 4×5 + 2×5 (oorzaak) = 30
// r3 schroefcases 3×(5+5)=30 + CO-cases 2×5=10 · 3 MC-controles ×10=30
const MAX_SCORE = 115;

const GAME_ID = "beoordeel-de-meting";

// App-koppeling: de lesstof-app luistert in een iframe mee met de voortgang.
function meldVoortgang(payload) {
  if (window.parent !== window) {
    window.parent.postMessage(
      { type: "microgame:progress", game: GAME_ID, ...payload },
      "*",
    );
  }
}

const fmt1 = (n) =>
  n.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ─── FABRIKANTSWAARDEN AVANTA ACE (G20) EN TABEL ZONDER FABRIKANTSEIS ───

const BAND = {
  vollast: { co2nom: 8.8, co2min: 8.6, co2max: 9.2, o2: 5.2 },
  laaglast: { co2nom: 8.4, co2min: 8.1, co2max: 8.5, o2: 5.9 },
  coMax: 250,
};

const CO_TABEL = [
  { type: "A", omschrijving: "open toestel zonder afvoer", grens: 50 },
  { type: "B", omschrijving: "open toestel met afvoer", grens: 200 },
  { type: "C", omschrijving: "gesloten toestel", grens: 400 },
];

// ─── AANDACHTSPUNTEN EN LEERMOMENTEN ───

const AANDACHT = {
  stand: "Meet altijd in de schoorsteenvegerstand: die dwingt de ketel naar vollast of laaglast, anders moduleert hij tijdens je meting.",
  meetpunt: "Verbrandingskwaliteit en rendement meet je op het rookgasmeetpunt; het meetpunt op het luchttoevoerkanaal is voor de controle op recirculatie.",
  sonde: "De meetsonde hoort circa 7 cm diep in het rookgasmeetpunt.",
  banden: "Leg elke meetwaarde naast de fabrikantstabel: vollast 8,6 tot 9,2% CO₂, laaglast 8,1 tot 8,5%, CO onder 250 ppm.",
  weegschaal: "Te veel lucht: CO₂ laag en O₂ hoog. Te weinig lucht: CO₂ hoog en de CO loopt op.",
  schroef: "Schroef V hoort bij vollast, OFFSET-schroef K bij laaglast; rechtsom draaien verhoogt het CO₂-gehalte en verlaagt het O₂-gehalte.",
  tabel: "Zonder fabrikantseis gelden de algemene CO-grenzen: type A 50, type B 200, type C 400 ppm.",
};

const LEERMOMENTEN = [
  "Meten doe je in de schoorsteenvegerstand: gedwongen vollast of laaglast",
  "Rookgasmeetpunt = verbrandingskwaliteit en rendement · luchttoevoermeetpunt = controle op recirculatie · sonde circa 7 cm diep",
  "Avanta Ace op G20: vollast CO₂ 8,8% (band 8,6 tot 9,2) · laaglast 8,4% (band 8,1 tot 8,5) · CO onder 250 ppm",
  "Te veel lucht: CO₂ zakt en O₂ stijgt · te weinig lucht: CO₂ stijgt en de CO loopt op",
  "Schroef V = vollast, OFFSET-schroef K = laaglast · rechtsom verhoogt CO₂",
  "Geen fabrikantseis? CO-grens per toesteltype: A 50 · B 200 · C 400 ppm",
];

// ─── MC-POOLS (bron: dataset cluster 8.3, leerdoel 18) ───

const POOL_R1 = [
  {
    question: "Hoe voer je bij een Avanta Ace een correcte O₂/CO₂-meting in de rookgassen uit?",
    options: [
      "Zet de ketel via de schoorsteenvegerstand op vol- of laaglast en breng de sonde circa 7 cm in het rookgasmeetpunt",
      "Laat de ketel in normaal bedrijf moduleren en meet met de sonde in de opstellingsruimte naast het toestel",
      "Zet de ketel via de schoorsteenvegerstand op laaglast en breng de sonde circa 7 cm in het meetpunt van het luchttoevoerkanaal",
      "Start de ketel op en meet direct in het rookgasmeetpunt, voordat het toestel op temperatuur is",
    ],
    correct: 0,
    feedbackCorrect: "Precies: gedwongen vol- of laaglast via de schoorsteenvegerstand, en de sonde circa 7 cm in het rookgasmeetpunt. Bron: Avanta Ace handleiding (schoorsteenvegerstand en rookgasmeetpunt).",
    feedbackWrong: "Denk aan de meetklus die je net deed: eerst de schoorsteenvegerstand aan, en de sonde hoort in het rookgasmeetpunt.",
  },
  {
    question: "Waarvoor dient het meetpunt op het luchttoevoerkanaal van een concentrisch aangesloten HR-toestel?",
    options: [
      "Om de gas/luchtverhouding te controleren: de druk in het luchttoevoerkanaal moet gelijk zijn aan de nuldruk van het gasblok",
      "Om recirculatie van verbrandingsproducten vast te stellen: de CO₂-waarde moet gelijk zijn aan de buitenluchtwaarde",
      "Om de temperatuur van de rookgassen te meten voor de rendementsberekening van het toestel op vollast",
      "Om het O₂-gehalte van de rookgassen te meten: dit moet gelijk zijn aan de restzuurstofwaarde op vollast",
    ],
    correct: 1,
    feedbackCorrect: "Klopt: meet je daar meer CO₂ dan in de buitenlucht, dan recirculeren er rookgassen. Bron: Avanta Ace handleiding (meetpunt luchttoevoerkanaal) en Kleintje Gas §6.6.",
    feedbackWrong: "Het luchttoevoerkanaal hoort schone buitenlucht aan te voeren. Wat zou het betekenen als je daar toch verbrandingsproducten meet?",
  },
  {
    question: "Waarom zet je de ketel voor de rookgasanalyse in de schoorsteenvegerstand?",
    options: [
      "De ketel draait dan gedwongen op vollast of laaglast, zodat je bij een vaste belasting kunt meten",
      "De ketel schakelt dan de ventilator uit, zodat de rookgassen niet worden verdund",
      "De ketel spoelt dan eerst het rookgaskanaal door met verse lucht",
      "De ketel draait dan op de hoogste aanvoertemperatuur, zodat het rendement maximaal is",
    ],
    correct: 0,
    feedbackCorrect: "Juist: de schoorsteenvegerstand dwingt de ketel naar vol- of laaglast, zodat hij tijdens de meting niet moduleert. Bron: Avanta Ace handleiding (schoorsteenvegerstand).",
    feedbackWrong: "Een modulerende ketel geeft een zwevende meetwaarde. De schoorsteenvegerstand legt de belasting vast.",
  },
];

const POOL_R2 = [
  {
    question: "Waarom is het CO₂-gehalte in het droge rookgas van een goed werkend G-gastoestel altijd lager dan 11,7%?",
    options: [
      "Omdat 11,7% het theoretische maximum bij stoichiometrische verbranding is en er in de praktijk altijd met luchtovermaat wordt gestookt",
      "Omdat een rookgasanalyser boven 11,7% CO₂ niet meer nauwkeurig meet en de uitlezing daarom softwarematig wordt begrensd",
      "Omdat de waterdamp in het rookgas het CO₂-gehalte verdunt, waardoor de gemeten waarde altijd onder het theoretische maximum blijft",
      "Omdat de ventilator een deel van de rookgassen met de verbrandingslucht terugvoert, waardoor het CO₂-gehalte in het rookgas daalt",
    ],
    correct: 0,
    feedbackCorrect: "Klopt: 11,7% is het theoretische maximum bij G-gas; de luchtovermaat drukt de praktijkwaarde daaronder. Bron: Kleintje Gas §2.4.",
    feedbackWrong: "Denk aan de luchtovermaat: er gaat altijd meer lucht naar de brander dan strikt nodig, en die extra lucht verdunt het CO₂.",
  },
  {
    question: "Bij een Avanta Ace op G20 meet je op vollast een CO₂-gehalte van 9,4%. De controlewaarde is 8,8% met een band van 8,6 tot 9,2%. Hoe beoordeel je deze meting?",
    options: [
      "Bijstellen nodig: 9,4% ligt boven de bovengrens van de band van 8,6 tot 9,2%",
      "In orde: de afwijking van de controlewaarde 8,8% is kleiner dan 1%",
      "In orde: alles onder het theoretische maximum van 11,7% is een goede verbranding",
    ],
    correct: 0,
    feedbackCorrect: "Juist: de band van de fabrikant is leidend, en 9,4% valt daarbuiten. Bron: Avanta Ace handleiding, tabel met CO₂-controlewaarden (G20 vollast 8,8%, band 8,6 tot 9,2%).",
    feedbackWrong: "Vergelijk de meetwaarde altijd met de band van de fabrikant: 8,6 tot 9,2%. Valt de waarde daarbuiten, dan stel je bij.",
  },
  {
    question: "Op vollast meet je bij een Avanta Ace op G20 een CO₂ van 8,1% en een O₂ van 6,4%. De controlewaarden zijn 8,8% CO₂ en 5,2% O₂. Wat is er aan de hand?",
    options: [
      "De luchtovermaat is te groot: te veel lucht drukt het CO₂-gehalte omlaag en laat het O₂-gehalte stijgen",
      "Er is te weinig lucht: daardoor stijgt het CO₂-gehalte tot boven de controlewaarde",
      "De meting is ongeldig: O₂ en CO₂ kunnen niet allebei tegelijk van de controlewaarde afwijken",
    ],
    correct: 0,
    feedbackCorrect: "Klopt: te veel lucht betekent een laag CO₂ en een hoog O₂. Bron: Kleintje Gas §2.4 (luchtovermaat verlaagt CO₂) en de Avanta-controlewaarden.",
    feedbackWrong: "Kijk naar beide waarden samen: het CO₂ is te laag en het O₂ te hoog. Dat wijst op te veel lucht.",
  },
  {
    question: "Bij een Avanta Ace meet je in het rookgas 310 ppm CO. De fabrikant eist minder dan 250 ppm. Hoe beoordeel je deze meting?",
    options: [
      "Niet in orde: de waarde ligt boven de fabrikantseis van 250 ppm, dus er is actie nodig",
      "In orde: voor een gesloten toestel geldt de algemene grens van 400 ppm, en daar zit je onder",
      "In orde: CO beoordeel je alleen als er geen CO₂-meting beschikbaar is",
    ],
    correct: 0,
    feedbackCorrect: "Juist: is er een fabrikantseis, dan gaat die voor de algemene tabel. Bron: Avanta Ace handleiding, tabel met controlewaarden (CO onder 250 ppm).",
    feedbackWrong: "De fabrikantseis gaat voor: Remeha eist bij dit toestel minder dan 250 ppm CO.",
  },
];

const POOL_R3 = [
  {
    question: "Bij een Avanta Ace op G20 meet je op vollast een CO₂-gehalte van 8,0%. De controlewaarde is 8,8% met een band van 8,6 tot 9,2%. Wat is de juiste actie?",
    options: [
      "Niets doen: 8,0% wijkt minder dan 1% af van de nominale waarde en valt dus binnen de tolerantie",
      "De OFFSET-schroef (K) op het gasblok linksom draaien om het CO₂-gehalte op vollast te verhogen",
      "De afstelschroef (V) op de gasklep rechtsom draaien om het CO₂-gehalte te verhogen",
      "De afstelschroef (V) op de gasklep linksom draaien om het CO₂-gehalte te verhogen",
    ],
    correct: 2,
    feedbackCorrect: "Juist: vollast stel je bij met schroef V, en rechtsom draaien verhoogt het CO₂-gehalte. Bron: Avanta Ace handleiding (kalibratie maximale belasting, schroef V) en de tabel met controlewaarden.",
    feedbackWrong: "Vollast hoort bij schroef V, en om het CO₂ te verhogen draai je rechtsom.",
  },
  {
    question: "Bij een Avanta Ace op G20 meet je op laaglast een CO₂-gehalte van 7,8%. De band is 8,1 tot 8,5%. Wat is de juiste actie?",
    options: [
      "De OFFSET-schroef (K) rechtsom draaien om het CO₂-gehalte te verhogen",
      "De afstelschroef (V) rechtsom draaien om het CO₂-gehalte te verhogen",
      "De OFFSET-schroef (K) linksom draaien om het CO₂-gehalte te verlagen",
      "De afstelschroef (V) linksom draaien om het CO₂-gehalte te verlagen",
    ],
    correct: 0,
    feedbackCorrect: "Klopt: laaglast stel je bij met de OFFSET-schroef K, en rechtsom verhoogt het CO₂. Bron: Avanta Ace handleiding (OFFSET-schroef K voor de gereduceerde belasting).",
    feedbackWrong: "Laaglast hoort bij de OFFSET-schroef K. Het CO₂ is te laag, dus je draait rechtsom.",
  },
  {
    question: "Voor een gesloten toestel (type C) ontbreekt een fabrikantseis voor het maximale CO-gehalte in het verbrandingsgas. Welke grenswaarde geldt dan?",
    options: ["25 ppm", "50 ppm", "200 ppm", "400 ppm"],
    correct: 3,
    feedbackCorrect: "Juist: voor een gesloten toestel (type C) geldt zonder fabrikantseis 400 ppm. Bron: Kleintje Gas, tabel met CO-grenzen per toesteltype.",
    feedbackWrong: "Kijk naar het toesteltype: open zonder afvoer 50, open met afvoer 200, gesloten 400 ppm.",
  },
  {
    question: "Voor een open toestel met afvoer (type B) ontbreekt een fabrikantseis voor het maximale CO-gehalte in het verbrandingsgas. Welke grenswaarde geldt dan?",
    options: ["25 ppm", "50 ppm", "200 ppm", "400 ppm"],
    correct: 2,
    feedbackCorrect: "Klopt: voor een open toestel met afvoer (type B) geldt zonder fabrikantseis 200 ppm. Bron: Kleintje Gas, tabel met CO-grenzen per toesteltype.",
    feedbackWrong: "Kijk naar het toesteltype: open zonder afvoer 50, open met afvoer 200, gesloten 400 ppm.",
  },
];

// ─── HERBRUIKBAAR: FABRIKANTSTABEL EN CO-TABEL ───

function FabrikantTabel() {
  return (
    <div className="rounded-xl border-2 overflow-hidden text-xs" style={{ borderColor: C.brownText }}>
      <div className="grid grid-cols-4 text-center font-bold" style={{ backgroundColor: C.bgHeader, color: "white" }}>
        <div className="py-1.5">Avanta G20</div>
        <div className="py-1.5">CO₂</div>
        <div className="py-1.5">O₂</div>
        <div className="py-1.5">CO</div>
      </div>
      {[
        { rij: "Vollast", co2: "8,8% (8,6 tot 9,2)", o2: "5,2%" },
        { rij: "Laaglast", co2: "8,4% (8,1 tot 8,5)", o2: "5,9%" },
      ].map((r, i) => (
        <div key={r.rij} className="grid grid-cols-4 text-center" style={{ backgroundColor: i % 2 ? C.beigeLight : C.bgCard, color: C.brownText }}>
          <div className="py-1.5 font-bold">{r.rij}</div>
          <div className="py-1.5">{r.co2}</div>
          <div className="py-1.5">{r.o2}</div>
          <div className="py-1.5">{i === 0 ? "onder 250 ppm" : " "}</div>
        </div>
      ))}
    </div>
  );
}

function CoGrenzenTabel() {
  return (
    <div className="rounded-xl border-2 overflow-hidden text-xs" style={{ borderColor: C.brownText }}>
      <div className="grid grid-cols-3 text-center font-bold" style={{ backgroundColor: C.bgHeader, color: "white" }}>
        <div className="py-1.5">Type</div>
        <div className="py-1.5">Toestel</div>
        <div className="py-1.5">CO-grens</div>
      </div>
      {CO_TABEL.map((r, i) => (
        <div key={r.type} className="grid grid-cols-3 text-center" style={{ backgroundColor: i % 2 ? C.beigeLight : C.bgCard, color: C.brownText }}>
          <div className="py-1.5 font-bold">{r.type}</div>
          <div className="py-1.5">{r.omschrijving}</div>
          <div className="py-1.5">{r.grens} ppm</div>
        </div>
      ))}
    </div>
  );
}

// ─── RONDE 1 · DE MEETKLUS ───

const STAND_OPTIES = [
  { key: "moduleren", label: "Laat de ketel in normaal bedrijf mee moduleren", goed: false },
  { key: "veger", label: "Zet de ketel in de schoorsteenvegerstand (gedwongen vollast)", goed: true },
  { key: "koud", label: "Start de ketel koud op en meet direct", goed: false },
];

function KetelSVG({ onKies, gekozen }) {
  // Schematische HR-ketel met concentrische dakdoorvoer: binnenbuis rookgas,
  // buitenbuis luchttoevoer, elk met een meetpunt.
  const punt = (key, cx, cy, label, labelX, anchor) => (
    <g
      key={key}
      onClick={(e) => !gekozen && onKies(key, e)}
      style={{ cursor: gekozen ? "default" : "pointer" }}
    >
      <circle cx={cx} cy={cy} r="16" fill={C.bgCard} stroke={C.brownText} strokeWidth="3" />
      <circle cx={cx} cy={cy} r="7" fill={gekozen === key ? C.olive : C.beigeMid} stroke={C.brownText} strokeWidth="2" />
      <text x={labelX} y={cy + 4} fontSize="15" fontWeight="bold" fill={C.brownText} textAnchor={anchor} fontStyle="italic">
        {label}
      </text>
    </g>
  );

  return (
    <svg viewBox="0 0 560 330" className="w-full max-w-lg select-none">
      {/* buitenbuis: luchttoevoer */}
      <rect x="240" y="20" width="80" height="110" rx="6" fill={C.beigeLight} stroke={C.brownText} strokeWidth="3" />
      {/* binnenbuis: rookgasafvoer */}
      <rect x="262" y="8" width="36" height="122" rx="4" fill="#C9BBA2" stroke={C.brownText} strokeWidth="3" />
      {/* stroomrichtingen */}
      <text x="280" y="62" fontSize="20" textAnchor="middle" fill={C.brownText}>&#8593;</text>
      <text x="252" y="80" fontSize="16" textAnchor="middle" fill={C.brown}>&#8595;</text>
      <text x="309" y="80" fontSize="16" textAnchor="middle" fill={C.brown}>&#8595;</text>
      {/* labels op de buizen */}
      <text x="330" y="40" fontSize="13" fill={C.brown} fontStyle="italic">rookgas (binnenbuis)</text>
      <line x1="298" y1="36" x2="326" y2="36" stroke={C.brown} strokeWidth="1.5" />
      <text x="180" y="120" fontSize="13" fill={C.brown} fontStyle="italic" textAnchor="end">lucht (buitenbuis)</text>
      <line x1="185" y1="124" x2="240" y2="124" stroke={C.brown} strokeWidth="1.5" />
      {/* ketelkast */}
      <rect x="170" y="130" width="220" height="170" rx="12" fill={C.bgCard} stroke={C.brownText} strokeWidth="4" />
      <rect x="230" y="200" width="100" height="60" rx="8" fill={C.beigeLight} stroke={C.brownText} strokeWidth="3" />
      {/* vlammetjes in het kijkglas */}
      <path d="M262 248 q-6 -12 4 -20 q-2 10 8 12 q6 2 2 8 q-6 8 -14 0 Z" fill="#E67E22" />
      <path d="M288 248 q-6 -12 4 -20 q-2 10 8 12 q6 2 2 8 q-6 8 -14 0 Z" fill="#E67E22" />
      <text x="280" y="285" fontSize="13" textAnchor="middle" fill={C.brown} fontStyle="italic">Avanta Ace</text>
      {/* meetpunten: rookgas op de adapter (binnenbuis), lucht op de buitenbuis */}
      {punt("rookgas", 280, 145, "meetpunt op de rookgasadapter", 305, "start")}
      {punt("lucht", 240, 95, "meetpunt op het luchttoevoerkanaal", 215, "end")}
    </svg>
  );
}

function SondePaneel({ onVast }) {
  // Doorsnede van het rookgasmeetpunt: sleep de sonde naar binnen tot de
  // juiste diepte. 1 cm = 12 viewBox-eenheden; de wand zit op x = 420.
  const WAND_X = 420;
  const PX_CM = 12;
  const MAXD = 12;
  const [diepte, setDiepte] = useState(0);
  const svgRef = useRef(null);
  const dragRef = useRef(null); // { startX, startDiepte }

  const unitsX = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 560;
  };

  const inZone = diepte >= 6 && diepte <= 8;
  const tipX = WAND_X - diepte * PX_CM;

  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-3">
      <svg
        ref={svgRef}
        viewBox="0 0 560 200"
        className="w-full select-none"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          e.preventDefault();
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetisch event */ }
          dragRef.current = { startX: unitsX(e), startDiepte: diepte };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const d = dragRef.current.startDiepte + (dragRef.current.startX - unitsX(e)) / PX_CM;
          setDiepte(Math.max(0, Math.min(MAXD, Math.round(d * 10) / 10)));
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        {/* rookgaskanaal (binnenkant) */}
        <rect x="10" y="20" width={WAND_X - 22} height="140" rx="8" fill="#E8E0CE" stroke={C.brownText} strokeWidth="3" />
        <text x="120" y="55" fontSize="14" fill={C.brown} fontStyle="italic">rookgaskanaal</text>
        <text x="120" y="100" fontSize="18" fill={C.brown}>&#8593; &#8593;</text>
        {/* doelzone circa 7 cm (hulp) */}
        <rect x={WAND_X - 8 * PX_CM} y="24" width={2 * PX_CM} height="132" fill={C.greenLight} stroke={C.green} strokeWidth="2" strokeDasharray="5 4" rx="4" />
        <text x={WAND_X - 7 * PX_CM} y="45" fontSize="12" fontWeight="bold" textAnchor="middle" fill={C.green}>circa 7 cm</text>
        {/* wand met meetopening */}
        <rect x={WAND_X - 12} y="20" width="14" height="52" fill={C.brownText} rx="3" />
        <rect x={WAND_X - 12} y="108" width="14" height="52" fill={C.brownText} rx="3" />
        <text x={WAND_X + 14} y="34" fontSize="12" fill={C.brown} fontStyle="italic">meetopening</text>
        {/* liniaal */}
        {Array.from({ length: MAXD + 1 }, (_, cm) => (
          <g key={cm}>
            <line x1={WAND_X - cm * PX_CM} y1="164" x2={WAND_X - cm * PX_CM} y2={cm % 2 === 0 ? 176 : 171} stroke={C.brown} strokeWidth="1.5" />
            {cm % 2 === 0 && (
              <text x={WAND_X - cm * PX_CM} y="192" fontSize="11" textAnchor="middle" fill={C.brown}>{cm}</text>
            )}
          </g>
        ))}
        <text x="500" y="192" fontSize="11" fill={C.brown}>cm</text>
        {/* sonde: buis + handgreep, sleepbaar */}
        <rect x={tipX} y="84" width={480 - tipX} height="12" rx="5" fill="#8B8B8B" stroke={C.brownText} strokeWidth="2" />
        <polygon points={`${tipX},90 ${tipX + 10},84 ${tipX + 10},96`} fill="#8B8B8B" stroke={C.brownText} strokeWidth="2" />
        <rect x="480" y="70" width="48" height="40" rx="8" fill={inZone ? C.green : C.olive} stroke={C.brownText} strokeWidth="3" />
        <text x="504" y="94" fontSize="11" fontWeight="bold" textAnchor="middle" fill="white">grip</text>
      </svg>
      <div
        className="rounded-xl border-2 px-4 py-2 font-bold text-sm"
        style={{
          borderColor: inZone ? C.green : C.brownText,
          backgroundColor: inZone ? C.greenLight : C.bgCard,
          color: inZone ? C.green : C.brownText,
        }}
      >
        Diepte: {fmt1(diepte)} cm
      </div>
      <GameButton onClick={(e) => onVast(diepte, e)} disabled={diepte === 0}>
        Zet de sonde vast
      </GameButton>
    </div>
  );
}

function Ronde1({ addScore, meldAandacht, onDone }) {
  const [fase, setFase] = useState("intro"); // intro | stand | meetpunt | sonde
  const [popup, setPopup] = useState(null); // { type, text, next }
  const [standGekozen, setStandGekozen] = useState(false);
  const [puntGekozen, setPuntGekozen] = useState(null);
  const eersteFoutVrij = useEersteFoutVrij();
  const scoredRef = useRef({}); // per stap: alleen de eerste poging telt

  const goed = (stapKey, tekst, next, e) => {
    if (!scoredRef.current[stapKey]) addScore(5, e);
    setPopup({ type: "correct", text: tekst, next });
  };
  const fout = (stapKey, tekst, aandachtKey, e) => {
    meldAandacht(AANDACHT[aandachtKey]);
    scoredRef.current[stapKey] = true;
    if (!eersteFoutVrij()) addScore(-5, e);
    setPopup({ type: "wrong", text: tekst });
  };

  if (fase === "intro") {
    return (
      <RondeIntro
        title="Ronde 1: de meetklus"
        intro="Voordat je een meetwaarde kunt beoordelen, moet de meting zelf kloppen."
        onStart={() => setFase("stand")}
      >
        <UitlegItem term="Schoorsteenvegerstand">
          dwingt de ketel naar <b>vollast of laaglast</b>, zodat hij tijdens de meting niet moduleert.
        </UitlegItem>
        <UitlegItem term="Twee meetpunten">
          op het <b>rookgasafvoerkanaal</b> meet je de verbrandingskwaliteit en het rendement; op het{" "}
          <b>luchttoevoerkanaal</b> controleer je of rookgassen recirculeren.
        </UitlegItem>
        <UitlegItem term="Meetsonde">
          gaat <b>circa 7 cm</b> diep in het rookgasmeetpunt.
        </UitlegItem>
      </RondeIntro>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center p-6">
      <StepBanner step={1} />
      {fase === "stand" && (
        <>
          <h2 className="text-lg font-bold italic mb-1 text-center" style={{ color: C.brownText }}>
            Stap 1 van 3: zet de ketel klaar
          </h2>
          <p className="text-sm mb-4 max-w-lg text-center font-medium" style={{ color: C.brown }}>
            Je gaat de verbranding van een Avanta Ace controleren. Hoe zet je de ketel klaar voor de meting?
          </p>
          <div className="flex flex-col gap-2.5 w-full max-w-lg">
            {STAND_OPTIES.map((o) => (
              <button
                key={o.key}
                onClick={(e) => {
                  if (standGekozen) return;
                  if (o.goed) {
                    setStandGekozen(true);
                    goed("stand", "De schoorsteenvegerstand dwingt de ketel naar vollast (of laaglast). Zo meet je bij een vaste belasting en zweeft je meetwaarde niet mee met het moduleren.", "meetpunt", e);
                  } else {
                    fout("stand", o.key === "moduleren"
                      ? "Een modulerende ketel wisselt steeds van belasting: je meetwaarde zweeft mee. Zet de ketel in de schoorsteenvegerstand, dan draait hij gedwongen op vollast of laaglast."
                      : "Een koude ketel is nog niet stabiel. Zet de ketel in de schoorsteenvegerstand: gedwongen vollast of laaglast, en meet als de waarde stilstaat.", "stand", e);
                  }
                }}
                className="text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all hover:shadow-md"
                style={{ backgroundColor: C.bgCard, borderColor: C.beigeMid, color: C.brownText }}
              >
                <Flame className="w-4 h-4 inline mr-2" style={{ color: C.olive }} />
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {fase === "meetpunt" && (
        <>
          <h2 className="text-lg font-bold italic mb-1 text-center" style={{ color: C.brownText }}>
            Stap 2 van 3: kies het meetpunt
          </h2>
          <p className="text-sm mb-3 max-w-lg text-center font-medium" style={{ color: C.brown }}>
            Je wilt de <b>verbrandingskwaliteit en het rendement</b> beoordelen. Tik het juiste meetpunt aan.
          </p>
          <KetelSVG
            gekozen={puntGekozen}
            onKies={(key, e) => {
              if (key === "rookgas") {
                setPuntGekozen("rookgas");
                goed("meetpunt", "Het rookgasmeetpunt op de adapter: hier beoordeel je de verbrandingskwaliteit en het rendement. Het meetpunt op het luchttoevoerkanaal gebruik je voor iets anders: controleren of rookgassen recirculeren.", "sonde", e);
              } else {
                fout("meetpunt", "Dit is het meetpunt op het luchttoevoerkanaal. Daar controleer je of rookgassen recirculeren: de CO₂-waarde moet er gelijk zijn aan de buitenluchtwaarde. Voor verbrandingskwaliteit en rendement meet je in het rookgasmeetpunt.", "meetpunt", e);
              }
            }}
          />
        </>
      )}

      {fase === "sonde" && (
        <>
          <h2 className="text-lg font-bold italic mb-1 text-center" style={{ color: C.brownText }}>
            Stap 3 van 3: steek de sonde op diepte
          </h2>
          <p className="text-sm mb-3 max-w-lg text-center font-medium" style={{ color: C.brown }}>
            Sleep de sonde aan de grip het meetpunt in en zet hem vast op de juiste diepte.
          </p>
          <SondePaneel
            onVast={(d, e) => {
              if (d >= 6 && d <= 8) {
                goed("sonde", `Mooi: ${fmt1(d)} cm, dus circa 7 cm diep. De sonde zit nu midden in de rookgasstroom en meet geen valse lucht mee.`, "klaar", e);
              } else {
                fout("sonde", d < 6
                  ? `De sonde zit op ${fmt1(d)} cm: te ondiep. Zo meet je valse lucht bij de meetopening mee. Duw de sonde door tot circa 7 cm.`
                  : `De sonde zit op ${fmt1(d)} cm: te diep. Trek hem terug tot circa 7 cm, midden in de rookgasstroom.`, "sonde", e);
              }
            }}
          />
        </>
      )}

      {popup && (
        <FeedbackPopup
          type={popup.type}
          text={popup.text}
          buttonText={popup.type === "correct" ? "Verder" : "Probeer opnieuw"}
          onClose={() => {
            const next = popup.next;
            setPopup(null);
            if (popup.type === "correct" && next) {
              if (next === "klaar") onDone();
              else setFase(next);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── RONDE 2 · GOED OF BIJSTELLEN? ───

const RAPPORTEN = [
  { last: "vollast", co2: 8.9, o2: 5.1, co: 40, afwijkend: false, oorzaak: null, hulp: true },
  { last: "vollast", co2: 8.2, o2: 6.1, co: 35, afwijkend: true, oorzaak: "teveel", hulp: true },
  { last: "laaglast", co2: 8.3, o2: 6.0, co: 55, afwijkend: false, oorzaak: null, hulp: false },
  { last: "laaglast", co2: 8.8, o2: 4.9, co: 290, afwijkend: true, oorzaak: "teweinig", hulp: false },
];

function rijStatus(rapport) {
  const b = BAND[rapport.last];
  return {
    co2: rapport.co2 >= b.co2min && rapport.co2 <= b.co2max,
    o2: Math.abs(rapport.o2 - b.o2) <= 0.5,
    co: rapport.co < BAND.coMax,
  };
}

function RapportKaart({ nr, rapport, onthuld }) {
  const b = BAND[rapport.last];
  const status = rijStatus(rapport);
  const rij = (label, waarde, hulpTekst, ok) => (
    <div
      className="grid grid-cols-[1fr_auto] gap-2 items-center px-4 py-2.5 border-t"
      style={{
        borderColor: C.beigeMid,
        backgroundColor: onthuld ? (ok ? C.greenLight : C.redLight) : C.bgCard,
      }}
    >
      <div>
        <span className="font-bold text-sm" style={{ color: C.brownText }}>{label}</span>
        {rapport.hulp && (
          <span className="text-xs ml-2" style={{ color: C.brown }}>({hulpTekst})</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-base tabular-nums" style={{ color: C.brownText }}>{waarde}</span>
        {onthuld && (ok
          ? <CheckCircle className="w-4 h-4" style={{ color: C.green }} />
          : <XCircle className="w-4 h-4" style={{ color: C.red }} />)}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-md rounded-2xl border-2 overflow-hidden shadow-md" style={{ borderColor: C.brownText, backgroundColor: C.bgCard }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: C.bgHeader }}>
        <FileText className="w-4 h-4 text-white" />
        <span className="text-white font-bold text-sm">
          Meetrapport {nr} van {RAPPORTEN.length} · Avanta Ace · G20 · <span className="italic">{rapport.last}</span>
        </span>
      </div>
      {rij("CO₂", `${fmt1(rapport.co2)}%`, `band ${fmt1(b.co2min)} tot ${fmt1(b.co2max)}%`, status.co2)}
      {rij("O₂", `${fmt1(rapport.o2)}%`, `controlewaarde ${fmt1(b.o2)}%`, status.o2)}
      {rij("CO", `${rapport.co} ppm`, "eis: onder 250 ppm", status.co)}
    </div>
  );
}

function Ronde2({ addScore, meldAandacht, onDone }) {
  const [fase, setFase] = useState("intro"); // intro | spel
  const [idx, setIdx] = useState(0);
  const [sub, setSub] = useState("oordeel"); // oordeel | oorzaak
  const [onthuld, setOnthuld] = useState(false);
  const [popup, setPopup] = useState(null);
  const eersteFoutVrij = useEersteFoutVrij();
  const rapport = RAPPORTEN[idx];

  const verder = () => {
    if (idx + 1 < RAPPORTEN.length) {
      setIdx(idx + 1);
      setSub("oordeel");
      setOnthuld(false);
    } else {
      onDone();
    }
  };

  const oordeel = (keuzeAfwijkend, e) => {
    setOnthuld(true);
    const juist = keuzeAfwijkend === rapport.afwijkend;
    if (juist) {
      addScore(5, e);
      setPopup({
        type: "correct",
        text: rapport.afwijkend
          ? "Goed gezien: dit rapport valt buiten de fabrikantswaarden. Nu de vervolgvraag: wat is er aan de hand?"
          : "Klopt: alle waarden vallen binnen de fabrikantswaarden. Deze ketel laat je met rust.",
        next: rapport.afwijkend ? "oorzaak" : "verder",
      });
    } else {
      meldAandacht(AANDACHT.banden);
      if (!eersteFoutVrij()) addScore(-5, e);
      setPopup({
        type: "wrong",
        text: rapport.afwijkend
          ? "Kijk nog eens naar de ingekleurde regels: er valt een waarde buiten de band van de fabrikant. Dit rapport betekent bijstellen."
          : "Kijk nog eens naar de ingekleurde regels: alle waarden vallen binnen de band van de fabrikant. Dit rapport is gewoon in orde.",
        next: rapport.afwijkend ? "oorzaak" : "verder",
      });
    }
  };

  const kiesOorzaak = (keuze, e) => {
    const juist = keuze === rapport.oorzaak;
    if (juist) {
      addScore(5, e);
      setPopup({
        type: "correct",
        text: rapport.oorzaak === "teveel"
          ? "Precies: het CO₂ is te laag en het O₂ te hoog, dus er gaat te veel lucht doorheen. Denk aan de verbrandingsgrafiek: meer lucht schuift de waarden uit elkaar."
          : "Precies: het CO₂ zit (te) hoog en de CO loopt op. Dat is het beeld van te weinig lucht: de verbranding wordt onvollediger en dat zie je als eerste aan de CO.",
        next: "verder",
      });
    } else {
      meldAandacht(AANDACHT.weegschaal);
      if (!eersteFoutVrij()) addScore(-5, e);
      setPopup({
        type: "wrong",
        text: rapport.oorzaak === "teveel"
          ? "Andersom: het CO₂ is hier te laag en het O₂ te hoog. Dat betekent te veel lucht."
          : "Andersom: het CO₂ zit hoog en de CO loopt flink op. Dat betekent te weinig lucht.",
        next: "verder",
      });
    }
  };

  if (fase === "intro") {
    return (
      <RondeIntro
        title="Ronde 2: goed of bijstellen?"
        intro="De sonde zit. Nu komen de meetrapporten binnen: jij geeft het stoplicht."
        onStart={() => setFase("spel")}
      >
        <p className="text-sm mb-3" style={{ color: C.brownText }}>
          Je vergelijkt elke meting met de <b>fabrikantstabel</b> van de Avanta Ace (G20):
        </p>
        <FabrikantTabel />
        <div className="mt-3">
          <UitlegItem term="Theoretisch maximum">
            bij G-gas kan het CO₂-gehalte maximaal <b>11,7%</b> zijn; door de <b>luchtovermaat</b> ligt de praktijkwaarde daar altijd onder.
          </UitlegItem>
          <UitlegItem term="Te veel lucht">
            CO₂ zakt en O₂ stijgt.
          </UitlegItem>
          <UitlegItem term="Te weinig lucht">
            CO₂ stijgt en de <b>CO loopt op</b>.
          </UitlegItem>
        </div>
      </RondeIntro>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center p-6">
      <StepBanner step={1} />
      <h2 className="text-lg font-bold italic mb-1 text-center" style={{ color: C.brownText }}>
        Goed of bijstellen?
      </h2>
      <p className="text-sm mb-3 max-w-lg text-center font-medium" style={{ color: C.brown }}>
        {rapport.hulp
          ? "Beoordeel het rapport. De banden staan er nog even bij."
          : "Beoordeel het rapport. Nu zonder hulp: de tabel zit in je spiekbriefje."}
      </p>
      {!rapport.hulp && (
        <UitlegStrook title="Spiekbriefje: fabrikantstabel" defaultOpen={false}>
          <FabrikantTabel />
        </UitlegStrook>
      )}
      <RapportKaart nr={idx + 1} rapport={rapport} onthuld={onthuld} />

      {sub === "oordeel" && !popup && (
        <div className="flex gap-3 mt-5 flex-wrap justify-center">
          <GameButton variant="green" onClick={(e) => oordeel(false, e)}>
            <CheckCircle className="w-4 h-4" />
            In orde
          </GameButton>
          <GameButton variant="danger" onClick={(e) => oordeel(true, e)}>
            <Wrench className="w-4 h-4" />
            Bijstellen nodig
          </GameButton>
        </div>
      )}

      {sub === "oorzaak" && !popup && (
        <div className="flex flex-col gap-2.5 mt-5 w-full max-w-md">
          <p className="text-sm text-center font-bold" style={{ color: C.brownText }}>
            Wat zie je in dit rapport?
          </p>
          <GameButton onClick={(e) => kiesOorzaak("teveel", e)} className="w-full">
            Te veel lucht: CO₂ laag en O₂ hoog
          </GameButton>
          <GameButton onClick={(e) => kiesOorzaak("teweinig", e)} className="w-full">
            Te weinig lucht: CO₂ hoog en de CO loopt op
          </GameButton>
        </div>
      )}

      {popup && (
        <FeedbackPopup
          type={popup.type}
          text={popup.text}
          buttonText="Verder"
          onClose={() => {
            const next = popup.next;
            setPopup(null);
            if (next === "oorzaak") setSub("oorzaak");
            else verder();
          }}
        />
      )}
    </div>
  );
}

// ─── RONDE 3 · WELKE SCHROEF? ───

const SCHROEFCASES = [
  {
    situatie: "Vollast: CO₂ gemeten 7,9% · band 8,6 tot 9,2%",
    conclusie: "te laag, dus het CO₂ moet omhoog",
    schroef: "V", richting: "rechtsom", hulp: true,
  },
  {
    situatie: "Laaglast: CO₂ gemeten 8,8% · band 8,1 tot 8,5%",
    conclusie: "te hoog, dus het CO₂ moet omlaag",
    schroef: "K", richting: "linksom", hulp: true,
  },
  {
    situatie: "Vollast: O₂ gemeten 6,3% · controlewaarde 5,2%",
    conclusie: "het O₂ is te hoog, dus het CO₂ is te laag",
    schroef: "V", richting: "rechtsom", hulp: false,
  },
];

const COCASES = [
  { type: "C", omschrijving: "gesloten toestel (type C)", co: 320, afkeuren: false, hulp: true },
  { type: "B", omschrijving: "open toestel met afvoer (type B)", co: 260, afkeuren: true, hulp: false },
];

function GasklepSVG({ onKies, gekozen }) {
  const schroef = (key, cx, cy, r, label) => (
    <g key={key} onClick={(e) => onKies(key, e)} style={{ cursor: "pointer" }}>
      <circle cx={cx} cy={cy} r={r} fill={gekozen === key ? C.olive : C.beigeMid} stroke={C.brownText} strokeWidth="3" />
      <line x1={cx - r * 0.55} y1={cy} x2={cx + r * 0.55} y2={cy} stroke={C.brownText} strokeWidth="4" strokeLinecap="round" />
      <text x={cx} y={cy - r - 8} fontSize="16" fontWeight="bold" textAnchor="middle" fill={C.brownText} fontStyle="italic">{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 400 190" className="w-full max-w-sm select-none">
      {/* gasblok */}
      <rect x="60" y="50" width="280" height="110" rx="14" fill={C.bgCard} stroke={C.brownText} strokeWidth="4" />
      <rect x="10" y="90" width="50" height="30" rx="6" fill={C.beigeLight} stroke={C.brownText} strokeWidth="3" />
      <rect x="340" y="90" width="50" height="30" rx="6" fill={C.beigeLight} stroke={C.brownText} strokeWidth="3" />
      <text x="200" y="150" fontSize="13" textAnchor="middle" fill={C.brown} fontStyle="italic">gasblok Avanta Ace</text>
      {schroef("V", 150, 100, 26, "V")}
      {schroef("K", 265, 108, 17, "K (OFFSET)")}
    </svg>
  );
}

function Ronde3({ addScore, meldAandacht, onDone }) {
  const [fase, setFase] = useState("intro"); // intro | schroef | co
  const [idx, setIdx] = useState(0);
  const [sub, setSub] = useState("schroef"); // schroef | richting
  const [gekozen, setGekozen] = useState(null);
  const [coIdx, setCoIdx] = useState(0);
  const [popup, setPopup] = useState(null);
  const eersteFoutVrij = useEersteFoutVrij();
  const scoredRef = useRef({});
  const kase = SCHROEFCASES[idx];
  const coCase = COCASES[coIdx];

  const goed = (key, tekst, next, e) => {
    if (!scoredRef.current[key]) addScore(5, e);
    setPopup({ type: "correct", text: tekst, next });
  };
  const fout = (key, tekst, aandachtKey, e) => {
    scoredRef.current[key] = true;
    meldAandacht(AANDACHT[aandachtKey]);
    if (!eersteFoutVrij()) addScore(-5, e);
    setPopup({ type: "wrong", text: tekst });
  };

  const kiesSchroef = (keuze, e) => {
    const key = `s${idx}`;
    if (keuze === kase.schroef) {
      setGekozen(keuze);
      goed(key, kase.schroef === "V"
        ? "Juist: dit is een vollastmeting, dus je stelt bij met afstelschroef V."
        : "Juist: dit is een laaglastmeting, dus je stelt bij met de OFFSET-schroef K.", "richting", e);
    } else {
      fout(key, kase.schroef === "V"
        ? "Dit is een vollastmeting: daarvoor gebruik je afstelschroef V. De OFFSET-schroef K is voor de laaglast."
        : "Dit is een laaglastmeting: daarvoor gebruik je de OFFSET-schroef K. Schroef V is voor de vollast.", "schroef", e);
    }
  };

  const kiesRichting = (keuze, e) => {
    const key = `r${idx}`;
    if (keuze === kase.richting) {
      goed(key, kase.richting === "rechtsom"
        ? "Klopt: rechtsom draaien verhoogt het CO₂-gehalte (en verlaagt het O₂)."
        : "Klopt: linksom draaien verlaagt het CO₂-gehalte (en verhoogt het O₂).", "volgende", e);
    } else {
      fout(key, kase.richting === "rechtsom"
        ? "Andersom: het CO₂ moet hier omhoog, en rechtsom draaien verhoogt het CO₂."
        : "Andersom: het CO₂ moet hier omlaag, en linksom draaien verlaagt het CO₂.", "schroef", e);
    }
  };

  const kiesCo = (keuzeAfkeuren, e) => {
    const key = `c${coIdx}`;
    const grens = CO_TABEL.find((t) => t.type === coCase.type).grens;
    if (keuzeAfkeuren === coCase.afkeuren) {
      goed(key, coCase.afkeuren
        ? `Juist: voor een ${coCase.omschrijving} geldt zonder fabrikantseis een grens van ${grens} ppm, en ${coCase.co} ppm zit daarboven. Afkeuren dus.`
        : `Juist: voor een ${coCase.omschrijving} geldt zonder fabrikantseis een grens van ${grens} ppm, en ${coCase.co} ppm blijft daaronder.`, "coVolgende", e);
    } else {
      fout(key, `Pak de tabel erbij: voor een ${coCase.omschrijving} geldt zonder fabrikantseis een grens van ${grens} ppm. Vergelijk de gemeten ${coCase.co} ppm daarmee.`, "tabel", e);
    }
  };

  if (fase === "intro") {
    return (
      <RondeIntro
        title="Ronde 3: welke schroef?"
        intro="Een afgekeurde meting is pas klaar als jij weet wat je eraan doet."
        onStart={() => setFase("schroef")}
      >
        <UitlegItem term="Afstelschroef V">
          voor de <b>vollast</b> (maximale belasting).
        </UitlegItem>
        <UitlegItem term="OFFSET-schroef K">
          voor de <b>laaglast</b> (gereduceerde belasting).
        </UitlegItem>
        <UitlegItem term="Draairichting">
          <b>rechtsom</b> verhoogt het CO₂-gehalte en verlaagt het O₂; <b>linksom</b> andersom.
        </UitlegItem>
        <p className="text-sm mt-3 mb-2" style={{ color: C.brownText }}>
          En heeft een toestel <b>geen fabrikantsgegevens</b>, dan beoordeel je de CO met de algemene grenzen:
        </p>
        <CoGrenzenTabel />
      </RondeIntro>
    );
  }

  if (fase === "schroef") {
    return (
      <div className="flex-1 flex flex-col items-center p-6">
        <StepBanner step={1} />
        <h2 className="text-lg font-bold italic mb-1 text-center" style={{ color: C.brownText }}>
          Casus {idx + 1} van {SCHROEFCASES.length}
        </h2>
        <div className="w-full max-w-md rounded-2xl border-2 px-4 py-3 mb-3 shadow-md" style={{ borderColor: C.brownText, backgroundColor: C.bgCard }}>
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-4 h-4" style={{ color: C.red }} />
            <span className="font-bold text-sm" style={{ color: C.red }}>Afgekeurde meting</span>
          </div>
          <p className="text-sm font-medium" style={{ color: C.brownText }}>{kase.situatie}</p>
          {kase.hulp && (
            <p className="text-xs mt-1 italic" style={{ color: C.brown }}>De waarde is {kase.conclusie}.</p>
          )}
        </div>
        {kase.hulp && sub === "schroef" && (
          <UitlegStrook title="Spiekbriefje" defaultOpen={idx === 0}>
            <b>V</b> = vollast · <b>K (OFFSET)</b> = laaglast · rechtsom = CO₂ omhoog · linksom = CO₂ omlaag
          </UitlegStrook>
        )}
        {sub === "schroef" && (
          <>
            <p className="text-sm mb-2 max-w-md text-center font-medium" style={{ color: C.brown }}>
              Tik de schroef aan waarmee je deze meting bijstelt.
            </p>
            <GasklepSVG gekozen={gekozen} onKies={(k, e) => sub === "schroef" && kiesSchroef(k, e)} />
          </>
        )}
        {sub === "richting" && !popup && (
          <div className="flex flex-col items-center gap-3 mt-2">
            <p className="text-sm font-bold" style={{ color: C.brownText }}>
              Welke kant draai je schroef {kase.schroef} op?
            </p>
            <div className="flex gap-3">
              <GameButton onClick={(e) => kiesRichting("linksom", e)}>
                <RotateCcw className="w-4 h-4" />
                Linksom
              </GameButton>
              <GameButton onClick={(e) => kiesRichting("rechtsom", e)}>
                <RotateCw className="w-4 h-4" />
                Rechtsom
              </GameButton>
            </div>
          </div>
        )}
        {popup && (
          <FeedbackPopup
            type={popup.type}
            text={popup.text}
            buttonText={popup.type === "correct" ? "Verder" : "Probeer opnieuw"}
            onClose={() => {
              const next = popup.next;
              setPopup(null);
              if (popup.type !== "correct") return;
              if (next === "richting") setSub("richting");
              else if (next === "volgende") {
                if (idx + 1 < SCHROEFCASES.length) {
                  setIdx(idx + 1);
                  setSub("schroef");
                  setGekozen(null);
                } else {
                  setFase("co");
                }
              }
            }}
          />
        )}
      </div>
    );
  }

  // fase "co": beoordelen zonder fabrikantseis
  return (
    <div className="flex-1 flex flex-col items-center p-6">
      <StepBanner step={1} />
      <h2 className="text-lg font-bold italic mb-1 text-center" style={{ color: C.brownText }}>
        Zonder fabrikantseis · casus {coIdx + 1} van {COCASES.length}
      </h2>
      <p className="text-sm mb-3 max-w-lg text-center font-medium" style={{ color: C.brown }}>
        Voor dit toestel zijn geen fabrikantsgegevens beschikbaar. Beoordeel de CO-meting.
      </p>
      {coCase.hulp ? (
        <UitlegStrook title="Spiekbriefje: CO-grenzen zonder fabrikantseis" defaultOpen={true}>
          <CoGrenzenTabel />
        </UitlegStrook>
      ) : (
        <UitlegStrook title="Spiekbriefje: CO-grenzen zonder fabrikantseis" defaultOpen={false}>
          <CoGrenzenTabel />
        </UitlegStrook>
      )}
      <div className="w-full max-w-md rounded-2xl border-2 overflow-hidden shadow-md" style={{ borderColor: C.brownText, backgroundColor: C.bgCard }}>
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: C.bgHeader }}>
          <FileText className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-sm">Meetrapport · {coCase.omschrijving}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-sm" style={{ color: C.brownText }}>CO in het verbrandingsgas</span>
          <span className="font-bold text-lg tabular-nums" style={{ color: C.brownText }}>{coCase.co} ppm</span>
        </div>
      </div>
      {!popup && (
        <div className="flex gap-3 mt-5 flex-wrap justify-center">
          <GameButton variant="green" onClick={(e) => kiesCo(false, e)}>
            <CheckCircle className="w-4 h-4" />
            In orde
          </GameButton>
          <GameButton variant="danger" onClick={(e) => kiesCo(true, e)}>
            <XCircle className="w-4 h-4" />
            Afkeuren
          </GameButton>
        </div>
      )}
      {popup && (
        <FeedbackPopup
          type={popup.type}
          text={popup.text}
          buttonText={popup.type === "correct" ? "Verder" : "Probeer opnieuw"}
          onClose={() => {
            setPopup(null);
            if (popup.type !== "correct") return;
            if (coIdx + 1 < COCASES.length) setCoIdx(coIdx + 1);
            else onDone();
          }}
        />
      )}
    </div>
  );
}

// ─── STARTSCHERM ───

function StartScreen({ onStart }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="py-3 px-5 text-center" style={{ backgroundColor: C.bgHeader }}>
        <span className="text-white font-bold italic text-lg">Beoordeel de meting</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
        <div className="rounded-full p-7 border-4" style={{ backgroundColor: C.beigeLight, borderColor: C.brownText }}>
          <ClipboardCheck className="w-20 h-20" style={{ color: C.brownText }} />
        </div>
        <h1 className="text-3xl font-bold italic text-center" style={{ color: C.brownText }}>Beoordeel de meting</h1>
        <p className="max-w-sm text-center font-medium" style={{ color: C.brown }}>
          Je rookgasanalysemeter geeft een rij getallen. Maar is de meting goed uitgevoerd?
          En zijn de waarden in orde, of moet je de ketel bijstellen?
        </p>
        <p className="max-w-sm text-center font-medium" style={{ color: C.brown }}>
          In deze game voer je de meetklus uit, beoordeel je meetrapporten tegen de fabrikantswaarden
          en kies je de juiste schroef als bijstellen nodig is. Precies wat ze op het examen vragen.
        </p>
        <div className="rounded-xl border-2 px-4 py-2.5 text-xs max-w-sm text-center" style={{ borderColor: C.beigeMid, backgroundColor: C.bgCard, color: C.brown }}>
          <b>Bediening:</b> tikken of klikken, en in ronde 1 sleep je de meetsonde.
          Goede zet +5 · foute zet &minus;5 · controlevraag goed +10 · 5 levens.
        </div>
        <GameButton onClick={onStart}>Start de game</GameButton>
      </div>
    </div>
  );
}

// ─── MAIN ───

const SCREEN_ROUND = {
  m1intro: 1, r1: 1, r1mc: 1,
  m2intro: 2, r2: 2, r2mc: 2,
  r3: 3, r3mc: 3,
};

export default function MetingGame({ initialScreen = "start", onExit }) {
  const [screen, setScreen] = useState(initialScreen);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [aandacht, setAandacht] = useState([]);
  const juice = useGameJuice();

  const meldAandacht = useCallback((tekst) => {
    setAandacht((prev) => (prev.includes(tekst) ? prev : [...prev, tekst]));
  }, []);

  const addScore = useCallback(
    (pts, point) => {
      setScore((prev) => Math.max(0, Math.min(MAX_SCORE, prev + pts)));
      if (pts >= 0) juice.triggerCorrect(pts, point);
      else juice.triggerWrong(pts, point);
    },
    [juice]
  );

  const loseLife = useCallback(() => {
    setLives((prev) => Math.max(0, prev - 1));
    juice.triggerWrong();
  }, [juice]);

  const resetGame = () => {
    setScreen("start");
    setScore(0);
    setLives(5);
    setAandacht([]);
  };

  // Bij 0 levens begin je opnieuw
  useEffect(() => {
    if (lives === 0) {
      const t = setTimeout(resetGame, 1200);
      return () => clearTimeout(t);
    }
  }, [lives]);

  useEffect(() => {
    if (screen === "end") juice.triggerLevelUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // App-koppeling: voortgang melden bij elke ronde-afronding en op het eind
  useEffect(() => {
    if (screen === "m2intro") meldVoortgang({ missie: 1, ronde: 1, score, maxScore: MAX_SCORE, completed: false });
    if (screen === "r3") meldVoortgang({ missie: 2, ronde: 2, score, maxScore: MAX_SCORE, completed: false });
    if (screen === "end") meldVoortgang({ missie: 2, ronde: 3, score, maxScore: MAX_SCORE, completed: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const showProgress = !["start", "end"].includes(screen);

  const mc = (pool, next, aandachtTekst, opts = {}) => (
    <div className="flex-1 flex flex-col items-center p-6">
      <StepBanner step={2} />
      <MCControle
        pool={pool}
        addScore={addScore}
        loseLife={() => { meldAandacht(aandachtTekst); loseLife(); }}
        onComplete={() => setScreen(next)}
        {...opts}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ backgroundColor: C.bgPage }}>
      <juice.JuiceOverlay />
      <div
        className="max-w-[800px] w-full mx-auto flex flex-col min-h-screen shadow-lg overflow-x-hidden"
        style={{ backgroundColor: C.bgPage, animation: juice.shaking ? "shake 0.3s ease-in-out" : "none" }}
      >
        {showProgress && <ProgressBar currentRound={SCREEN_ROUND[screen] ?? 1} totalRounds={3} score={score} lives={lives} />}

        {screen === "start" && <StartScreen onStart={() => setScreen("m1intro")} />}

        {screen === "m1intro" && (
          <IntroScreen title="Missie 1: de meetklus" buttonText="Aan de slag" onNext={() => setScreen("r1")}>
            <div className="leading-relaxed" style={{ color: C.brownText }}>
              <p className="mb-2 font-bold italic">Welkom!</p>
              <p className="mb-2">
                Een meetwaarde beoordelen begint bij een meting die <b>goed is uitgevoerd</b>: ketel in de
                juiste stand, sonde in het juiste meetpunt, op de juiste diepte.
              </p>
              <p>Dat ga je nu zelf doen, bij een Avanta Ace.</p>
            </div>
          </IntroScreen>
        )}

        {screen === "r1" && <Ronde1 addScore={addScore} meldAandacht={meldAandacht} onDone={() => setScreen("r1mc")} />}
        {screen === "r1mc" && mc(POOL_R1, "m2intro", AANDACHT.meetpunt)}

        {screen === "m2intro" && (
          <IntroScreen title="Missie 2: beoordelen en bijstellen" buttonText="Naar de rapporten" onNext={() => setScreen("r2")}>
            <div className="leading-relaxed" style={{ color: C.brownText }}>
              <p className="mb-2 font-bold italic">De meting staat. Nu het echte werk.</p>
              <p className="mb-2">
                Je legt elke meetwaarde naast de <b>fabrikantstabel</b>: valt de waarde binnen de band,
                dan is de ketel in orde. Valt hij erbuiten, dan stel je bij met de juiste schroef.
              </p>
              <p>
                En zijn er geen fabrikantsgegevens? Dan gelden de <b>algemene CO-grenzen</b> per toesteltype.
              </p>
            </div>
          </IntroScreen>
        )}

        {screen === "r2" && <Ronde2 addScore={addScore} meldAandacht={meldAandacht} onDone={() => setScreen("r2mc")} />}
        {screen === "r2mc" && mc(POOL_R2, "r3", AANDACHT.banden)}

        {screen === "r3" && <Ronde3 addScore={addScore} meldAandacht={meldAandacht} onDone={() => setScreen("r3mc")} />}
        {screen === "r3mc" && mc(POOL_R3, "end", AANDACHT.schroef, { lastRound: true })}

        {screen === "end" && (
          <EndScreen
            score={score}
            maxScore={MAX_SCORE}
            lives={lives}
            text="Top! Je kunt nu een rookgasmeting correct uitvoeren, de meetwaarden beoordelen tegen de fabrikantswaarden en bij een afkeur de juiste schroef en draairichting kiezen. En zonder fabrikantseis weet je de algemene CO-grenzen te vinden. Precies wat ze op het examen vragen."
            onRestart={resetGame}
            onExit={onExit}
          >
            <div className="border-2 rounded-2xl p-5 max-w-lg w-full" style={{ backgroundColor: C.bgCard, borderColor: C.beigeMid }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.olive }}>
                Belangrijkste leermomenten
              </div>
              <div className="flex flex-col gap-1.5 mb-4">
                {LEERMOMENTEN.map((t, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.green }} />
                    <p className="text-sm leading-snug" style={{ color: C.brownText }}>{t}</p>
                  </div>
                ))}
              </div>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#B08A2E" }}>
                Jouw aandachtspunten
              </div>
              {aandacht.length === 0 ? (
                <div className="flex gap-2 items-start">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.green }} />
                  <p className="text-sm leading-snug" style={{ color: C.brownText }}>
                    Geen! Je hebt alles in een keer goed gedaan.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {aandacht.map((t, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#B08A2E" }} />
                      <p className="text-sm leading-snug" style={{ color: C.brownText }}>{t}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </EndScreen>
        )}

        <div className="py-2 text-center text-[10px]" style={{ color: C.brown }}>
          Studium B.V. · Vakmanschap CO · MicroGame · Beoordeel de meting
        </div>
      </div>
    </div>
  );
}
