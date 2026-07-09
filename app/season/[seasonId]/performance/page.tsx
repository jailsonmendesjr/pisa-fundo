"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

export default function PerformancePage() {
  const { seasonId } = useParams() as { seasonId: string };

  const [season, setSeason] = useState<{ name: string; year: number } | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [p1, setP1] = useState<string>("");
  const [p2, setP2] = useState<string>("");

  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [performanceData, setPerformanceData] = useState<{
    p1: DriverPerformanceData;
    p2: DriverPerformanceData;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Índices sob hover para os tooltips interativos de cada gráfico
  const [hoveredPointsIndex, setHoveredPointsIndex] = useState<number | null>(null);
  const [hoveredPosIndex, setHoveredPosIndex] = useState<number | null>(null);

  // 1. Carrega dados iniciais da temporada e lista de pilotos
  useEffect(() => {
    if (!seasonId) return;

    async function loadInitialData() {
      setLoadingDrivers(true);
      setError(null);
      try {
        // Busca a temporada
        const { data: seasonData, error: sErr } = await supabase
          .from("seasons")
          .select("name, year")
          .eq("id", seasonId)
          .single();

        if (sErr) throw sErr;
        setSeason(seasonData);

        // Busca os pilotos inscritos na temporada
        const { data: driversData, error: dErr } = await supabase
          .from("driver_team_season")
          .select("id, is_guest, driver_id, drivers ( id, name )")
          .eq("season_id", seasonId);

        if (dErr) throw dErr;

        const formatted = (driversData ?? [])
          .map((row: any) => ({
            entryId: String(row.id),
            driverId: String(row.drivers?.id),
            driverName: row.drivers?.name as string,
            isGuest: row.is_guest as boolean,
          }))
          .filter((d) => d.driverId && d.driverName)
          .sort((a, b) => a.driverName.localeCompare(b.driverName));

        setDrivers(formatted);
      } catch (err: any) {
        console.error(err);
        setError("Não foi possível carregar a lista de pilotos desta temporada.");
      } finally {
        setLoadingDrivers(false);
      }
    }

    loadInitialData();
  }, [seasonId]);

  // 2. Busca dados de performance dos pilotos selecionados
  useEffect(() => {
    if (!seasonId || !p1 || !p2) {
      setPerformanceData(null);
      return;
    }

    if (p1 === p2) {
      setPerformanceData(null);
      return;
    }

    async function loadPerformance() {
      setLoadingPerformance(true);
      setError(null);
      try {
        const res = await fetch(`/api/seasons/${seasonId}/performance?p1=${p1}&p2=${p2}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Erro na busca dos dados.");
        }
        const data = await res.json();
        setPerformanceData(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Erro ao carregar a análise comparativa.");
      } finally {
        setLoadingPerformance(false);
      }
    }

    loadPerformance();
  }, [seasonId, p1, p2]);

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
        <div className="flex items-center justify-between mb-4 h-10 border-b border-zinc-800 pb-2">
          <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
            {hoverIdx !== null ? `Etapa ${d1.labels[hoverIdx]}` : "Passe o mouse no gráfico"}
          </div>
          <div className="flex gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d1.teamColor || "#ef4444" }} />
              <span className="text-zinc-300">{d1.name}:</span>
              <span className="text-white font-bold">
                {hoverIdx !== null ? `${d1.dataPoints[hoverIdx]} pts` : `${d1.totalPoints} pts`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d2.teamColor || "#3b82f6" }} />
              <span className="text-zinc-300">{d2.name}:</span>
              <span className="text-white font-bold">
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
                  stroke="#27272a"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={x}
                  y={paddingTop + chartHeight + 20}
                  textAnchor="middle"
                  className="font-mono text-[10px] fill-zinc-500 font-bold"
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
                  stroke="#27272a"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-zinc-500 font-bold"
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
              stroke="#f43f5e"
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
              fill="#09090b"
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
              fill="#09090b"
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
        <div className="flex items-center justify-between mb-4 h-10 border-b border-zinc-800 pb-2">
          <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
            {hoverIdx !== null ? `Etapa ${d1.labels[hoverIdx]}` : "Passe o mouse no gráfico"}
          </div>
          <div className="flex gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d1.teamColor || "#ef4444" }} />
              <span className="text-zinc-300">{d1.name}:</span>
              <span className="text-white font-bold">
                {hoverIdx !== null ? getHoverValue(d1) : `Melhor: P${d1.bestPosition}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d2.teamColor || "#3b82f6" }} />
              <span className="text-zinc-300">{d2.name}:</span>
              <span className="text-white font-bold">
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
                  stroke="#27272a"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={x}
                  y={paddingTop + chartHeight + 20}
                  textAnchor="middle"
                  className="font-mono text-[10px] fill-zinc-500 font-bold"
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
                  stroke="#27272a"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-zinc-500 font-bold"
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
              stroke="#f43f5e"
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
              fill="#09090b"
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
              fill="#09090b"
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-16">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {season && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-bold uppercase tracking-wider border border-red-500/20">
                  {season.year}
                </span>
              )}
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white uppercase">
                {season ? `${season.name}` : "Performance"}
              </h1>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              Análise gráfica e comparação direta de performance entre pilotos.
            </p>
          </div>
          <div>
            <Link
              href={`/season/${seasonId}`}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
            >
              ← Voltar para Temporada
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
            ⚠️ {error}
          </div>
        )}

        {/* Seleção de Pilotos */}
        <section className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 mb-8 backdrop-blur-sm shadow-xl">
          <h2 className="text-sm font-black uppercase tracking-wider text-red-500 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-3 bg-red-500 rounded-full inline-block" />
            Selecione dois pilotos para comparar
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Piloto 1 */}
            <div>
              <label htmlFor="p1-select" className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">
                Piloto 1
              </label>
              <select
                id="p1-select"
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                disabled={loadingDrivers}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-850 rounded-xl text-zinc-100 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50 cursor-pointer font-medium"
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
              <label htmlFor="p2-select" className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">
                Piloto 2
              </label>
              <select
                id="p2-select"
                value={p2}
                onChange={(e) => setP2(e.target.value)}
                disabled={loadingDrivers}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-850 rounded-xl text-zinc-100 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50 cursor-pointer font-medium"
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
          <div className="text-center py-20 bg-zinc-900/30 rounded-2xl border border-zinc-850 border-dashed">
            <p className="text-zinc-400 text-sm font-medium max-w-sm mx-auto leading-relaxed">
              {p1 === p2 && p1 !== ""
                ? "Por favor, selecione dois pilotos diferentes para realizar a comparação."
                : "Selecione ambos os pilotos nos dropdowns acima para renderizar os gráficos de performance e estatísticas."}
            </p>
          </div>
        )}

        {loadingPerformance && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-10 h-10 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin mb-4" />
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider animate-pulse">
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
              <div className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-red-500 rounded-full inline-block" />
                  Evolução Cumulativa de Pontos
                </h3>
                {renderPointsChart(performanceData.p1, performanceData.p2)}
              </div>

              {/* Gráfico 2 */}
              <div className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-red-500 rounded-full inline-block" />
                  Posição de Chegada por Etapa
                </h3>
                {renderPositionChart(performanceData.p1, performanceData.p2)}
              </div>
            </div>

            {/* Cards Comparativos de Estatísticas */}
            <section className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm">
              <h3 className="text-sm font-black uppercase tracking-wider text-red-500 mb-6 flex items-center gap-2 border-b border-zinc-800 pb-3">
                <span className="w-1.5 h-3 bg-red-500 rounded-full inline-block" />
                Resumo Estatístico Comparativo
              </h3>

              <div className="space-y-8">
                {/* 1. Total de Pontos */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      {performanceData.p1.name} ({performanceData.p1.totalPoints} pts)
                    </span>
                    <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                      Total de Pontos
                    </span>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      {performanceData.p2.name} ({performanceData.p2.totalPoints} pts)
                    </span>
                  </div>
                  {/* Barra comparativa de Pontos */}
                  <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden flex">
                    {performanceData.p1.totalPoints === 0 && performanceData.p2.totalPoints === 0 ? (
                      <div className="w-full bg-zinc-800" />
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
                <div className="grid grid-cols-3 items-center py-2 border-t border-zinc-850">
                  <div className="text-center">
                    <span
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-lg font-black ${
                        performanceData.p1.bestPosition !== "-" &&
                        (performanceData.p2.bestPosition === "-" ||
                          Number(performanceData.p1.bestPosition) <= Number(performanceData.p2.bestPosition))
                          ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/10"
                          : "bg-zinc-850 text-zinc-400"
                      }`}
                    >
                      {performanceData.p1.bestPosition !== "-"
                        ? `P${performanceData.p1.bestPosition}`
                        : "-"}
                    </span>
                    <p className="text-[10px] text-zinc-500 mt-2 font-bold uppercase tracking-wider">
                      {performanceData.p1.bestPosition !== "-" &&
                      (performanceData.p2.bestPosition === "-" ||
                        Number(performanceData.p1.bestPosition) < Number(performanceData.p2.bestPosition))
                        ? "🏆 Melhor"
                        : ""}
                    </p>
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-extrabold text-white uppercase tracking-wider block">
                      Melhor Posição
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1 block">
                      (Menor Posição)
                    </span>
                  </div>
                  <div className="text-center">
                    <span
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-lg font-black ${
                        performanceData.p2.bestPosition !== "-" &&
                        (performanceData.p1.bestPosition === "-" ||
                          Number(performanceData.p2.bestPosition) <= Number(performanceData.p1.bestPosition))
                          ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/10"
                          : "bg-zinc-850 text-zinc-400"
                      }`}
                    >
                      {performanceData.p2.bestPosition !== "-"
                        ? `P${performanceData.p2.bestPosition}`
                        : "-"}
                    </span>
                    <p className="text-[10px] text-zinc-500 mt-2 font-bold uppercase tracking-wider">
                      {performanceData.p2.bestPosition !== "-" &&
                      (performanceData.p1.bestPosition === "-" ||
                        Number(performanceData.p2.bestPosition) < Number(performanceData.p1.bestPosition))
                        ? "🏆 Melhor"
                        : ""}
                    </p>
                  </div>
                </div>

                {/* 3. Voltas Rápidas */}
                <div className="border-t border-zinc-850 pt-6">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      {performanceData.p1.name} ({performanceData.p1.fastLaps} VR)
                    </span>
                    <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                      Voltas Rápidas
                    </span>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      {performanceData.p2.name} ({performanceData.p2.fastLaps} VR)
                    </span>
                  </div>
                  {/* Barra comparativa de Voltas Rápidas */}
                  <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden flex">
                    {performanceData.p1.fastLaps === 0 && performanceData.p2.fastLaps === 0 ? (
                      <div className="w-full bg-zinc-800" />
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
