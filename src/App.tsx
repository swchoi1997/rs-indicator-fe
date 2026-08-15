import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Activity,
  Globe,
  Briefcase,
  Calendar,
  Layers,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Table as TableIcon,
} from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import {
  getIndexCandles,
  getInvestorNet,
  getInvestorNetCumulative,
  getMacroIndicators,
  getTrackedStocks,
  getStockCandles,
} from './api/client';
import type {
  MarketIndexCandle,
  InvestorNetDailyItem,
  InvestorNetCumulativeItem,
  MacroIndicatorItem,
  TrackedStock,
  StockCandle,
} from './api/types';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import dayjs from 'dayjs';

interface InvestorSubjectOption {
  key: string;
  label: string;
  color: string;
}

interface FlatMenuItem {
  categoryCode: string;
  itemCode: string;
  symbol?: string;
  title: string;
}

interface MacroCandleItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  value: number;
}

// 거시 경제 캔들 차트 (양봉/음봉 정통 SVG 캔들차트 + 3대 보조지표 옵션 선택 컴포넌트)
function MacroCandleChart({
  data: rawData,
  symbol,
  startDate,
  theme = 'dark',
}: {
  data: MacroCandleItem[];
  symbol: string;
  startDate: string;
  theme?: 'dark' | 'light';
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // 보조지표 옵션 선택 상태 (기본: 이동평균선 5/20/60/120/200 ON, 볼린저/일목 OFF)
  const [showMA, setShowMA] = useState<boolean>(true);
  const [showBollinger, setShowBollinger] = useState<boolean>(false);
  const [showIchimoku, setShowIchimoku] = useState<boolean>(false);

  if (!rawData || rawData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[640px] text-slate-400">
        데이터가 없습니다.
      </div>
    );
  }

  // 1. 이동평균선 (SMA: 5, 20, 60, 120, 200) - 과거 1년 사전 데이터 포함 전체 rawData 기반 계산
  const calcSMA = (period: number) => {
    return rawData.map((_, idx) => {
      if (idx < period - 1) return null;
      let sum = 0;
      for (let k = idx - period + 1; k <= idx; k++) {
        sum += rawData[k].close;
      }
      return sum / period;
    });
  };

  const ma5Full = calcSMA(5);
  const ma20Full = calcSMA(20);
  const ma60Full = calcSMA(60);
  const ma120Full = calcSMA(120);
  const ma200Full = calcSMA(200);

  // 2. 볼린저 밴드
  const bbandsFull = rawData.map((_, idx) => {
    if (idx < 19 || ma20Full[idx] == null) return null;
    const mid = ma20Full[idx]!;
    let variance = 0;
    for (let k = idx - 19; k <= idx; k++) {
      variance += Math.pow(rawData[k].close - mid, 2);
    }
    const stdDev = Math.sqrt(variance / 20);
    return {
      mid,
      upper: mid + 2 * stdDev,
      lower: mid - 2 * stdDev,
    };
  });

  // 3. 일목균형표
  const calcMid = (startIdx: number, length: number) => {
    let maxH = -Infinity;
    let minL = Infinity;
    for (let k = startIdx; k < startIdx + length; k++) {
      if (rawData[k].high > maxH) maxH = rawData[k].high;
      if (rawData[k].low < minL) minL = rawData[k].low;
    }
    return (maxH + minL) / 2;
  };

  const ichimokuFull = rawData.map((_, idx) => {
    const tenkan = idx >= 8 ? calcMid(idx - 8, 9) : null;
    const kijun = idx >= 25 ? calcMid(idx - 25, 26) : null;
    const spanA = tenkan != null && kijun != null ? (tenkan + kijun) / 2 : null;
    const spanB = idx >= 51 ? calcMid(idx - 51, 52) : null;
    return { tenkan, kijun, spanA, spanB };
  });

  // 4. 사용자가 조회하고자 하는 startDate 시점 이후 데이터만 시각적 렌더링용으로 슬라이싱
  let startIndex = rawData.findIndex((d) => d.date >= startDate);
  if (startIndex < 0) startIndex = 0;

  const data = rawData.slice(startIndex);
  const ma5 = ma5Full.slice(startIndex);
  const ma20 = ma20Full.slice(startIndex);
  const ma60 = ma60Full.slice(startIndex);
  const ma120 = ma120Full.slice(startIndex);
  const ma200 = ma200Full.slice(startIndex);
  const bbands = bbandsFull.slice(startIndex);
  const ichimoku = ichimokuFull.slice(startIndex);

  // Y축 Min/Max 범위 계산 (캔들 + 활성화된 보조지표 포함)
  let allMin = Math.min(...data.map((d) => d.low));
  let allMax = Math.max(...data.map((d) => d.high));

  if (showMA) {
    [ma5, ma20, ma60, ma120, ma200].forEach((series) => {
      series.forEach((v) => {
        if (v != null) {
          if (v < allMin) allMin = v;
          if (v > allMax) allMax = v;
        }
      });
    });
  }

  if (showBollinger) {
    bbands.forEach((b) => {
      if (b) {
        if (b.lower < allMin) allMin = b.lower;
        if (b.upper > allMax) allMax = b.upper;
      }
    });
  }

  if (showIchimoku) {
    ichimoku.forEach((ich) => {
      if (ich) {
        [ich.tenkan, ich.kijun, ich.spanA, ich.spanB].forEach((v) => {
          if (v != null) {
            if (v < allMin) allMin = v;
            if (v > allMax) allMax = v;
          }
        });
      }
    });
  }

  const CHART_FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Trebuchet MS", "Segoe UI", Roboto, sans-serif';

  const chartHeight = 560;
  const paddingTop = 25;
  const paddingBottom = 40;
  const paddingLeft = 20;
  const paddingRight = 105;
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const usableWidth = 1000 - paddingLeft - paddingRight;

  const formatDate = (dStr: string) => {
    if (!dStr) return '';
    const clean = dStr.replace(/-/g, '');
    if (clean.length === 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
    }
    return dStr;
  };

  const formatDateShort = (dStr: string) => {
    if (!dStr) return '';
    const clean = dStr.replace(/-/g, '');
    if (clean.length === 8) {
      return `${clean.slice(2, 4)}.${clean.slice(4, 6)}.${clean.slice(6, 8)}`;
    }
    return dStr;
  };

  // 10^n 및 1, 2, 5 배수 기반 딱 떨어지는 Y축 눈금 계산 (TradingView 방식)
  const calculateNiceTicks = (minV: number, maxV: number, targetTicks = 6) => {
    const rangeV = maxV - minV;
    if (rangeV <= 0) return { ticks: [{ val: minV, y: paddingTop }], min: minV, max: maxV, range: 1 };

    const rawStep = rangeV / (targetTicks - 1);
    const exp = Math.floor(Math.log10(rawStep));
    const frac = rawStep / Math.pow(10, exp);

    let niceFrac = 1;
    if (frac < 1.5) niceFrac = 1;
    else if (frac < 3.5) niceFrac = 2;
    else if (frac < 7.5) niceFrac = 5;
    else niceFrac = 10;

    const step = niceFrac * Math.pow(10, exp);
    const niceMin = Math.floor(minV / step) * step;
    const niceMax = Math.ceil(maxV / step) * step;
    const niceRange = niceMax - niceMin || 1;

    const ticks: { val: number; y: number }[] = [];
    for (let val = niceMin; val <= niceMax + step * 0.0001; val += step) {
      const roundedVal = Number(val.toFixed(4));
      const y = paddingTop + usableHeight * (1 - (roundedVal - niceMin) / niceRange);
      ticks.push({ val: roundedVal, y });
    }

    return { ticks, min: niceMin, max: niceMax, range: niceRange };
  };

  const margin = (allMax - allMin) * 0.05 || 1;
  const { ticks: yTicks, min: minVal, range } = calculateNiceTicks(allMin - margin, allMax + margin, 6);

  const getY = (val: number) => {
    return paddingTop + usableHeight * (1 - (val - minVal) / range);
  };

  const getX = (idx: number) => {
    const slotWidth = usableWidth / data.length;
    return paddingLeft + idx * slotWidth + slotWidth / 2;
  };

  // 최고점 (High), 최저점 (Low), 현재가 (Current Price) 계산
  let maxIdx = 0;
  let minIdx = 0;
  data.forEach((d, i) => {
    if (d.high > data[maxIdx].high) maxIdx = i;
    if (d.low < data[minIdx].low) minIdx = i;
  });

  const maxCandle = data[maxIdx];
  const minCandle = data[minIdx];
  const latestCandle = data[data.length - 1];
  const currentPrice = latestCandle ? (latestCandle.close ?? latestCandle.value) : 0;

  // TradingView 변동률 계산: ((현재가 - 고점/저점) / 고점/저점) * 100
  const maxDiffPct = maxCandle && maxCandle.high ? ((currentPrice - maxCandle.high) / maxCandle.high) * 100 : 0;
  const minDiffPct = minCandle && minCandle.low ? ((currentPrice - minCandle.low) / minCandle.low) * 100 : 0;

  const getSmartAnchor = (idx: number) => {
    const x = getX(idx);
    if (x < paddingLeft + 140) return 'start';
    if (x > 1000 - paddingRight - 140) return 'end';
    return 'middle';
  };

  // X축 날짜 눈금 라벨 (7개 균등 분할 추출하여 글자가 서로 겹치는 현상 보정)
  const maxLabels = 7;
  const labelIndices: number[] = [];
  if (data.length > 0) {
    for (let k = 0; k < maxLabels; k++) {
      const idx = Math.min(
        Math.floor((k * (data.length - 1)) / (maxLabels - 1)),
        data.length - 1
      );
      if (!labelIndices.includes(idx)) {
        labelIndices.push(idx);
      }
    }
  }

  // 차트 캔버스 마우스 이동 시 캔들 위치 동적 트래킹 (정밀 호버 감지)
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const mouseX = e.clientX - rect.left;
    const viewBoxX = (mouseX / rect.width) * 1000;

    if (viewBoxX < paddingLeft || viewBoxX > 1000 - paddingRight) {
      setHoverIndex(null);
      return;
    }

    const relX = viewBoxX - paddingLeft;
    const index = Math.floor((relX / usableWidth) * data.length);
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
    setHoverIndex(clampedIndex);
  };

  // SVG 패스 생성 헬퍼
  const createPathD = (values: (number | null)[]) => {
    let d = '';
    values.forEach((v, i) => {
      if (v == null) return;
      const x = getX(i);
      const y = getY(v);
      if (d === '') d += `M ${x} ${y}`;
      else d += ` L ${x} ${y}`;
    });
    return d;
  };

  // 볼린저 밴드 영역 Fill 패스
  const createBandFillPath = () => {
    let upperPts: { x: number; y: number }[] = [];
    let lowerPts: { x: number; y: number }[] = [];

    bbands.forEach((b, i) => {
      if (!b) return;
      const x = getX(i);
      upperPts.push({ x, y: getY(b.upper) });
      lowerPts.push({ x, y: getY(b.lower) });
    });

    if (upperPts.length === 0) return '';

    let d = `M ${upperPts[0].x} ${upperPts[0].y}`;
    for (let i = 1; i < upperPts.length; i++) {
      d += ` L ${upperPts[i].x} ${upperPts[i].y}`;
    }
    for (let i = lowerPts.length - 1; i >= 0; i--) {
      d += ` L ${lowerPts[i].x} ${lowerPts[i].y}`;
    }
    d += ' Z';
    return d;
  };

  // 일목균형표 양구름 (Green) / 음구름 (Red) 동적 세그먼트 생성
  const createCloudSegments = () => {
    const segments: { path: string; isBullish: boolean }[] = [];

    for (let i = 1; i < data.length; i++) {
      const ichPrev = ichimoku[i - 1];
      const ichCurr = ichimoku[i];

      if (
        ichPrev &&
        ichCurr &&
        ichPrev.spanA != null &&
        ichPrev.spanB != null &&
        ichCurr.spanA != null &&
        ichCurr.spanB != null
      ) {
        const xPrev = getX(i - 1);
        const xCurr = getX(i);

        const yA_prev = getY(ichPrev.spanA);
        const yB_prev = getY(ichPrev.spanB);
        const yA_curr = getY(ichCurr.spanA);
        const yB_curr = getY(ichCurr.spanB);

        const isBullish = (ichPrev.spanA + ichCurr.spanA) / 2 >= (ichPrev.spanB + ichCurr.spanB) / 2;
        const path = `M ${xPrev} ${yA_prev} L ${xCurr} ${yA_curr} L ${xCurr} ${yB_curr} L ${xPrev} ${yB_prev} Z`;
        segments.push({ path, isBullish });
      }
    }

    return segments;
  };

  const formatVal = (v: number | null | undefined) => {
    if (v == null || isNaN(v)) return '-';
    if (symbol === 'USDKRW' || /^\d{6}$/.test(symbol)) return `${Number(v).toLocaleString()} 원`;
    if (symbol === 'US10Y' || symbol === 'KR_BOND_3Y' || symbol === 'KR3Y') return `${Number(v)} %`;
    if (symbol === 'WTI') return `$ ${Number(v)}`;
    if (symbol === 'NASDAQ' || symbol === 'S&P500' || symbol === '^IXIC' || symbol === '^GSPC') {
      return `$ ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (symbol === 'KOSPI' || symbol === 'KOSDAQ') {
      return `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pt`;
    }
    return `${Number(v).toLocaleString()}`;
  };


  return (
    <div className="space-y-3">
      {/* 보조지표 옵션 선택 패널 */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-amber-400" /> 보조지표 옵션:
          </span>

          {/* 1. 이동평균선 (기본 ON) */}
          <label className="flex items-center space-x-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/80 hover:border-amber-500/50 transition">
            <input
              type="checkbox"
              checked={showMA}
              onChange={(e) => setShowMA(e.target.checked)}
              className="rounded text-amber-400 focus:ring-0 bg-slate-950 border-slate-700 cursor-pointer"
            />
            <span className="font-bold text-slate-200">이동평균선 (5/20/60/120/200)</span>
            <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              기본
            </span>
          </label>

          {/* 2. 볼린저 밴드 (옵션) */}
          <label className="flex items-center space-x-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/80 hover:border-cyan-500/50 transition">
            <input
              type="checkbox"
              checked={showBollinger}
              onChange={(e) => setShowBollinger(e.target.checked)}
              className="rounded text-cyan-400 focus:ring-0 bg-slate-950 border-slate-700 cursor-pointer"
            />
            <span className="font-bold text-slate-200">볼린저 밴드 (20, 2σ)</span>
          </label>

          {/* 3. 일목균형표 (옵션) */}
          <label className="flex items-center space-x-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/80 hover:border-emerald-500/50 transition">
            <input
              type="checkbox"
              checked={showIchimoku}
              onChange={(e) => setShowIchimoku(e.target.checked)}
              className="rounded text-emerald-400 focus:ring-0 bg-slate-950 border-slate-700 cursor-pointer"
            />
            <span className="font-bold text-slate-200">일목균형표 (구름대)</span>
          </label>
        </div>

        {/* 이평선 및 일목균형표 색상 범례 뱃지 */}
        <div className="flex flex-wrap items-center gap-2">
          {showMA && (
            <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#F59E0B] rounded-full inline-block"></span>5선</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#06B6D4] rounded-full inline-block"></span>20선</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#10B981] rounded-full inline-block"></span>60선</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#8B5CF6] rounded-full inline-block"></span>120선</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#F43F5E] rounded-full inline-block"></span>200선</span>
            </div>
          )}

          {showIchimoku && (
            <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#3B82F6] rounded-full inline-block"></span>전환선(9)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#F59E0B] rounded-full inline-block"></span>기준선(26)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#10B981] rounded-full inline-block"></span>선행1</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#F43F5E] rounded-full inline-block"></span>선행2</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-emerald-500/30 border border-emerald-500/50 rounded inline-block"></span>양구름</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-rose-500/30 border border-rose-500/50 rounded inline-block"></span>음구름</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative w-full h-[640px] select-none font-sans bg-slate-950/40 rounded-xl p-2 border border-slate-800/80">
        <svg
          className="w-full h-full"
          viewBox={`0 0 1000 ${chartHeight}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* 우측 Y축 그리드선 및 딱 떨어지는 10^n 수치 라벨 */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={1000 - paddingRight}
                y2={tick.y}
                stroke="#334155"
                strokeDasharray="3 3"
              />
              <text
                x={1000 - paddingRight + 6}
                y={tick.y + 3.5}
                fill="#94A3B8"
                fontSize="9.5"
                fontWeight="400"
                fontFamily={CHART_FONT}
                style={{ letterSpacing: '-0.3px' }}
                textAnchor="start"
              >
                {formatVal(tick.val)}
              </text>
            </g>
          ))}

          {/* 일목균형표 선명한 양구름(Green) & 음구름(Red) 듀얼 Cloud Fill & 선행스팬 테두리 */}
          {showIchimoku && (
            <g pointerEvents="none">
              {createCloudSegments().map((seg, idx) => (
                <path
                  key={idx}
                  d={seg.path}
                  fill={seg.isBullish ? 'rgba(16, 185, 129, 0.28)' : 'rgba(244, 63, 94, 0.28)'}
                  stroke={seg.isBullish ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}
                  strokeWidth="0.5"
                />
              ))}
              {/* 선행스팬1 (Emerald) & 선행스팬2 (Rose) 테두리 선 */}
              <path d={createPathD(ichimoku.map((ich) => (ich ? ich.spanA : null)))} stroke="#10B981" strokeWidth="1.2" fill="none" />
              <path d={createPathD(ichimoku.map((ich) => (ich ? ich.spanB : null)))} stroke="#F43F5E" strokeWidth="1.2" fill="none" />
            </g>
          )}

          {/* 볼린저 밴드 영역 Fill & Upper/Lower Lines */}
          {showBollinger && (
            <>
              <path d={createBandFillPath()} fill="rgba(96, 165, 250, 0.08)" />
              <path
                d={createPathD(bbands.map((b) => (b ? b.upper : null)))}
                stroke="#60A5FA"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                fill="none"
              />
              <path
                d={createPathD(bbands.map((b) => (b ? b.lower : null)))}
                stroke="#60A5FA"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                fill="none"
              />
            </>
          )}

          {/* 이동평균선 Lines (5: Amber, 20: Cyan, 60: Emerald, 120: Purple, 200: Rose) */}
          {showMA && (
            <>
              <path d={createPathD(ma5)} stroke="#F59E0B" strokeWidth="1.5" fill="none" />
              <path d={createPathD(ma20)} stroke="#06B6D4" strokeWidth="1.5" fill="none" />
              <path d={createPathD(ma60)} stroke="#10B981" strokeWidth="1.5" fill="none" />
              <path d={createPathD(ma120)} stroke="#8B5CF6" strokeWidth="1.5" fill="none" />
              <path d={createPathD(ma200)} stroke="#F43F5E" strokeWidth="1.5" fill="none" />
            </>
          )}

          {/* 일목균형표 전환선(Blue)/기준선(Amber) Lines */}
          {showIchimoku && (
            <g pointerEvents="none">
              <path
                d={createPathD(ichimoku.map((ich) => (ich ? ich.tenkan : null)))}
                stroke="#3B82F6"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d={createPathD(ichimoku.map((ich) => (ich ? ich.kijun : null)))}
                stroke="#F59E0B"
                strokeWidth="1.5"
                fill="none"
              />
            </g>
          )}

          {/* X축 날짜 라벨 (100% 잘림 방지 스마트 앵커링 & 정밀 폰트) */}
          {labelIndices.map((i, k) => {
            const d = data[i];
            const x = getX(i);
            const isFirst = k === 0;
            const isLast = k === labelIndices.length - 1;
            const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
            const posX = isFirst ? paddingLeft : isLast ? 1000 - paddingRight : x;

            return (
              <text
                key={i}
                x={posX}
                y={chartHeight - 12}
                fill="#94A3B8"
                fontSize="9.5"
                fontWeight="400"
                fontFamily={CHART_FONT}
                style={{ letterSpacing: '-0.3px' }}
                textAnchor={anchor}
              >
                {formatDate(d.date)}
              </text>
            );
          })}

          {/* 캔들 차트 바 (양봉 Red #EF4444, 음봉 Blue #3B82F6) */}
          {data.map((d, i) => {
            const slotWidth = usableWidth / data.length;
            const centerX = getX(i);
            const bodyWidth = Math.max(slotWidth * 0.65, 2.5);
            const candleX = centerX - bodyWidth / 2;

            const isUp = d.close >= d.open;
            const color = isUp ? '#EF4444' : '#3B82F6';

            const yOpen = getY(d.open);
            const yClose = getY(d.close);
            const yHigh = getY(d.high);
            const yLow = getY(d.low);

            const candleTop = Math.min(yOpen, yClose);
            const candleHeight = Math.max(Math.abs(yClose - yOpen), 1.5);

            return (
              <g key={i}>
                {/* 심지 (High-Low Wick) */}
                <line
                  x1={centerX}
                  y1={yHigh}
                  x2={centerX}
                  y2={yLow}
                  stroke={color}
                  strokeWidth={1.5}
                />
                {/* 몸통 (Open-Close Rect) */}
                <rect
                  x={candleX}
                  y={candleTop}
                  width={bodyWidth}
                  height={candleHeight}
                  fill={color}
                  stroke={color}
                  strokeWidth={1}
                  rx={0.5}
                />
              </g>
            );
          })}

          {/* 현재가 파란 점선 & 우측 Y축 현재가 뱃지 (TradingView 스타일 - 동적 핏팅 직결 정렬) */}
          {currentPrice > 0 && (() => {
            const yCurrent = getY(currentPrice);
            const strVal = formatVal(currentPrice);
            const badgeWidth = Math.min(Math.max(strVal.length * 6.2 + 10, 52), 84);
            const badgeX = 1000 - paddingRight + 1;
            return (
              <g pointerEvents="none">
                <line
                  x1={paddingLeft}
                  y1={yCurrent}
                  x2={1000 - paddingRight}
                  y2={yCurrent}
                  stroke="#3B82F6"
                  strokeDasharray="2 2"
                  strokeWidth="1.2"
                />
                <rect
                  x={badgeX}
                  y={yCurrent - 8.5}
                  width={badgeWidth}
                  height="17"
                  rx="3.5"
                  fill="#2563EB"
                />
                <text
                  x={badgeX + badgeWidth / 2}
                  y={yCurrent + 3.5}
                  fill="#FFFFFF"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily={CHART_FONT}
                  style={{ letterSpacing: '-0.3px' }}
                  textAnchor="middle"
                >
                  {strVal}
                </text>
              </g>
            );
          })()}

          {/* 최고점 (High) 핀 & 라벨 (Red) - 100% 잘림 방지 스마트 핏팅 */}
          {maxCandle && maxCandle.high != null && (() => {
            const x = getX(maxIdx);
            const y = getY(maxCandle.high);
            const anchor = getSmartAnchor(maxIdx);
            const diffText = `${maxDiffPct >= 0 ? '+' : ''}${maxDiffPct.toFixed(2)}%`;

            // 천장 여백(paddingTop)과 가까우면 라벨을 캔들 아래(y + 20)로 자동 반전
            const isNearTop = y < paddingTop + 20;
            const textY = isNearTop ? y + 20 : y - 11;
            const pinY1 = isNearTop ? y + 2 : y - 2;
            const pinY2 = isNearTop ? y + 7 : y - 7;

            return (
              <g pointerEvents="none">
                <polygon
                  points={`${x},${pinY1} ${x - 3.5},${pinY2} ${x + 3.5},${pinY2}`}
                  fill="#EF4444"
                />
                <text
                  x={x}
                  y={textY}
                  fill="#EF4444"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily={CHART_FONT}
                  style={{ letterSpacing: '-0.2px' }}
                  textAnchor={anchor}
                >
                  {formatVal(maxCandle.high)} ({diffText}, {formatDateShort(maxCandle.date)})
                </text>
              </g>
            );
          })()}

          {/* 최저점 (Low) 핀 & 라벨 (Blue) - 100% 잘림 방지 스마트 핏팅 */}
          {minCandle && minCandle.low != null && (() => {
            const x = getX(minIdx);
            const y = getY(minCandle.low);
            const anchor = getSmartAnchor(minIdx);
            const diffText = `${minDiffPct >= 0 ? '+' : ''}${minDiffPct.toFixed(2)}%`;

            // 바닥 여백(paddingBottom)과 가까우면 라벨을 캔들 위(y - 11)로 자동 반전
            const isNearBottom = y > chartHeight - paddingBottom - 25;
            const textY = isNearBottom ? y - 11 : y + 20;
            const pinY1 = isNearBottom ? y - 2 : y + 2;
            const pinY2 = isNearBottom ? y - 7 : y + 7;

            return (
              <g pointerEvents="none">
                <polygon
                  points={`${x},${pinY1} ${x - 3.5},${pinY2} ${x + 3.5},${pinY2}`}
                  fill="#3B82F6"
                />
                <text
                  x={x}
                  y={textY}
                  fill="#3B82F6"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily={CHART_FONT}
                  style={{ letterSpacing: '-0.2px' }}
                  textAnchor={anchor}
                >
                  {formatVal(minCandle.low)} ({diffText}, {formatDateShort(minCandle.date)})
                </text>
              </g>
            );
          })()}

          {/* 전면 투명 슬롯 호버 감지 영역 (마우스 수직 전체 영역 정밀 인식) */}
          {data.map((_, i) => {
            const slotWidth = usableWidth / data.length;
            const x = paddingLeft + i * slotWidth;
            return (
              <rect
                key={`hover-slot-${i}`}
                x={x}
                y={paddingTop}
                width={slotWidth}
                height={usableHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
              />
            );
          })}

          {/* 마우스 호버 세로 Crosshair 선 */}
          {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length && (() => {
            const d = data[hoverIndex];
            const centerX = getX(hoverIndex);
            const yClose = getY(d.close);

            return (
              <g pointerEvents="none">
                <line
                  x1={centerX}
                  y1={paddingTop}
                  x2={centerX}
                  y2={chartHeight - paddingBottom}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <circle cx={centerX} cy={yClose} r={4} fill="#F59E0B" />
              </g>
            );
          })()}
        </svg>

        {/* 마우스 호버 정보 종합 카드 (OHLC + 활성화된 보조지표 실시간 표시 - 화면 이탈 방지 스마트 동적 위치 조정) */}
        {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length && (() => {
          const d = data[hoverIndex];
          const isUp = d.close >= d.open;
          const isLight = theme === 'light';

          const hoverX = getX(hoverIndex);
          const isRightHalf = hoverIndex > data.length * 0.55;
          const cardLeft = isRightHalf
            ? Math.max(20, hoverX - 280)
            : Math.min(hoverX + 20, 720);

          return (
            <div
              style={{ left: `${cardLeft}px`, top: '16px' }}
              className={`absolute border rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[260px] z-20 pointer-events-none transition-all duration-75 ${
                isLight
                  ? 'bg-white/95 border-slate-300 text-slate-900 shadow-slate-400/20'
                  : 'bg-slate-900/95 border-slate-700/90 text-slate-100'
              }`}
            >
              <div className={`font-bold pb-1.5 flex items-center justify-between gap-3 border-b ${isLight ? 'text-slate-900 border-slate-200' : 'text-slate-200 border-slate-800'}`}>
                <span>날짜: {d.date}</span>
                <span className={`px-1.5 py-0.5 rounded font-extrabold text-[10px] ${isUp ? 'bg-rose-500/20 text-rose-500' : 'bg-blue-500/20 text-blue-500'}`}>
                  {isUp ? '▲ 양봉' : '▼ 음봉'}
                </span>
              </div>

              {/* OHLC 시가/고가/저가/종가 */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
                <div><span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400'}>시가:</span> <span className={isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'}>{formatVal(d.open)}</span></div>
                <div><span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400'}>고가:</span> <span className="text-rose-500 font-semibold">{formatVal(d.high)}</span></div>
                <div><span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400'}>저가:</span> <span className="text-blue-500 font-semibold">{formatVal(d.low)}</span></div>
                <div><span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400'}>종가:</span> <span className={isLight ? 'text-amber-600 font-bold' : 'text-amber-400 font-bold'}>{formatVal(d.close)}</span></div>
              </div>

              {/* 이동평균선 실시간 값 */}
              {showMA && (
                <div className={`border-t pt-1.5 space-y-1 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                  <div className={`text-[10px] font-bold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>이동평균선 (SMA):</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
                    <div className="flex items-center gap-1"><span className="w-2 h-0.5 bg-[#F59E0B]"></span><span className={isLight ? 'text-slate-600' : 'text-slate-400'}>5선:</span><span className={isLight ? 'text-amber-600 font-bold' : 'text-amber-300'}>{formatVal(ma5[hoverIndex])}</span></div>
                    <div className="flex items-center gap-1"><span className="w-2 h-0.5 bg-[#06B6D4]"></span><span className={isLight ? 'text-slate-600' : 'text-slate-400'}>20선:</span><span className={isLight ? 'text-cyan-600 font-bold' : 'text-cyan-300'}>{formatVal(ma20[hoverIndex])}</span></div>
                    <div className="flex items-center gap-1"><span className="w-2 h-0.5 bg-[#10B981]"></span><span className={isLight ? 'text-slate-600' : 'text-slate-400'}>60선:</span><span className={isLight ? 'text-emerald-600 font-bold' : 'text-emerald-300'}>{formatVal(ma60[hoverIndex])}</span></div>
                    <div className="flex items-center gap-1"><span className="w-2 h-0.5 bg-[#8B5CF6]"></span><span className={isLight ? 'text-slate-600' : 'text-slate-400'}>120선:</span><span className={isLight ? 'text-purple-600 font-bold' : 'text-purple-300'}>{formatVal(ma120[hoverIndex])}</span></div>
                    <div className="flex items-center gap-1"><span className="w-2 h-0.5 bg-[#F43F5E]"></span><span className={isLight ? 'text-slate-600' : 'text-slate-400'}>200선:</span><span className={isLight ? 'text-rose-600 font-bold' : 'text-rose-300'}>{formatVal(ma200[hoverIndex])}</span></div>
                  </div>
                </div>
              )}

              {/* 볼린저 밴드 실시간 값 */}
              {showBollinger && bbands[hoverIndex] && (
                <div className={`border-t pt-1.5 space-y-1 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                  <div className={`text-[10px] font-bold ${isLight ? 'text-cyan-600' : 'text-cyan-400'}`}>볼린저 밴드 (20, 2σ):</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
                    <div><span className={isLight ? 'text-slate-600' : 'text-slate-400'}>상한선:</span> <span className={isLight ? 'text-cyan-600 font-bold' : 'text-cyan-300'}>{formatVal(bbands[hoverIndex]?.upper)}</span></div>
                    <div><span className={isLight ? 'text-slate-600' : 'text-slate-400'}>하한선:</span> <span className={isLight ? 'text-cyan-600 font-bold' : 'text-cyan-300'}>{formatVal(bbands[hoverIndex]?.lower)}</span></div>
                  </div>
                </div>
              )}

              {/* 일목균형표 실시간 값 */}
              {showIchimoku && ichimoku[hoverIndex] && (
                <div className={`border-t pt-1.5 space-y-1 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                  <div className={`text-[10px] font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>일목균형표:</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
                    <div><span className={isLight ? 'text-slate-600' : 'text-slate-400'}>전환선(9):</span> <span className="text-blue-500 font-bold">{formatVal(ichimoku[hoverIndex]?.tenkan)}</span></div>
                    <div><span className={isLight ? 'text-slate-600' : 'text-slate-400'}>기준선(26):</span> <span className="text-amber-600 font-bold">{formatVal(ichimoku[hoverIndex]?.kijun)}</span></div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// 전체 메뉴 순차 순서 정의 (수급분석 -> 거시경제 -> 시장지수 -> 관심종목)
const ORDERED_MENU_ITEMS: FlatMenuItem[] = [
  // 수급 분석 (1, 2, 3)
  { categoryCode: 'INVESTOR', itemCode: 'FOREIGNER_2Y_CUM', symbol: 'FOREIGNER', title: '수급 분석 > 1. 외국인 2년 누적' },
  { categoryCode: 'INVESTOR', itemCode: 'MAIN_3SUB_CUM', symbol: 'FOREIGNER,INDIVIDUAL,INSTITUTION,PENSION', title: '수급 분석 > 2. 외국인, 개인, 기관, 연기금 누적' },
  { categoryCode: 'INVESTOR', itemCode: 'INVESTOR_NET', symbol: 'ALL', title: '수급 분석 > 3. 주체별 순매수' },

  // 거시 경제
  { categoryCode: 'MACRO', itemCode: 'USDKRW', symbol: 'USDKRW', title: '거시 경제 > 원/달러 환율' },
  { categoryCode: 'MACRO', itemCode: 'US10Y', symbol: 'US10Y', title: '거시 경제 > 미국채 10년물 금리' },
  { categoryCode: 'MACRO', itemCode: 'KR_BOND_3Y', symbol: 'KR_BOND_3Y', title: '거시 경제 > 한국 국고채 3년물 금리' },
  { categoryCode: 'MACRO', itemCode: 'WTI', symbol: 'WTI', title: '거시 경제 > WTI 유가 선물' },

  // 시장 지수
  { categoryCode: 'MARKET', itemCode: 'KOSPI', symbol: 'KOSPI', title: '시장 지수 > 코스피' },
  { categoryCode: 'MARKET', itemCode: 'KOSDAQ', symbol: 'KOSDAQ', title: '시장 지수 > 코스닥' },
  { categoryCode: 'MARKET', itemCode: 'NASDAQ', symbol: '^IXIC', title: '시장 지수 > 나스닥' },
  { categoryCode: 'MARKET', itemCode: 'S&P500', symbol: '^GSPC', title: '시장 지수 > S&P500' },

  // 관심 종목
  { categoryCode: 'STOCK', itemCode: '005930', symbol: '005930', title: '관심 종목 > 삼성전자 (005930)' },
  { categoryCode: 'STOCK', itemCode: '000660', symbol: '000660', title: '관심 종목 > SK하이닉스 (000660)' },
  { categoryCode: 'STOCK', itemCode: '035420', symbol: '035420', title: '관심 종목 > NAVER (035420)' },
];

const ALL_INVESTOR_SUBJECTS: InvestorSubjectOption[] = [
  { key: 'foreigner_net', label: '외국인', color: '#F59E0B' },
  { key: 'institution_net', label: '기관', color: '#8B5CF6' },
  { key: 'individual_net', label: '개인', color: '#10B981' },
  { key: 'pension_fund_net', label: '연기금', color: '#EC4899' },
  { key: 'financial_investment_net', label: '금융투자', color: '#3B82F6' },
  { key: 'insurance_net', label: '보험', color: '#06B6D4' },
  { key: 'trust_net', label: '투신', color: '#84CC16' },
  { key: 'private_equity_fund_net', label: '사모펀드', color: '#F43F5E' },
];

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const [activeCategory, setActiveCategory] = useState<string>(
    () => localStorage.getItem('activeCategory') || 'INVESTOR'
  );
  const [activeItemCode, setActiveItemCode] = useState<string>(
    () => localStorage.getItem('activeItemCode') || 'FOREIGNER_2Y_CUM'
  );
  const [targetSymbol, setTargetSymbol] = useState<string>(
    () => localStorage.getItem('targetSymbol') || 'FOREIGNER'
  );

  // 외국인 2년 누적, 외국인/개인/연기금 누적은 주봉 고정
  const [periodType, setPeriodType] = useState<'D' | 'W'>(() => {
    const item = localStorage.getItem('activeItemCode') || 'FOREIGNER_2Y_CUM';
    return item === 'FOREIGNER_2Y_CUM' || item === 'MAIN_3SUB_CUM' ? 'W' : 'D';
  });

  const [startDate, setStartDate] = useState<string>(() => {
    const category = localStorage.getItem('activeCategory') || 'INVESTOR';
    const item = localStorage.getItem('activeItemCode') || 'FOREIGNER_2Y_CUM';
    if (item === 'INVESTOR_NET') {
      return dayjs().subtract(14, 'day').format('YYYYMMDD');
    }
    if (category === 'MACRO' || category === 'MARKET' || category === 'STOCK') {
      return dayjs().subtract(1, 'year').format('YYYYMMDD');
    }
    return dayjs().subtract(2, 'year').format('YYYYMMDD');
  });
  const [endDate, setEndDate] = useState(dayjs().format('YYYYMMDD'));

  // 수급 분석 주체 선택 필터 (3번 주체별 순매수용)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
    'foreigner_net',
    'institution_net',
    'individual_net',
  ]);

  // 차트 형태 스위처 (기본: 봉차트 'bar', 옵션: 라인차트 'line')
  const [macroChartType, setMacroChartType] = useState<'bar' | 'line'>('bar');
  const [marketChartType, setMarketChartType] = useState<'bar' | 'line'>('bar');
  const [stockChartType, setStockChartType] = useState<'bar' | 'line'>('bar');

  // Data states
  const [dailyInvestorData, setDailyInvestorData] = useState<InvestorNetDailyItem[]>([]);
  const [tableInvestorData, setTableInvestorData] = useState<InvestorNetDailyItem[]>([]);
  const [tablePage, setTablePage] = useState<number>(1);
  const [cumInvestorData, setCumInvestorData] = useState<InvestorNetCumulativeItem[]>([]);

  // 시계열 날짜/시간 포맷팅 헬퍼 (YYYYMMDD -> YYYY-MM-DD 또는 갱신 시각 표출)
  const formatUpdateTime = (item: any) => {
    if (!item) return '';
    const raw = item.sync_at || item.updated_at || item.date || item.dt || '';
    if (!raw) return '';
    const str = String(raw).trim();
    if (str.length === 8 && !str.includes('-') && !str.includes(':')) {
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }
    if (str.includes('T')) {
      const parts = str.split('T');
      return `${parts[0]} ${parts[1].slice(0, 5)}`;
    }
    if (str.length > 10) {
      return str.slice(0, 16);
    }
    return str;
  };

  // 실시간 동기화 주기 텍스트 변환 헬퍼
  const getSyncBadgeText = (category: string, itemCode: string) => {
    if (category === 'INVESTOR') {
      if (itemCode === 'INVESTOR_NET') {
        return '평일 10분 간격 (마감 확정 16시·18시·20시)';
      }
      return '평일 장마감 후 2년 누적 집계';
    }
    if (category === 'MARKET') {
      if (itemCode === 'NASDAQ' || itemCode === 'S&P500' || targetSymbol === '^IXIC' || targetSymbol === '^GSPC') {
        return '미국 장중 20분 간격 (한국 22:00~06:00)';
      }
      return '평일 15분 간격 (08:00~20:00)';
    }
    if (category === 'MACRO') {
      if (itemCode === 'USDKRW') return '평일 15분 간격';
      if (itemCode === 'WTI') return '평일 30분 간격';
      if (itemCode === 'KR_BOND_3Y' || itemCode === 'KR3Y') return '평일 30분 간격 (09:00~16:00)';
      if (itemCode === 'US10Y') return '평일 10분 간격 수집';
      return '평일 정기 수집';
    }
    if (category === 'STOCK') {
      return '평일 15분 간격 (08:00~20:00)';
    }
    return '실시간 갱신';
  };
  const [indexData, setIndexData] = useState<MarketIndexCandle[]>([]);
  const [macroData, setMacroData] = useState<MacroIndicatorItem[]>([]);
  const [trackedStocks, setTrackedStocksList] = useState<TrackedStock[]>([]);
  const [stockCandles, setStockCandles] = useState<StockCandle[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // 날짜 변환 헬퍼 (YYYY-MM-DD <-> YYYYMMDD)
  const toApiDate = (d: string) => d.replace(/-/g, '');
  const toInputDate = (d: string) => (d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d);

  // 거시 경제 단위 포맷팅 헬퍼
  const formatMacroTooltip = (val: number, symbol: string) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    if (symbol === 'USDKRW') {
      return `${Number(val).toLocaleString()} 원`;
    } else if (symbol === 'US10Y' || symbol === 'KR_BOND_3Y' || symbol === 'KR3Y') {
      return `${Number(val)} %`;
    } else if (symbol === 'WTI') {
      return `$ ${Number(val)} / bbl`;
    }
    return `${Number(val).toLocaleString()}`;
  };


  // 화폐 수급 단위 (1조 이상 '조', 1억 이상 '억' 포맷팅 헬퍼)
  const formatYAxisCurrency = (val: number): string => {
    if (val === 0 || val === undefined || val === null) return '0';
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';

    if (absVal >= 1e12) {
      return `${sign}${(absVal / 1e12).toFixed(1)}조`;
    } else if (absVal >= 1e8) {
      return `${sign}${(absVal / 1e8).toFixed(0)}억`;
    }
    return `${sign}${val}`;
  };

  const formatTooltipCurrency = (val: number): string => {
    if (val === 0 || val === undefined || val === null) return '0원';
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';

    if (absVal >= 1e12) {
      return `${sign}${(absVal / 1e12).toFixed(2)} 조원`;
    } else if (absVal >= 1e8) {
      return `${sign}${(absVal / 1e8).toLocaleString()} 억원`;
    } else if (absVal >= 1e4) {
      return `${sign}${(absVal / 1e4).toLocaleString()} 만원`;
    }
    return `${sign}${val.toLocaleString()}원`;
  };

  // Fetch data based on activeCategory and activeItemCode
  const fetchData = async () => {
    if (activeCategory === 'HOME') return;

    // 주체별 순매수(INVESTOR_NET)일 경우만 1달(31일) 제한 검증
    if (activeCategory === 'INVESTOR' && activeItemCode === 'INVESTOR_NET') {
      const s = dayjs(toInputDate(startDate));
      const e = dayjs(toInputDate(endDate));
      if (e.diff(s, 'day') > 31) {
        alert('주체별 순매수 분석은 최대 1달(31일)까지만 조회 가능합니다. 1달 이내로 기간을 조정합니다.');
        setStartDate(e.subtract(1, 'month').format('YYYYMMDD'));
        return;
      }
    }

    setLoading(true);
    try {
      if (activeCategory === 'INVESTOR') {
        if (activeItemCode === 'INVESTOR_NET') {
          const data = await getInvestorNet(startDate, endDate, 'KOSPI', 'ALL', periodType);
          setDailyInvestorData(data);

          // 상단 기간 선택 버튼(1D, 3D, 7D, 1M)과 독립된 테이블 전용 데이터 (최근 6개월 일별 데이터)
          const tableStart = dayjs().subtract(6, 'month').format('YYYYMMDD');
          const fullTableData = await getInvestorNet(tableStart, endDate, 'KOSPI', 'ALL', 'D');
          setTableInvestorData(fullTableData);
        } else {
          // FOREIGNER_2Y_CUM & MAIN_3SUB_CUM (2년 누적 데이터)
          const data = await getInvestorNetCumulative(startDate, endDate, 'KOSPI');
          setCumInvestorData(data);
        }
      } else if (activeCategory === 'MARKET') {
        const symbolCode = targetSymbol || activeItemCode;
        // 보조지표(200이평 등)가 시작일 첫 캔들부터 선명하게 연결되도록 조회 시작일 + 1년 전 데이터를 추가 요청
        const fetchStart = dayjs(toInputDate(startDate)).subtract(1, 'year').format('YYYYMMDD');
        const data = await getIndexCandles(fetchStart, endDate, symbolCode, periodType);
        setIndexData(data);
      } else if (activeCategory === 'MACRO') {
        const symbolCode = targetSymbol || activeItemCode;
        // 보조지표(200이평 등)가 시작일 첫 캔들부터 선명하게 연결되도록 조회 시작일 + 1년 전 데이터를 추가 요청
        const fetchStart = dayjs(toInputDate(startDate)).subtract(1, 'year').format('YYYYMMDD');
        const data = await getMacroIndicators(fetchStart, endDate, symbolCode, periodType);
        setMacroData(data);
      } else if (activeCategory === 'STOCK') {
        const stocks = await getTrackedStocks();
        setTrackedStocksList(stocks);

        // 관심종목 기본값은 가장 앞에 있는 데이터(stocks[0])
        let code = targetSymbol || activeItemCode;
        if (stocks.length > 0 && (!code || !stocks.some((s) => s.stock_code === code))) {
          code = stocks[0].stock_code;
          setActiveItemCode(code);
          setTargetSymbol(code);
        }

        if (code) {
          // 보조지표(200이평 등)가 시작일 첫 캔들부터 선명하게 연결되도록 조회 시작일 + 1년 전 데이터를 추가 요청
          const fetchStart = dayjs(toInputDate(startDate)).subtract(1, 'year').format('YYYYMMDD');
          const candles = await getStockCandles(fetchStart, endDate, code, periodType);
          setStockCandles(candles);
        }
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeCategory, activeItemCode, targetSymbol, periodType, startDate, endDate]);

  const handleSelectMenuItem = (categoryCode: string, itemCode: string, symbol?: string) => {
    const nextSymbol = symbol || itemCode;
    setActiveCategory(categoryCode);
    setActiveItemCode(itemCode);
    setTargetSymbol(nextSymbol);

    // 새로고침 대비 선택 메뉴 localStorage에 상태 저장
    localStorage.setItem('activeCategory', categoryCode);
    localStorage.setItem('activeItemCode', itemCode);
    localStorage.setItem('targetSymbol', nextSymbol);

    // 1번 및 2번 누적 메뉴는 주봉(W) 고정 및 2년 설정, 그 외 일반 페이지 이동 시 일봉('D')이 기본값
    if (itemCode === 'FOREIGNER_2Y_CUM' || itemCode === 'MAIN_3SUB_CUM') {
      setPeriodType('W');
      setStartDate(dayjs().subtract(2, 'year').format('YYYYMMDD'));
    } else {
      setPeriodType('D');
      if (itemCode === 'INVESTOR_NET') {
        // 주체별 순매수 기본 2주 (14일) 설정
        setStartDate(dayjs().subtract(14, 'day').format('YYYYMMDD'));
      } else if (categoryCode === 'MACRO' || categoryCode === 'MARKET' || categoryCode === 'STOCK') {
        // 거시 경제, 시장 지수, 관심 종목 기본 1년 설정 (2년 캔들밀림 보정)
        setStartDate(dayjs().subtract(1, 'year').format('YYYYMMDD'));
      }
    }
  };

  const handleQuickPeriodSelect = (amount: number, unit: 'month' | 'year' | 'day') => {
    const today = dayjs().format('YYYYMMDD');
    const past = dayjs().subtract(amount, unit).format('YYYYMMDD');
    setEndDate(today);
    setStartDate(past);
  };

  const toggleSubject = (subjectKey: string) => {
    if (selectedSubjects.includes(subjectKey)) {
      if (selectedSubjects.length === 1) {
        alert('최소 1개 이상의 수급 주체를 선택해야 합니다.');
        return;
      }
      setSelectedSubjects(selectedSubjects.filter((k) => k !== subjectKey));
    } else {
      setSelectedSubjects([...selectedSubjects, subjectKey]);
    }
  };

  const isFixedWeekly = activeItemCode === 'FOREIGNER_2Y_CUM' || activeItemCode === 'MAIN_3SUB_CUM';

  // 전체 메뉴 순서 인덱스 탐색 및 이전/다음 버튼 정보 계산
  const currentIndex = ORDERED_MENU_ITEMS.findIndex(
    (item) => item.categoryCode === activeCategory && item.itemCode === activeItemCode
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < ORDERED_MENU_ITEMS.length - 1;

  const prevItem = hasPrev ? ORDERED_MENU_ITEMS[currentIndex - 1] : null;
  const nextItem = hasNext ? ORDERED_MENU_ITEMS[currentIndex + 1] : null;

  // 거시 경제 OHLC 캔들 데이터 가공 (전일 종가 기반 시가/고가/저가/종가 및 양봉/음봉 보정)
  const processedMacroData = macroData.map((d, i) => {
    const prevClose = i > 0 ? (macroData[i - 1].close ?? macroData[i - 1].value) : d.value;
    const open = d.open != null ? d.open : prevClose;
    const close = d.close != null ? d.close : d.value;
    const high = d.high != null ? d.high : Math.max(open, close);
    const low = d.low != null ? d.low : Math.min(open, close);
    return {
      ...d,
      open,
      high,
      low,
      close,
    };
  });

  // 시장 지수 OHLC 캔들 데이터 가공 (전일 종가 기반 시가/고가/저가/종가 보정)
  const processedIndexData = indexData.map((d, i) => {
    const prevClose = i > 0 ? (indexData[i - 1].close ?? 0) : (d.close ?? d.open ?? 0);
    const open = d.open != null ? d.open : prevClose;
    const close = d.close != null ? d.close : open;
    const high = d.high != null ? d.high : Math.max(open, close);
    const low = d.low != null ? d.low : Math.min(open, close);
    return {
      ...d,
      open,
      high,
      low,
      close,
      value: close,
    };
  });

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans">
      {/* 상단 R's Indicator Tracker 로고 헤더 (라이트/다크 테마 토글 연동) */}
      <Header theme={theme} onToggleTheme={toggleTheme} />

      {/* 전체 페이지 레이아웃 */}
      <div className="flex flex-1">
        {/* 좌측 사이드바 메뉴 */}
        <Sidebar
          activeCategory={activeCategory}
          activeItemCode={activeItemCode}
          onSelectMenuItem={handleSelectMenuItem}
        />

        {/* 우측 메인 컨텐츠 영역 */}
        <main className="flex-1 flex flex-col p-6 overflow-y-auto">
          {activeCategory === 'HOME' ? (
            /* HOME 탭 */
            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[500px]">
              <div className="absolute w-[450px] h-[450px] bg-gradient-to-tr from-rose-500/20 via-amber-500/20 to-indigo-600/20 rounded-full blur-3xl -z-10 pointer-events-none animate-pulse"></div>

              <div className="glass-card max-w-lg w-full p-10 rounded-3xl border border-slate-800 text-center shadow-2xl space-y-8">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
                  <TrendingUp className="w-9 h-9 text-white" />
                </div>

                <div className="space-y-3">
                  <h1 className="text-4xl font-extrabold text-white tracking-tight font-outfit">
                    지표추적자 (HOME)
                  </h1>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    주체별 수급 현황, 4대 시장 지수, 거시경제 금리 및 관심 종목을 실시간으로 추적합니다.
                  </p>
                </div>

                <div>
                  <button
                    onClick={() => handleSelectMenuItem('INVESTOR', 'FOREIGNER_2Y_CUM', 'FOREIGNER')}
                    className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white font-bold text-base rounded-2xl shadow-xl shadow-rose-500/20 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition duration-200"
                  >
                    시작하기 (1번 외국인 2년 누적 이동)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* 지표 분석 대시보드 화면 (가로 폭 20% 확대 max-w-[1536px] & 박스 상단 밀착, 화살표 차트 중앙 라인 정렬) */
            <div className="flex items-start justify-center gap-4 w-full max-w-[1536px] mx-auto">
              {/* 좌측 이전 커서 버튼 전용 고정 슬롯 (차트 그래프 박스 중앙 위치 정렬 mt-[390px]) */}
              <div className="w-12 shrink-0 mt-[390px] flex justify-center z-20">
                {hasPrev ? (
                  <button
                    onClick={() => prevItem && handleSelectMenuItem(prevItem.categoryCode, prevItem.itemCode, prevItem.symbol)}
                    className="w-12 h-12 rounded-2xl bg-slate-900/90 hover:bg-amber-500/20 hover:border-amber-500/50 border border-slate-700/80 text-slate-300 hover:text-amber-300 shadow-2xl backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer z-10"
                    title={`이전 지표: ${prevItem?.title}`}
                  >
                    <ChevronLeft className="w-6 h-6 text-amber-400" />
                  </button>
                ) : null}
              </div>

              <div className="space-y-6 flex-1 min-w-0">
              {/* Top Controls Bar */}
              <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-2xl border border-slate-700/80 shadow-xl shadow-slate-950/40">
                <div className="flex items-center space-x-3 text-sm font-semibold text-white">
                  {activeCategory === 'INVESTOR' && <Briefcase className="w-5 h-5 text-rose-400" />}
                  {activeCategory === 'MARKET' && <Activity className="w-5 h-5 text-amber-400" />}
                  {activeCategory === 'MACRO' && <Globe className="w-5 h-5 text-emerald-400" />}
                  {activeCategory === 'STOCK' && <Layers className="w-5 h-5 text-indigo-400" />}
                  <span className="font-outfit">
                    {activeItemCode === 'FOREIGNER_2Y_CUM' && '수급 분석 > 1. 외국인 2년 누적 (주봉 고정)'}
                    {activeItemCode === 'MAIN_3SUB_CUM' && '수급 분석 > 2. 외국인, 개인, 기관, 연기금 누적 (주봉 고정)'}
                    {activeItemCode === 'INVESTOR_NET' && '수급 분석 > 3. 주체별 순매수'}
                    {activeCategory === 'MARKET' && `시장 지수 > ${activeItemCode} (${targetSymbol})`}
                    {activeCategory === 'MACRO' && `거시 경제 > ${activeItemCode} (${targetSymbol})`}
                    {activeCategory === 'STOCK' && `관심 종목 > ${activeItemCode}`}
                  </span>
                </div>

                <div className="flex items-center space-x-4">
                  {/* 달력 조회 기간 피커 & 원터치 퀵 기간 선택 버튼 (1달, 3달, 6달, 1년, 2년) */}
                  <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800">
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-medium">기간:</span>
                    <input
                      type="date"
                      disabled={isFixedWeekly}
                      value={toInputDate(startDate)}
                      onChange={(e) => setStartDate(toApiDate(e.target.value))}
                      className={`bg-slate-900 text-slate-100 text-xs px-2.5 py-1 rounded-lg border border-slate-700 font-mono focus:outline-none focus:border-amber-400 ${
                        isFixedWeekly ? 'opacity-50 cursor-not-allowed bg-slate-950/50' : 'cursor-pointer'
                      }`}
                    />
                    <span className="text-slate-600">~</span>
                    <input
                      type="date"
                      disabled={isFixedWeekly}
                      value={toInputDate(endDate)}
                      onChange={(e) => setEndDate(toApiDate(e.target.value))}
                      className={`bg-slate-900 text-slate-100 text-xs px-2.5 py-1 rounded-lg border border-slate-700 font-mono focus:outline-none focus:border-amber-400 ${
                        isFixedWeekly ? 'opacity-50 cursor-not-allowed bg-slate-950/50' : 'cursor-pointer'
                      }`}
                    />
                    {isFixedWeekly ? (
                      <span className="text-[10px] text-amber-400 font-semibold px-1.5 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                        2년 고정
                      </span>
                    ) : (
                      /* 원터치 퀵 기간 선택 버튼 그룹 (주체별 순매수는 1일/3일/7일/1달, 그 외 1달/3달/6달/1년/2년) */
                      <div className="flex items-center space-x-1 pl-2 border-l border-slate-800 ml-1">
                        {(activeItemCode === 'INVESTOR_NET'
                          ? [
                              { label: '1일', amount: 1, unit: 'day' },
                              { label: '3일', amount: 3, unit: 'day' },
                              { label: '7일', amount: 7, unit: 'day' },
                              { label: '1달', amount: 1, unit: 'month' },
                            ]
                          : [
                              { label: '1달', amount: 1, unit: 'month' },
                              { label: '3달', amount: 3, unit: 'month' },
                              { label: '6달', amount: 6, unit: 'month' },
                              { label: '1년', amount: 1, unit: 'year' },
                              { label: '2년', amount: 2, unit: 'year' },
                            ]
                        ).map((preset) => {
                          const targetStart = dayjs().subtract(preset.amount, preset.unit as any).format('YYYYMMDD');
                          const todayEnd = dayjs().format('YYYYMMDD');
                          const isActive = startDate === targetStart && endDate === todayEnd;

                          return (
                            <button
                              key={preset.label}
                              onClick={() => handleQuickPeriodSelect(preset.amount, preset.unit as any)}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                                isActive
                                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 모던 슬라이딩 On/Off 스타일 일/주봉 스위치 */}
                  {isFixedWeekly ? (
                    <div className="px-4 py-2 rounded-full bg-slate-950/90 border border-amber-500/40 text-amber-400 text-xs font-bold shadow-inner flex items-center gap-1.5">
                      <span>주봉 고정</span>
                    </div>
                  ) : (
                    <div
                      onClick={() => setPeriodType((prev) => (prev === 'D' ? 'W' : 'D'))}
                      className="w-28 h-9 rounded-full bg-slate-950 border border-slate-700/80 p-1 flex items-center justify-between relative cursor-pointer select-none shadow-inner"
                      title="클릭하여 일봉/주봉 스위치 전환"
                    >
                      <span className={`text-xs font-bold z-10 w-12 text-center transition ${periodType === 'D' ? 'text-slate-950 font-extrabold' : 'text-slate-400'}`}>
                        일봉
                      </span>
                      <span className={`text-xs font-bold z-10 w-12 text-center transition ${periodType === 'W' ? 'text-slate-950 font-extrabold' : 'text-slate-400'}`}>
                        주봉
                      </span>
                      <div
                        className={`absolute h-7 w-12 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 shadow-md transition-all duration-300 ease-in-out ${
                          periodType === 'D' ? 'left-1' : 'left-[54px]'
                        }`}
                      ></div>
                    </div>
                  )}

                  <button
                    onClick={fetchData}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition border border-slate-800"
                    title="새로고침"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mb-3" />
                  <p className="text-sm">데이터를 가져오는 중입니다...</p>
                </div>
              ) : (
                <>
                  {/* 1. 수급 분석: 1. 외국인 2년 누적 (주봉 고정, 0 기준선 추가, 상시 최신 데이터 카드) */}
                  {activeCategory === 'INVESTOR' && activeItemCode === 'FOREIGNER_2Y_CUM' && (
                    <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-700/80 shadow-xl shadow-slate-950/60 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                              <Briefcase className="w-5 h-5 text-rose-400" />
                              1. 외국인 2년 누적 순매수 추이 (KOSPI - 주봉 고정)
                            </h3>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 light:bg-amber-500/15 text-amber-300 light:text-amber-800 border border-amber-500/20 light:border-amber-500/40 shadow-sm">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span>Sync: {getSyncBadgeText(activeCategory, activeItemCode)}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            2년 전 첫 거래일(cum_net = 0) 기준 주봉 외국인 누적 수급 데이터입니다.
                          </p>
                        </div>
                      </div>

                      {/* 상시 최신 외국인 2년 누적 데이터 요약 카드 (전일, 오늘 누적 수급 및 변동폭 표출) */}
                      {cumInvestorData.length > 0 && (() => {
                        const latest = cumInvestorData[cumInvestorData.length - 1];
                        const prev = cumInvestorData.length > 1 ? cumInvestorData[cumInvestorData.length - 2] : null;
                        const prevVal = prev ? prev.foreigner_cum_net : latest.foreigner_cum_net;
                        const latestVal = latest.foreigner_cum_net;
                        const diff = latestVal - prevVal;
                        const diffPct = prevVal ? (diff / Math.abs(prevVal)) * 100 : 0;
                        const isPos = diff >= 0;

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800 font-sans">
                            {/* 전일 누적 */}
                            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <span className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                                <span>전일 누적 수급</span>
                                <span className="font-mono text-[10px] text-slate-500">{prev ? prev.dt : '-'}</span>
                              </span>
                              <span className={`text-base sm:text-lg font-bold font-outfit mt-1 ${prevVal >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                                {formatTooltipCurrency(prevVal)}
                              </span>
                            </div>

                            {/* 오늘 / 최근 누적 */}
                            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <span className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                                <span>오늘 / 최근 누적 수급</span>
                                <span className="font-mono text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">{formatUpdateTime(latest)}</span>
                              </span>
                              <div className="flex items-baseline space-x-2 mt-1 font-mono">
                                <span className={`text-base sm:text-lg font-extrabold font-outfit ${latestVal >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                                  {formatTooltipCurrency(latestVal)}
                                </span>
                                <span className="text-[11px] font-normal text-slate-400 font-sans">({formatUpdateTime(latest)})</span>
                              </div>
                            </div>

                            {/* 전일 대비 변동폭 */}
                            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <span className="text-[11px] text-slate-400 font-semibold">전일 대비 변동폭</span>
                              <div className="flex items-center space-x-2 mt-1 font-mono">
                                <span className={`text-base font-extrabold ${isPos ? 'text-rose-400' : 'text-blue-400'}`}>
                                  {isPos ? '▲' : '▼'} {formatTooltipCurrency(diff)}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isPos ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                  {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="h-[640px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={cumInvestorData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="dt" stroke="#94A3B8" fontSize={12} />
                            <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={formatYAxisCurrency} />
                            <Tooltip
                              cursor={false}
                              contentStyle={{
                                backgroundColor: theme === 'light' ? '#FFFFFF' : '#1E293B',
                                borderColor: theme === 'light' ? '#CBD5E1' : '#475569',
                                color: theme === 'light' ? '#0F172A' : '#F8FAFC',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                              }}
                              itemStyle={{ color: theme === 'light' ? '#0F172A' : '#F8FAFC' }}
                              labelStyle={{ color: theme === 'light' ? '#0F172A' : '#F8FAFC', fontWeight: 'bold' }}
                              formatter={(val: any, name: any) => [formatTooltipCurrency(Number(val)), String(name).replace(/\s*누적/g, '')]}
                            />
                            <Legend />
                            {/* 0 기준선 (수급 0선 표출) */}
                            <ReferenceLine y={0} stroke="#64748B" strokeDasharray="3 3" strokeWidth={1.5} />
                            <Line type="monotone" dataKey="foreigner_cum_net" name="외국인" stroke="#F59E0B" strokeWidth={3} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* 2. 수급 분석: 2. 외국인, 개인, 기관, 연기금 누적 (주봉 고정, 0 기준선 추가, 상시 최신 데이터 카드) */}
                  {activeCategory === 'INVESTOR' && activeItemCode === 'MAIN_3SUB_CUM' && (
                    <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-700/80 shadow-xl shadow-slate-950/60 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                              <Briefcase className="w-5 h-5 text-rose-400" />
                              2. 외국인, 개인, 기관, 연기금 2년 누적 순매수 추이 (KOSPI - 주봉 고정)
                            </h3>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 light:bg-amber-500/15 text-amber-300 light:text-amber-800 border border-amber-500/20 light:border-amber-500/40 shadow-sm">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span>Sync: {getSyncBadgeText(activeCategory, activeItemCode)}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            외국인, 개인, 기관, 연기금 4대 핵심 주체의 2년 누적 수급 흐름 비교 그래프입니다.
                          </p>
                        </div>
                      </div>

                      {/* 상시 최신 4대 주체 누적 데이터 요약 카드 리스트 (전일 누적, 오늘 누적 및 변동폭 표출) */}
                      {cumInvestorData.length > 0 && (() => {
                        const latest = cumInvestorData[cumInvestorData.length - 1];
                        const prev = cumInvestorData.length > 1 ? cumInvestorData[cumInvestorData.length - 2] : null;

                        const subjects = [
                          { name: '외국인', key: 'foreigner_cum_net', color: '#F59E0B', textCol: 'text-amber-400' },
                          { name: '개인', key: 'individual_cum_net', color: '#10B981', textCol: 'text-emerald-400' },
                          { name: '기관', key: 'institution_cum_net', color: '#8B5CF6', textCol: 'text-purple-400' },
                          { name: '연기금', key: 'pension_fund_cum_net', color: '#EC4899', textCol: 'text-rose-400' },
                        ];

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {subjects.map((s) => {
                              const prevVal = prev ? (prev as any)[s.key] ?? 0 : 0;
                              const latestVal = (latest as any)[s.key] ?? 0;
                              const diff = latestVal - prevVal;
                              const isPos = diff >= 0;

                              return (
                                <div key={s.key} className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }}></span>
                                      {s.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">{latest.dt}</span>
                                  </div>

                                  <div className="space-y-1 font-mono text-xs">
                                    <div className="flex items-center justify-between text-slate-400">
                                      <span>전일:</span>
                                      <span className="font-semibold text-slate-300">{formatTooltipCurrency(prevVal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-400">오늘:</span>
                                      <span className={`font-extrabold ${latestVal >= 0 ? s.textCol : 'text-blue-400'}`}>
                                        {formatTooltipCurrency(latestVal)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                                      <span className="text-slate-400 text-[11px]">변동폭:</span>
                                      <div className="flex items-center gap-1">
                                        <span className={`font-extrabold text-[11px] ${isPos ? 'text-rose-400' : 'text-blue-400'}`}>
                                          {isPos ? '▲' : '▼'} {formatTooltipCurrency(diff)}
                                        </span>
                                        {prevVal !== 0 && (
                                          <span className={`text-[10px] font-bold ${isPos ? 'text-rose-400' : 'text-blue-400'}`}>
                                            ({((diff / Math.abs(prevVal)) * 100) >= 0 ? '+' : ''}{((diff / Math.abs(prevVal)) * 100).toFixed(1)}%)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      <div className="h-[640px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={cumInvestorData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="dt" stroke="#94A3B8" fontSize={12} />
                            <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={formatYAxisCurrency} />
                            <Tooltip
                              cursor={false}
                              contentStyle={{
                                backgroundColor: theme === 'light' ? '#FFFFFF' : '#1E293B',
                                borderColor: theme === 'light' ? '#CBD5E1' : '#475569',
                                color: theme === 'light' ? '#0F172A' : '#F8FAFC',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                              }}
                              itemStyle={{ color: theme === 'light' ? '#0F172A' : '#F8FAFC' }}
                              labelStyle={{ color: theme === 'light' ? '#0F172A' : '#F8FAFC', fontWeight: 'bold' }}
                              formatter={(val: any, name: any) => [formatTooltipCurrency(Number(val)), String(name).replace(/\s*누적/g, '')]}
                            />
                            <Legend />
                            {/* 0 기준선 (수급 0선 표출) */}
                            <ReferenceLine y={0} stroke="#64748B" strokeDasharray="3 3" strokeWidth={1.5} />
                            <Line type="monotone" dataKey="foreigner_cum_net" name="외국인" stroke="#F59E0B" strokeWidth={2.5} dot={false} />
                            <Line type="monotone" dataKey="individual_cum_net" name="개인" stroke="#10B981" strokeWidth={2.5} dot={false} />
                            <Line type="monotone" dataKey="institution_cum_net" name="기관" stroke="#8B5CF6" strokeWidth={2.5} dot={false} />
                            <Line type="monotone" dataKey="pension_fund_cum_net" name="연기금" stroke="#EC4899" strokeWidth={2.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* 3. 수급 분석: 3. 주체별 순매수 */}
                  {activeCategory === 'INVESTOR' && activeItemCode === 'INVESTOR_NET' && (
                    <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-700/80 shadow-xl shadow-slate-950/60 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-rose-400" />
                            3. 주체별 순매수 (최근 2주 기본, 최대 1달)
                          </h3>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 light:bg-amber-500/15 text-amber-300 light:text-amber-800 border border-amber-500/20 light:border-amber-500/40 shadow-sm">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Sync: {getSyncBadgeText(activeCategory, activeItemCode)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 주체 선택 필터 버튼 옵션 */}

                      {/* 주체 선택 필터 버튼 옵션 */}
                      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400 font-semibold mr-1 flex items-center gap-1">
                          <Filter className="w-3.5 h-3.5 text-amber-400" /> 조회 주체 선택:
                        </span>
                        {ALL_INVESTOR_SUBJECTS.map((sub) => {
                          const isSelected = selectedSubjects.includes(sub.key);
                          return (
                            <button
                              key={sub.key}
                              onClick={() => toggleSubject(sub.key)}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition border flex items-center space-x-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500/20 light:bg-amber-500/20 text-amber-300 light:text-amber-800 border-amber-500/50 shadow-md font-bold'
                                  : 'bg-slate-950/40 light:bg-slate-100 text-slate-500 light:text-slate-600 border-slate-800/80 light:border-slate-300 hover:text-slate-300 light:hover:text-slate-900'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                style={{ backgroundColor: isSelected ? sub.color : '#475569' }}
                              ></span>
                              <span>{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>


                      {/* 상시 최신 거래일 주체별 순매수 데이터 요약 카드 리스트 (슬림 컴팩트 디자인 - 높이 축소로 그래프 밀림 완벽 방지) */}
                      {dailyInvestorData.length > 0 && (() => {
                        const latest = dailyInvestorData[dailyInvestorData.length - 1];
                        const activeSubjects = ALL_INVESTOR_SUBJECTS.filter((sub) => selectedSubjects.includes(sub.key));
                        const count = activeSubjects.length;

                        // 주체 수에 따라 그리드 컬럼 수 최적화 (4개 이하 4열, 5개 이상 6~8열로 1줄에 밀집 배치)
                        const gridColsClass =
                          count <= 4
                            ? 'grid-cols-2 sm:grid-cols-4'
                            : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8';

                        return (
                          <div className="space-y-1.5 pt-0.5">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[11px] font-semibold text-slate-400">
                                최근 거래일 (<span className="text-amber-400 font-mono font-bold">{latest.dt}</span>) 주체별 순매수:
                              </span>
                            </div>

                            <div className={`grid ${gridColsClass} gap-1.5`}>
                              {activeSubjects.map((sub) => {
                                const val = (latest as any)[sub.key] ?? 0;
                                const isPos = val >= 0;
                                return (
                                  <div
                                    key={sub.key}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center justify-between shadow-inner"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 truncate mb-0.5">
                                        <span
                                          className="w-2 h-2 rounded-full inline-block shrink-0"
                                          style={{ backgroundColor: sub.color }}
                                        ></span>{' '}
                                        {sub.label}
                                      </span>
                                      <span
                                        className={`text-xs sm:text-sm font-extrabold font-outfit block truncate ${
                                          isPos ? 'text-rose-400' : 'text-blue-400'
                                        }`}
                                      >
                                        {formatTooltipCurrency(val)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="h-[640px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyInvestorData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="dt" stroke="#94A3B8" fontSize={12} />
                            <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={formatYAxisCurrency} />
                            <Tooltip
                              cursor={false}
                              contentStyle={{
                                backgroundColor: theme === 'light' ? '#FFFFFF' : '#1E293B',
                                borderColor: theme === 'light' ? '#CBD5E1' : '#475569',
                                color: theme === 'light' ? '#0F172A' : '#F8FAFC',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                              }}
                              itemStyle={{ color: theme === 'light' ? '#0F172A' : '#F8FAFC' }}
                              labelStyle={{ color: theme === 'light' ? '#0F172A' : '#F8FAFC', fontWeight: 'bold' }}
                              formatter={(val: any, name: any) => [formatTooltipCurrency(Number(val)), String(name).replace(/\s*누적/g, '')]}
                            />
                            <Legend />
                            <ReferenceLine y={0} stroke="#64748B" strokeDasharray="3 3" strokeWidth={1.5} />
                            {ALL_INVESTOR_SUBJECTS.filter((sub) => selectedSubjects.includes(sub.key)).map((sub) => (
                              <Bar
                                key={sub.key}
                                dataKey={sub.key}
                                name={sub.label}
                                fill={sub.color}
                                radius={[4, 4, 0, 0]}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* 독립 5일 단위 페이징 주체별 순매수 상세 수치 데이터 표 */}
                      {tableInvestorData.length > 0 && (() => {
                        // 최신 날짜가 맨 위에 오도록 역순 정렬
                        const sortedData = [...tableInvestorData].reverse();
                        const pageSize = 5;
                        const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
                        const currentPage = Math.min(Math.max(1, tablePage), totalPages);
                        const startIdx = (currentPage - 1) * pageSize;
                        const pageRows = sortedData.slice(startIdx, startIdx + pageSize);

                        return (
                          <div className="bg-slate-950/90 rounded-xl p-4 border border-slate-800 space-y-3 font-sans mt-4">
                            {/* 헤더 & 페이징 버튼 바 */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                              <div>
                                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                  <TableIcon className="w-4 h-4 text-amber-400" />
                                  일별 주체별 순매수 상세 표 (5일 단위 페이징)
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  상단 기간 버튼과 독립적으로 최근 6개월 일별 순매수 수치를 5일 단위로 조회합니다.
                                </p>
                              </div>

                              {/* 페이징 내비게이션 컨트롤 */}
                              <div className="flex items-center space-x-2">
                                <button
                                  disabled={currentPage >= totalPages}
                                  onClick={() => setTablePage(currentPage + 1)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                    currentPage < totalPages
                                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                                      : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                                  }`}
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" /> 이전 5일
                                </button>

                                <span className="text-xs font-mono text-amber-300 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                  {currentPage} / {totalPages} 페이지 ({pageRows[pageRows.length - 1]?.dt} ~ {pageRows[0]?.dt})
                                </span>

                                <button
                                  disabled={currentPage <= 1}
                                  onClick={() => setTablePage(currentPage - 1)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                    currentPage > 1
                                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                                      : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                                  }`}
                                >
                                  다음 5일 <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* 5일치 순매수 데이터 테이블 (가로 스크롤 지원) */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs font-mono border-collapse">
                                <thead>
                                  <tr className="bg-slate-900/90 text-slate-400 text-[11px] border-b border-slate-800">
                                    <th className="py-2.5 px-3 text-left font-semibold">날짜 (dt)</th>
                                    <th className="py-2.5 px-2 text-right font-semibold text-amber-400">외국인</th>
                                    <th className="py-2.5 px-2 text-right font-semibold text-emerald-400">개인</th>
                                    <th className="py-2.5 px-2 text-right font-semibold text-purple-400">기관합계</th>
                                    <th className="py-2.5 px-2 text-right font-semibold text-cyan-400">금융투자</th>
                                    <th className="py-2.5 px-2 text-right font-semibold text-teal-400">투신</th>
                                    <th className="py-2.5 px-2 text-right font-semibold text-indigo-400">사모</th>
                                    <th className="py-2.5 px-2 text-right font-semibold text-sky-400">은행</th>
                                    <th className="py-2.5 px-2 text-right font-semibold text-pink-400">보험</th>
                                    <th className="py-2.5 px-2 text-right font-semibold text-slate-300">기타금융</th>
                                    <th className="py-2.5 px-2 text-right font-semibold text-rose-400">연기금</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                  {pageRows.map((row) => {
                                    const cols = [
                                      { key: 'foreigner_net', val: row.foreigner_net ?? row.foreigner_net_buy ?? 0 },
                                      { key: 'individual_net', val: row.individual_net ?? row.individual_net_buy ?? 0 },
                                      { key: 'institution_net', val: row.institution_net ?? row.institution_net_buy ?? 0 },
                                      { key: 'financial_investment_net', val: row.financial_investment_net ?? row.financial_investment_net_buy ?? 0 },
                                      { key: 'trust_net', val: row.trust_net ?? row.trust_net_buy ?? 0 },
                                      { key: 'private_equity_fund_net', val: row.private_equity_fund_net ?? row.private_equity_fund_net_buy ?? 0 },
                                      { key: 'bank_net', val: row.bank_net ?? row.bank_net_buy ?? 0 },
                                      { key: 'insurance_net', val: row.insurance_net ?? row.insurance_net_buy ?? 0 },
                                      { key: 'other_financial_institution_net', val: row.other_financial_institution_net ?? row.other_financial_institution_net_buy ?? 0 },
                                      { key: 'pension_fund_net', val: row.pension_fund_net ?? row.pension_fund_net_buy ?? 0 },
                                    ];

                                    return (
                                      <tr key={row.dt} className="hover:bg-slate-900/60 transition">
                                        <td className="py-2 px-3 text-left font-bold text-slate-200">{row.dt}</td>
                                        {cols.map((col, idx) => {
                                          const isPos = col.val > 0;
                                          const isNeg = col.val < 0;
                                          const textClass = isPos
                                            ? 'text-rose-400 font-bold'
                                            : isNeg
                                            ? 'text-blue-400 font-bold'
                                            : 'text-slate-500';

                                          return (
                                            <td key={idx} className={`py-2 px-2 text-right ${textClass}`}>
                                              {formatTooltipCurrency(col.val)}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* 2. 시장 지수 (봉차트 기본, 옵션 라인차트 선택 기능 지원, 3대 보조지표 및 상시 최신 데이터 요약 카드 연동) */}
                  {activeCategory === 'MARKET' && (
                    <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-700/80 shadow-xl shadow-slate-950/60 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-amber-400" />
                            시장 지수 {activeItemCode} ({targetSymbol}) 시계열 ({periodType === 'D' ? '일봉' : '주봉'})
                          </h3>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 light:bg-amber-500/15 text-amber-300 light:text-amber-800 border border-amber-500/20 light:border-amber-500/40 shadow-sm">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Sync: {getSyncBadgeText(activeCategory, activeItemCode)}</span>
                          </div>
                        </div>

                        {/* 봉차트 (기본) vs 라인차트 (옵션) 전환 온오프 토글 스위치 */}
                        <div className="flex items-center space-x-2 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400 font-semibold px-1">차트 형태:</span>
                          <button
                            onClick={() => setMarketChartType('bar')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              marketChartType === 'bar'
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            봉차트 (기본)
                          </button>
                          <button
                            onClick={() => setMarketChartType('line')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              marketChartType === 'line'
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            라인차트
                          </button>
                        </div>
                      </div>

                      {/* 상시 최신 시장 지수 데이터 요약 카드 (전일, 오늘 지수 및 수치 변동폭 표출) */}
                      {processedIndexData.length > 0 && (() => {
                        const latest = processedIndexData[processedIndexData.length - 1];
                        const prev = processedIndexData.length > 1 ? processedIndexData[processedIndexData.length - 2] : null;
                        const latestVal = latest.close ?? latest.value;
                        const prevVal = prev ? (prev.close ?? prev.value) : latestVal;
                        const diff = latestVal - prevVal;
                        const diffPct = prevVal ? (diff / Math.abs(prevVal)) * 100 : 0;
                        const isUp = diff >= 0;

                        const formatVal = (v: number) => {
                          if (activeItemCode === 'NASDAQ' || activeItemCode === 'S&P500' || targetSymbol === '^IXIC' || targetSymbol === '^GSPC') {
                            return `$ ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          }
                          return `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pt`;
                        };

                        const formatDiff = (v: number) => {
                          const prefix = v >= 0 ? '+' : '';
                          return `${prefix}${v.toFixed(2)}`;
                        };

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800 font-sans">
                            {/* 전일 지수 */}
                            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <span className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                                <span>전일 지수</span>
                                <span className="font-mono text-[10px] text-slate-500">{prev ? prev.date : '-'}</span>
                              </span>
                              <span className="text-base font-bold text-slate-200 font-mono mt-1">
                                {formatVal(prevVal)}
                              </span>
                            </div>

                            {/* 오늘 지수 */}
                            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <span className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                                <span>오늘 지수 ({activeItemCode})</span>
                                <span className="font-mono text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">{formatUpdateTime(latest)}</span>
                              </span>
                              <div className="flex items-baseline space-x-2 mt-1 font-mono">
                                <span className="text-base font-extrabold text-amber-400 font-mono">
                                  {formatVal(latestVal)}
                                </span>
                                <span className="text-[11px] font-normal text-slate-400 font-sans">({formatUpdateTime(latest)})</span>
                              </div>
                            </div>

                            {/* 전일 대비 변동폭 */}
                            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <span className="text-[11px] text-slate-400 font-semibold">전일 대비 변동폭</span>
                              <div className="flex items-center space-x-2 mt-1 font-mono">
                                <span className={`text-base font-extrabold ${isUp ? 'text-rose-400' : 'text-blue-400'}`}>
                                  {isUp ? '▲' : '▼'} {formatDiff(diff)}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isUp ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                  {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {marketChartType === 'bar' ? (
                        <MacroCandleChart data={processedIndexData} symbol={activeItemCode} startDate={startDate} theme={theme} />
                      ) : (
                        <div className="h-[640px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={processedIndexData.filter((d) => d.date >= startDate)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                              <YAxis stroke="#94A3B8" fontSize={12} domain={['auto', 'auto']} />
                              <Tooltip
                                cursor={false}
                                contentStyle={{ backgroundColor: '#1E293B', borderColor: '#475569', borderRadius: '12px' }}
                                formatter={(val: any) => [`${Number(val).toLocaleString()} pt`, '지수 종가']}
                              />
                              <Legend />
                              <Line type="monotone" dataKey="close" name="종가" stroke="#F59E0B" strokeWidth={2.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. 거시 경제 (봉차트 기본, 옵션 라인차트 선택 기능 지원, 상시 최신 데이터 요약 카드 연동) */}
                  {activeCategory === 'MACRO' && (
                    <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-700/80 shadow-xl shadow-slate-950/60 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <Globe className="w-5 h-5 text-emerald-400" />
                            거시 경제 {activeItemCode === 'KR_BOND_3Y' ? '한국 국고채 3년물' : activeItemCode} 시계열 ({periodType === 'D' ? '일봉' : '주봉'})
                          </h3>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 light:bg-amber-500/15 text-amber-300 light:text-amber-800 border border-amber-500/20 light:border-amber-500/40 shadow-sm">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Sync: {getSyncBadgeText(activeCategory, activeItemCode)}</span>
                          </div>
                        </div>

                        {/* 봉차트 (기본) vs 라인차트 (옵션) 전환 온오프 토글 스위치 */}
                        <div className="flex items-center space-x-2 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400 font-semibold px-1">차트 형태:</span>
                          <button
                            onClick={() => setMacroChartType('bar')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              macroChartType === 'bar'
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            봉차트 (기본)
                          </button>
                          <button
                            onClick={() => setMacroChartType('line')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              macroChartType === 'line'
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            라인차트
                          </button>
                        </div>
                      </div>

                      {/* 상시 최신 거시 경제 데이터 요약 카드 (전일, 오늘 지표값 및 변동폭 표출) */}
                      {processedMacroData.length > 0 && (() => {
                        const latest = processedMacroData[processedMacroData.length - 1];
                        const prev = processedMacroData.length > 1 ? processedMacroData[processedMacroData.length - 2] : null;
                        const latestVal = latest.close ?? latest.value;
                        const prevVal = prev ? (prev.close ?? prev.value) : latestVal;
                        const diff = latestVal - prevVal;
                        const diffPct = prevVal ? (diff / Math.abs(prevVal)) * 100 : 0;
                        const isUp = diff >= 0;

                        const formatVal = (v: number) => {
                          if (activeItemCode === 'USDKRW') return `${Number(v).toLocaleString()} 원`;
                          if (activeItemCode === 'US10Y' || activeItemCode === 'KR_BOND_3Y' || activeItemCode === 'KR3Y') return `${Number(v)} %`;
                          if (activeItemCode === 'WTI') return `$ ${Number(v)} / bbl`;
                          return `${Number(v).toLocaleString()}`;
                        };

                        const formatDiff = (v: number) => {
                          if (activeItemCode === 'USDKRW') return `${v >= 0 ? '+' : ''}${v.toFixed(2)} 원`;
                          if (activeItemCode === 'US10Y' || activeItemCode === 'KR_BOND_3Y' || activeItemCode === 'KR3Y') return `${v >= 0 ? '+' : ''}${Number(v.toFixed(4))} %p`;
                          if (activeItemCode === 'WTI') return `${v >= 0 ? '+' : ''}$${Number(v.toFixed(4))}`;
                          return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
                        };


                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800 font-sans">
                            {/* 전일 지표값 */}
                            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <span className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                                <span>전일 지표값</span>
                                <span className="font-mono text-[10px] text-slate-500">{prev ? prev.date : '-'}</span>
                              </span>
                              <span className="text-base font-bold text-slate-200 font-mono mt-1">
                                {formatVal(prevVal)}
                              </span>
                            </div>

                            {/* 오늘 지표값 */}
                            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <span className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                                <span>오늘 지표값</span>
                                <span className="font-mono text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">{formatUpdateTime(latest)}</span>
                              </span>
                              <div className="flex items-baseline space-x-2 mt-1 font-mono">
                                <span className="text-base font-extrabold text-amber-400 font-mono">
                                  {formatVal(latestVal)}
                                </span>
                                <span className="text-[11px] font-normal text-slate-400 font-sans">({formatUpdateTime(latest)})</span>
                              </div>
                            </div>

                            {/* 전일 대비 변동폭 */}
                            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                              <span className="text-[11px] text-slate-400 font-semibold">전일 대비 변동폭</span>
                              <div className="flex items-center space-x-2 mt-1 font-mono">
                                <span className={`text-base font-extrabold ${isUp ? 'text-rose-400' : 'text-blue-400'}`}>
                                  {isUp ? '▲' : '▼'} {formatDiff(diff)}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isUp ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                  {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {macroChartType === 'bar' ? (
                        <MacroCandleChart data={processedMacroData} symbol={activeItemCode} startDate={startDate} theme={theme} />
                      ) : (
                        <div className="h-[640px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={processedMacroData.filter((d) => d.date >= startDate)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                              <YAxis stroke="#94A3B8" fontSize={12} domain={['auto', 'auto']} />
                              <Tooltip
                                cursor={false}
                                contentStyle={{ backgroundColor: '#1E293B', borderColor: '#475569', borderRadius: '12px' }}
                                formatter={(val: any) => [formatMacroTooltip(Number(val), activeItemCode), '지표 값']}
                              />
                              <Legend />
                              <Line type="monotone" dataKey="value" name="지표 값" stroke="#10B981" strokeWidth={2.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. 관심 종목 (드롭다운 메뉴, 봉차트 기본 & 3대 보조지표, 상시 최신 데이터 요약 카드 연동) */}
                  {activeCategory === 'STOCK' && (() => {
                    const processedStockData = stockCandles.map((d, i) => {
                      const prevClose = i > 0 ? (stockCandles[i - 1].close ?? 0) : (d.close ?? d.open ?? 0);
                      const open = d.open != null ? d.open : prevClose;
                      const close = d.close != null ? d.close : open;
                      const high = d.high != null ? d.high : Math.max(open, close);
                      const low = d.low != null ? d.low : Math.min(open, close);
                      return {
                        ...d,
                        open,
                        high,
                        low,
                        close,
                        value: close,
                      };
                    });

                    const currentStock = trackedStocks.find((s) => s.stock_code === activeItemCode);
                    const stockName = currentStock ? currentStock.stock_name : activeItemCode;

                    return (
                      <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-700/80 shadow-xl shadow-slate-950/60 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center space-x-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                              <Layers className="w-5 h-5 text-indigo-400" />
                              관심 종목 선택:
                            </h3>
                            {/* 드롭다운 셀렉트 박스 */}
                            <select
                              value={activeItemCode}
                              onChange={(e) => {
                                const code = e.target.value;
                                handleSelectMenuItem('STOCK', code, code);
                              }}
                              className="bg-slate-950 text-amber-300 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-700 hover:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-md"
                            >
                              {trackedStocks.map((stock) => (
                                <option key={stock.stock_code} value={stock.stock_code} className="bg-slate-900 text-white font-medium">
                                  {stock.stock_name} ({stock.stock_code})
                                </option>
                              ))}
                            </select>

                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 light:bg-amber-500/15 text-amber-300 light:text-amber-800 border border-amber-500/20 light:border-amber-500/40 shadow-sm">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span>Sync: {getSyncBadgeText(activeCategory, activeItemCode)}</span>
                            </div>
                          </div>

                          {/* 봉차트 (기본) vs 라인차트 (옵션) 전환 온오프 토글 스위치 */}
                          <div className="flex items-center space-x-2 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800">
                            <span className="text-xs text-slate-400 font-semibold px-1">차트 형태:</span>
                            <button
                              onClick={() => setStockChartType('bar')}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                                stockChartType === 'bar'
                                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              봉차트 (기본)
                            </button>
                            <button
                              onClick={() => setStockChartType('line')}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                                stockChartType === 'line'
                                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              라인차트
                            </button>
                          </div>
                        </div>

                        {/* 상시 최신 개별 종목 데이터 요약 카드 (전일, 오늘 주가 및 수치 변동폭 표출) */}
                        {processedStockData.length > 0 && (() => {
                          const latest = processedStockData[processedStockData.length - 1];
                          const prev = processedStockData.length > 1 ? processedStockData[processedStockData.length - 2] : null;
                          const latestVal = latest.close ?? latest.value;
                          const prevVal = prev ? (prev.close ?? prev.value) : latestVal;
                          const diff = latestVal - prevVal;
                          const diffPct = prevVal ? (diff / Math.abs(prevVal)) * 100 : 0;
                          const isUp = diff >= 0;

                          const formatVal = (v: number) => `${Number(v).toLocaleString()} 원`;
                          const formatDiff = (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString()} 원`;

                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800 font-sans">
                              {/* 전일 주가 */}
                              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                                <span className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                                  <span>전일 주가</span>
                                  <span className="font-mono text-[10px] text-slate-500">{prev ? prev.date : '-'}</span>
                                </span>
                                <span className="text-base font-bold text-slate-200 font-mono mt-1">
                                  {formatVal(prevVal)}
                                </span>
                              </div>

                              {/* 오늘 주가 */}
                              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                                <span className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                                  <span>오늘 주가 ({stockName})</span>
                                  <span className="font-mono text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">{formatUpdateTime(latest)}</span>
                                </span>
                                <div className="flex items-baseline space-x-2 mt-1 font-mono">
                                  <span className="text-base font-extrabold text-indigo-400 font-mono">
                                    {formatVal(latestVal)}
                                  </span>
                                  <span className="text-[11px] font-normal text-slate-400 font-sans">({formatUpdateTime(latest)})</span>
                                </div>
                              </div>

                              {/* 전일 대비 변동폭 */}
                              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                                <span className="text-[11px] text-slate-400 font-semibold">전일 대비 변동폭</span>
                                <div className="flex items-center space-x-2 mt-1 font-mono">
                                  <span className={`text-base font-extrabold ${isUp ? 'text-rose-400' : 'text-blue-400'}`}>
                                    {isUp ? '▲' : '▼'} {formatDiff(diff)}
                                  </span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isUp ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                    {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {stockChartType === 'bar' ? (
                          <MacroCandleChart data={processedStockData} symbol={activeItemCode} startDate={startDate} theme={theme} />
                        ) : (
                          <div className="h-[640px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={processedStockData.filter((d) => d.date >= startDate)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                                <YAxis stroke="#94A3B8" fontSize={12} domain={['auto', 'auto']} />
                                <Tooltip
                                  cursor={false}
                                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#475569', borderRadius: '12px' }}
                                  formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} 원`, name]}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="close" name="종가" stroke="#818CF8" strokeWidth={2.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
              </div>

              {/* 우측 다음 커서 버튼 전용 고정 슬롯 (차트 그래프 박스 중앙 위치 정렬 mt-[390px]) */}
              <div className="w-12 shrink-0 mt-[390px] flex justify-center z-20">
                {hasNext ? (
                  <button
                    onClick={() => nextItem && handleSelectMenuItem(nextItem.categoryCode, nextItem.itemCode, nextItem.symbol)}
                    className="w-12 h-12 rounded-2xl bg-slate-900/90 hover:bg-amber-500/20 hover:border-amber-500/50 border border-slate-700/80 text-slate-300 hover:text-amber-300 shadow-2xl backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer z-10"
                    title={`다음 지표: ${nextItem?.title}`}
                  >
                    <ChevronRight className="w-6 h-6 text-amber-400" />
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
