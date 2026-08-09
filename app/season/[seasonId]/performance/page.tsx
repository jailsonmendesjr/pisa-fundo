"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BarChart3, Circle, CircleAlert, Gauge, LineChart, LoaderCircle } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

interface Driver {
  entryId: string;
  driverId: string;
  driverName: string;
  isGuest: boolean;
}

interface DriverPerformanceData {
  name: string;
  teamName: string;
  teamColor: string;
  totalPoints: number;
  bestPosition: number | "-";
  fastLaps: number;
  labels: string[];
  dataPoints: number[];
  dataPositions: (number | null)[];
}

interface SeasonApiResponse {
  season?: { name: string; year: number };
  drivers?: Driver[];
  error?: string;
}

interface PerformanceApiResponse {
  p1?: DriverPerformanceData;
  p2?: DriverPerformanceData;
  error?: string;
}

interface LoadedComparison {
  key: string;
  data: {
    p1: DriverPerformanceData;
    p2: DriverPerformanceData;
  };
}

export default function PerformancePage() {
  const { seasonId } = useParams() as { seasonId: string };

  const [season, setSeason] = useState<{ name: string; year: number } | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [p1, setP1] = useState<string>("");
  const [p2, setP2] = useState<string>("");

  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingComparisonKey, setLoadingComparisonKey] = useState<string | null>(null);
  const [loadedComparison, setLoadedComparison] = useState<LoadedComparison | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Índices sob hover para os tooltips interativos de cada gráfico
  const [hoveredPointsIndex, setHoveredPointsIndex] = useState<number | null>(null);
  const [hoveredPosIndex, setHoveredPosIndex] = useState<number | null>(null);

  const comparisonKey = seasonId && p1 && p2 && p1 !== p2
    ? `${seasonId}:${p1}:${p2}`
    : null;
  const loadingPerformance = comparisonKey !== null && loadingComparisonKey === comparisonKey;
  const performanceData = comparisonKey !== null && loadedComparison?.key === comparisonKey
    ? loadedComparison.data
    : null;

  // 1. Carrega dados iniciais da temporada e lista de pilotos
  useEffect(() => {
    if (!seasonId) return;
    const controller = new AbortController();

    async function loadInitialData() {
      setLoadingDrivers(true);
      setError(null);
      try {
        const response = await fetch(`/api/seasons/${seasonId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as SeasonApiResponse;

        if (!response.ok || !payload.season || !payload.drivers) {
          throw new Error(payload.error || "Erro ao carregar a temporada.");
        }

        setSeason(payload.season);
        setDrivers(payload.drivers);
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        console.error(error);
        setError("Não foi possível carregar a lista de pilotos desta temporada.");
      } finally {
        if (!controller.signal.aborted) setLoadingDrivers(false);
      }
    }

    loadInitialData();
    return () => controller.abort();
  }, [seasonId]);

  // 2. Busca dados de performance dos pilotos selecionados
  useEffect(() => {
    if (!comparisonKey) return;
    const key = comparisonKey;
    const controller = new AbortController();

    async function loadPerformance() {
      setLoadingComparisonKey(key);
      setError(null);
      try {
        const res = await fetch(`/api/seasons/${seasonId}/performance?p1=${p1}&p2=${p2}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as PerformanceApiResponse;

        if (!res.ok) {
          throw new Error(data.error || "Erro na busca dos dados.");
        }

        if (!data.p1 || !data.p2) {
          throw new Error("Resposta incompleta ao carregar a análise comparativa.");
        }

        setLoadedComparison({ key, data: { p1: data.p1, p2: data.p2 } });
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        console.error(error);
        setError(getErrorMessage(error) || "Erro ao carregar a análise comparativa.");
      } finally {
        if (!controller.signal.aborted) setLoadingComparisonKey(null);
      }
    }

    loadPerformance();
    return () => controller.abort();
  }, [comparisonKey, p1, p2, seasonId]);

  // Helpers para desenhar o gráfico SVG
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;
  const chartWidth = 600 - paddingLeft - paddingRight; // 530
  const chartHeight = 300 - paddingTop - paddingBottom; // 230

  // -------------------------------------------------------------
  // Renderizadores dos gráficos SVG
  // -------------------------------------------------------------
  const renderPointsChart = (d1: DriverPerformanceData, d2: DriverPerformanceData) => {
    const totalRounds = d1.labels.length;
    if (totalRounds === 0) return null;

    const maxPoints = Math.max(...d1.dataPoints, ...d2.dataPoints, 10);

    const getX = (idx: number) =>
      paddingLeft + (totalRounds > 1 ? (idx / (totalRounds - 1)) * chartWidth : 0);
    const getY = (pts: number) =>
      paddingTop + chartHeight - (pts / maxPoints) * chartHeight;

    // Coordenadas das linhas
    const coords1 = d1.dataPoints.map((pts, idx) => ({ x: getX(idx), y: getY(pts), pts }));
    const coords2 = d2.dataPoints.map((pts, idx) => ({ x: getX(idx), y: getY(pts), pts }));

    // Paths
    const pathD1 = coords1.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
    const pathD2 = coords2.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");

    // Areas preenchidas (gradientes)
    const areaD1 = totalRounds > 0
      ? `${pathD1} L ${coords1[totalRounds - 1].x} ${paddingTop + chartHeight} L ${coords1[0].x} ${paddingTop + chartHeight} Z`
      : "";
    const areaD2 = totalRounds > 0
      ? `${pathD2} L ${coords2[totalRounds - 1].x} ${paddingTop + chartHeight} L ${coords2[0].x} ${paddingTop + chartHeight} Z`
      : "";

    // Info do hover
    const hoverIdx = hoveredPointsIndex;

    return (
      <div className="relative">
        {/* Info dinâmica no topo do gráfico */}
        <div className="flex items-center justify-between mb-4 h-10 border-b border-slate-200 pb-2">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            {hoverIdx !== null ? `Etapa ${d1.labels[hoverIdx]}` : "Passe o mouse no gráfico"}
          </div>
          <div className="flex gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <Circle className="h-2.5 w-2.5 fill-current" style={{ color: d1.teamColor || "#ef4444" }} aria-hidden="true" />
              <span className="text-slate-700">{d1.name}:</span>
              <span className="text-slate-950 font-bold">
                {hoverIdx !== null ? `${d1.dataPoints[hoverIdx]} pts` : `${d1.totalPoints} pts`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Circle className="h-2.5 w-2.5 fill-current" style={{ color: d2.teamColor || "#3b82f6" }} aria-hidden="true" />
              <span className="text-slate-700">{d2.name}:</span>
              <span className="text-slate-950 font-bold">
                {hoverIdx !== null ? `${d2.dataPoints[hoverIdx]} pts` : `${d2.totalPoints} pts`}
              </span>
            </div>
          </div>
        </div>

        <svg viewBox="0 0 600 300" className="w-full h-auto overflow-visible select-none">
          <defs>
            <linearGradient id="p1-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={d1.teamColor || "#ef4444"} stopOpacity="0.25" />
              <stop offset="100%" stopColor={d1.teamColor || "#ef4444"} stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="p2-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={d2.teamColor || "#3b82f6"} stopOpacity="0.25" />
              <stop offset="100%" stopColor={d2.teamColor || "#3b82f6"} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade Verticais */}
          {d1.labels.map((label, idx) => {
            const x = getX(idx);
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={paddingTop + chartHeight}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={x}
                  y={paddingTop + chartHeight + 20}
                  textAnchor="middle"
                  className="font-mono text-[10px] fill-slate-500 font-bold"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Linhas de Grade Horizontais */}
          {Array.from({ length: 5 }).map((_, idx) => {
            const ratio = idx / 4;
            const val = Math.round(ratio * maxPoints);
            const y = paddingTop + chartHeight - ratio * chartHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartWidth}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-slate-500 font-bold"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Áreas preenchidas sob as curvas */}
          {areaD1 && <path d={areaD1} fill="url(#p1-area-grad)" />}
          {areaD2 && <path d={areaD2} fill="url(#p2-area-grad)" />}

          {/* Linhas de Gráfico */}
          <path
            d={pathD1}
            fill="none"
            stroke={d1.teamColor || "#ef4444"}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={pathD2}
            fill="none"
            stroke={d2.teamColor || "#3b82f6"}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Linha vertical sob hover */}
          {hoverIdx !== null && (
            <line
              x1={getX(hoverIdx)}
              y1={paddingTop}
              x2={getX(hoverIdx)}
              y2={paddingTop + chartHeight}
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Círculos nos pontos de dados (Piloto 1) */}
          {coords1.map((pt, idx) => (
            <circle
              key={`p1-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={hoverIdx === idx ? 6 : 4}
              fill="#ffffff"
              stroke={d1.teamColor || "#ef4444"}
              strokeWidth={hoverIdx === idx ? 3.5 : 2}
              className="transition-all duration-150"
            />
          ))}

          {/* Círculos nos pontos de dados (Piloto 2) */}
          {coords2.map((pt, idx) => (
            <circle
              key={`p2-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={hoverIdx === idx ? 6 : 4}
              fill="#ffffff"
              stroke={d2.teamColor || "#3b82f6"}
              strokeWidth={hoverIdx === idx ? 3.5 : 2}
              className="transition-all duration-150"
            />
          ))}

          {/* Zonas transparentes para capturar o hover */}
          {d1.labels.map((_, idx) => {
            const x = getX(idx);
            const colWidth = totalRounds > 1 ? chartWidth / (totalRounds - 1) : chartWidth;
            const startX = x - colWidth / 2;
            return (
              <rect
                key={`hover-zone-${idx}`}
                x={startX}
                y={paddingTop}
                width={colWidth}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPointsIndex(idx)}
                onMouseLeave={() => setHoveredPointsIndex(null)}
              />
            );
          })}
        </svg>
      </div>
    );
  };

  const renderPositionChart = (d1: DriverPerformanceData, d2: DriverPerformanceData) => {
    const totalRounds = d1.labels.length;
    if (totalRounds === 0) return null;

    // Coleta posições não nulas para definir a escala Y invertida
    const allPos = [...d1.dataPositions, ...d2.dataPositions].filter(
      (p): p is number => p !== null
    );
    const maxPos = allPos.length > 0 ? Math.max(...allPos, 10) : 10;
    const divisor = maxPos > 1 ? maxPos - 1 : 1;

    const getX = (idx: number) =>
      paddingLeft + (totalRounds > 1 ? (idx / (totalRounds - 1)) * chartWidth : 0);
    // Eixo Y invertido: posição 1 no topo (paddingTop) e maxPos no rodapé (paddingTop + chartHeight)
    const getY = (pos: number | null) => {
      if (pos === null) return null;
      return paddingTop + ((pos - 1) / divisor) * chartHeight;
    };

    // Coordenadas válidas (pulando corridas não participadas)
    const coords1 = d1.dataPositions
      .map((pos, idx) => ({ x: getX(idx), y: getY(pos), pos, idx }))
      .filter((pt) => pt.pos !== null) as Array<{ x: number; y: number; pos: number; idx: number }>;

    const coords2 = d2.dataPositions
      .map((pos, idx) => ({ x: getX(idx), y: getY(pos), pos, idx }))
      .filter((pt) => pt.pos !== null) as Array<{ x: number; y: number; pos: number; idx: number }>;

    // Paths
    const pathD1 = coords1.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
    const pathD2 = coords2.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");

    // Info do hover
    const hoverIdx = hoveredPosIndex;

    // Determina a posição sob o hover ou mostra a melhor de todas
    const getHoverValue = (driver: DriverPerformanceData) => {
      if (hoverIdx === null) return null;
      const val = driver.dataPositions[hoverIdx];
      return val !== null ? `P${val}` : "N/C";
    };

    // Rótulos importantes para o eixo Y
    const gridPositions = Array.from(new Set([1, 2, 3, 5, 10, maxPos]))
      .filter((pos) => pos <= maxPos)
      .sort((a, b) => a - b);

    return (
      <div className="relative">
        {/* Info dinâmica no topo do gráfico */}
        <div className="flex items-center justify-between mb-4 h-10 border-b border-slate-200 pb-2">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            {hoverIdx !== null ? `Etapa ${d1.labels[hoverIdx]}` : "Passe o mouse no gráfico"}
          </div>
          <div className="flex gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <Circle className="h-2.5 w-2.5 fill-current" style={{ color: d1.teamColor || "#ef4444" }} aria-hidden="true" />
              <span className="text-slate-700">{d1.name}:</span>
              <span className="text-slate-950 font-bold">
                {hoverIdx !== null ? getHoverValue(d1) : `Melhor: P${d1.bestPosition}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Circle className="h-2.5 w-2.5 fill-current" style={{ color: d2.teamColor || "#3b82f6" }} aria-hidden="true" />
              <span className="text-slate-700">{d2.name}:</span>
              <span className="text-slate-950 font-bold">
                {hoverIdx !== null ? getHoverValue(d2) : `Melhor: P${d2.bestPosition}`}
              </span>
            </div>
          </div>
        </div>

        <svg viewBox="0 0 600 300" className="w-full h-auto overflow-visible select-none">
          {/* Linhas de Grade Verticais */}
          {d1.labels.map((label, idx) => {
            const x = getX(idx);
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={paddingTop + chartHeight}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={x}
                  y={paddingTop + chartHeight + 20}
                  textAnchor="middle"
                  className="font-mono text-[10px] fill-slate-500 font-bold"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Linhas de Grade Horizontais (Invertidas - P1 no topo) */}
          {gridPositions.map((pos) => {
            const y = getY(pos);
            if (y === null) return null;
            return (
              <g key={pos}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartWidth}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-slate-500 font-bold"
                >
                  P{pos}
                </text>
              </g>
            );
          })}

          {/* Linha do Gráfico Piloto 1 */}
          <path
            d={pathD1}
            fill="none"
            stroke={d1.teamColor || "#ef4444"}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Linha do Gráfico Piloto 2 */}
          <path
            d={pathD2}
            fill="none"
            stroke={d2.teamColor || "#3b82f6"}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Linha vertical sob hover */}
          {hoverIdx !== null && (
            <line
              x1={getX(hoverIdx)}
              y1={paddingTop}
              x2={getX(hoverIdx)}
              y2={paddingTop + chartHeight}
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Círculos nos pontos de dados (Piloto 1) */}
          {coords1.map((pt) => (
            <circle
              key={`p1-pos-${pt.idx}`}
              cx={pt.x}
              cy={pt.y}
              r={hoverIdx === pt.idx ? 6 : 4}
              fill="#ffffff"
              stroke={d1.teamColor || "#ef4444"}
              strokeWidth={hoverIdx === pt.idx ? 3.5 : 2}
              className="transition-all duration-150"
            />
          ))}

          {/* Círculos nos pontos de dados (Piloto 2) */}
          {coords2.map((pt) => (
            <circle
              key={`p2-pos-${pt.idx}`}
              cx={pt.x}
              cy={pt.y}
              r={hoverIdx === pt.idx ? 6 : 4}
              fill="#ffffff"
              stroke={d2.teamColor || "#3b82f6"}
              strokeWidth={hoverIdx === pt.idx ? 3.5 : 2}
              className="transition-all duration-150"
            />
          ))}

          {/* Zonas transparentes para capturar o hover */}
          {d1.labels.map((_, idx) => {
            const x = getX(idx);
            const colWidth = totalRounds > 1 ? chartWidth / (totalRounds - 1) : chartWidth;
            const startX = x - colWidth / 2;
            return (
              <rect
                key={`hover-zone-pos-${idx}`}
                x={startX}
                y={paddingTop}
                width={colWidth}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPosIndex(idx)}
                onMouseLeave={() => setHoveredPosIndex(null)}
              />
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-16 font-sans text-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/95  ">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {season && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider border border-red-200">
                  {season.year}
                </span>
              )}
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                {season ? `${season.name}` : "Performance"}
              </h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Análise gráfica e comparação direta de performance entre pilotos.
            </p>
          </div>
          <div>
            <Link
              href={`/season/${seasonId}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para temporada
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" /> {error}
          </div>
        )}

        {/* Seleção de Pilotos */}
        <section className="bg-white p-6 rounded-lg border border-slate-200 mb-8  shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Gauge className="h-4 w-4 text-red-600" aria-hidden="true" />
            Selecione dois pilotos para comparar
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Piloto 1 */}
            <div>
              <label htmlFor="p1-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Piloto 1
              </label>
              <select
                id="p1-select"
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                disabled={loadingDrivers}
                className="w-full cursor-pointer rounded-md border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 shadow-sm transition-colors focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/15 disabled:opacity-50"
              >
                <option value="">Selecione o piloto...</option>
                {drivers.map((d) => (
                  <option key={d.driverId} value={d.driverId} disabled={d.driverId === p2}>
                    {d.driverName} {d.isGuest ? "(Convidado)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Piloto 2 */}
            <div>
              <label htmlFor="p2-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Piloto 2
              </label>
              <select
                id="p2-select"
                value={p2}
                onChange={(e) => setP2(e.target.value)}
                disabled={loadingDrivers}
                className="w-full cursor-pointer rounded-md border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 shadow-sm transition-colors focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/15 disabled:opacity-50"
              >
                <option value="">Selecione o piloto...</option>
                {drivers.map((d) => (
                  <option key={d.driverId} value={d.driverId} disabled={d.driverId === p1}>
                    {d.driverName} {d.isGuest ? "(Convidado)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Loading ou Tela Vazia */}
        {!performanceData && !loadingPerformance && (
          <div className="text-center py-20 bg-white rounded-lg border border-slate-200 border-dashed">
            <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto leading-relaxed">
              {p1 === p2 && p1 !== ""
                ? "Por favor, selecione dois pilotos diferentes para realizar a comparação."
                : "Selecione ambos os pilotos nos dropdowns acima para renderizar os gráficos de performance e estatísticas."}
            </p>
          </div>
        )}

        {loadingPerformance && (
          <div className="flex flex-col items-center justify-center py-32">
            <LoaderCircle className="mb-4 h-10 w-10 animate-spin text-red-600" aria-hidden="true" />
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider animate-pulse">
              Processando dados de performance...
            </p>
          </div>
        )}

        {/* Gráficos e Comparativos */}
        {performanceData && !loadingPerformance && (
          <div className="space-y-8 animate-fade-in">
            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Gráfico 1 */}
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm ">
                <h3 className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <LineChart className="h-4 w-4 text-red-600" aria-hidden="true" />
                  Evolução Cumulativa de Pontos
                </h3>
                {renderPointsChart(performanceData.p1, performanceData.p2)}
              </div>

              {/* Gráfico 2 */}
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm ">
                <h3 className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <BarChart3 className="h-4 w-4 text-red-600" aria-hidden="true" />
                  Posição de Chegada por Etapa
                </h3>
                {renderPositionChart(performanceData.p1, performanceData.p2)}
              </div>
            </div>

            {/* Cards Comparativos de Estatísticas */}
            <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm ">
              <h3 className="mb-6 flex items-center gap-2 border-b border-slate-200 pb-3 text-sm font-semibold text-slate-950">
                <Gauge className="h-4 w-4 text-red-600" aria-hidden="true" />
                Resumo Estatístico Comparativo
              </h3>

              <div className="space-y-8">
                {/* 1. Total de Pontos */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {performanceData.p1.name} ({performanceData.p1.totalPoints} pts)
                    </span>
                    <span className="text-xs font-extrabold text-slate-950 uppercase tracking-wider">
                      Total de Pontos
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {performanceData.p2.name} ({performanceData.p2.totalPoints} pts)
                    </span>
                  </div>
                  {/* Barra comparativa de Pontos */}
                  <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden flex">
                    {performanceData.p1.totalPoints === 0 && performanceData.p2.totalPoints === 0 ? (
                      <div className="w-full bg-slate-200" />
                    ) : (
                      <>
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${
                              (performanceData.p1.totalPoints /
                                (performanceData.p1.totalPoints + performanceData.p2.totalPoints)) *
                              100
                            }%`,
                            backgroundColor: performanceData.p1.teamColor || "#ef4444",
                          }}
                        />
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${
                              (performanceData.p2.totalPoints /
                                (performanceData.p1.totalPoints + performanceData.p2.totalPoints)) *
                              100
                            }%`,
                            backgroundColor: performanceData.p2.teamColor || "#3b82f6",
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* 2. Melhor Posição */}
                <div className="grid grid-cols-3 items-center py-2 border-t border-slate-200">
                  <div className="text-center">
                    <span
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-md text-lg font-black ${
                        performanceData.p1.bestPosition !== "-" &&
                        (performanceData.p2.bestPosition === "-" ||
                          Number(performanceData.p1.bestPosition) <= Number(performanceData.p2.bestPosition))
                          ? "bg-red-600 text-white shadow-lg shadow-red-500/10"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {performanceData.p1.bestPosition !== "-"
                        ? `P${performanceData.p1.bestPosition}`
                        : "-"}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-wider">
                      {performanceData.p1.bestPosition !== "-" &&
                      (performanceData.p2.bestPosition === "-" ||
                        Number(performanceData.p1.bestPosition) < Number(performanceData.p2.bestPosition))
                        ? "Melhor"
                        : ""}
                    </p>
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-extrabold text-slate-950 uppercase tracking-wider block">
                      Melhor Posição
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">
                      (Menor Posição)
                    </span>
                  </div>
                  <div className="text-center">
                    <span
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-md text-lg font-black ${
                        performanceData.p2.bestPosition !== "-" &&
                        (performanceData.p1.bestPosition === "-" ||
                          Number(performanceData.p2.bestPosition) <= Number(performanceData.p1.bestPosition))
                          ? "bg-red-600 text-white shadow-lg shadow-red-500/10"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {performanceData.p2.bestPosition !== "-"
                        ? `P${performanceData.p2.bestPosition}`
                        : "-"}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-wider">
                      {performanceData.p2.bestPosition !== "-" &&
                      (performanceData.p1.bestPosition === "-" ||
                        Number(performanceData.p2.bestPosition) < Number(performanceData.p1.bestPosition))
                        ? "Melhor"
                        : ""}
                    </p>
                  </div>
                </div>

                {/* 3. Voltas Rápidas */}
                <div className="border-t border-slate-200 pt-6">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {performanceData.p1.name} ({performanceData.p1.fastLaps} VR)
                    </span>
                    <span className="text-xs font-extrabold text-slate-950 uppercase tracking-wider">
                      Voltas Rápidas
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {performanceData.p2.name} ({performanceData.p2.fastLaps} VR)
                    </span>
                  </div>
                  {/* Barra comparativa de Voltas Rápidas */}
                  <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden flex">
                    {performanceData.p1.fastLaps === 0 && performanceData.p2.fastLaps === 0 ? (
                      <div className="w-full bg-slate-200" />
                    ) : (
                      <>
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${
                              (performanceData.p1.fastLaps /
                                (performanceData.p1.fastLaps + performanceData.p2.fastLaps)) *
                              100
                            }%`,
                            backgroundColor: performanceData.p1.teamColor || "#ef4444",
                          }}
                        />
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${
                              (performanceData.p2.fastLaps /
                                (performanceData.p1.fastLaps + performanceData.p2.fastLaps)) *
                              100
                            }%`,
                            backgroundColor: performanceData.p2.teamColor || "#3b82f6",
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
