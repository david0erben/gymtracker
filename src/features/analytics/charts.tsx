import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatFull, formatMonthShort, formatShort, toDateKey } from '../../domain/dates';
import { formatNumber, formatSet } from '../../domain/format';
import type { GoalLine, StrengthMetric, StrengthPoint } from '../../domain/analytics';

const AXIS = { fill: '#767676', fontSize: 11, fontFamily: 'Inter Variable' };

function dateTick(t: number, spanDays: number): string {
  const key = toDateKey(new Date(t));
  return spanDays > 120 ? formatMonthShort(key) : formatShort(key);
}

interface TooltipPayload {
  payload?: { t: number; value: number; raw?: number; best?: { reps: number | null; weight: number | null }; goal?: boolean; avg?: number };
}

function GlassTooltip({ active, payload, unit, label }: { active?: boolean; payload?: TooltipPayload[]; unit: string; label: string }) {
  const item = payload?.find((entry) => entry.payload && !entry.payload.goal)?.payload;
  if (!active || !item) return null;
  return (
    <div className="glass-strong rounded-2xl px-3.5 py-2.5 text-[12.5px] shadow-2xl">
      <p className="text-ink-3">{formatFull(toDateKey(new Date(item.t)))}</p>
      <p className="display mt-0.5 text-[18px] text-ink">
        {formatNumber(item.value, 1)} <span className="text-[12px] text-ink-2">{unit}</span>
      </p>
      <p className="text-ink-3">{label}</p>
      {item.best && <p className="tabular mt-1 text-ink-2">Bestes Set: {formatSet(item.best.reps, item.best.weight)}</p>}
      {item.raw !== undefined && <p className="tabular mt-1 text-ink-2">Altes Gerät: {formatNumber(item.raw, 1)} {unit} (umgerechnet)</p>}
      {item.avg !== undefined && <p className="tabular mt-1 text-ink-2">Ø 4 Wochen: {formatNumber(item.avg, 1)}</p>}
    </div>
  );
}

/** Kraftkurve: geschätztes 1RM pro Einheit, optional mit Soll-Linie fürs Ziel. */
export function StrengthChart({
  points,
  metric,
  goal,
  shifts = [],
  height = 240,
}: {
  points: StrengthPoint[];
  metric: StrengthMetric;
  goal: GoalLine | null;
  shifts?: { t: number }[];
  height?: number;
}) {
  const goalData = goal
    ? [
        { t: goal.start.t, value: goal.start.value, goal: true },
        { t: goal.end.t, value: goal.end.value, goal: true },
      ]
    : [];
  const times = [...points.map((point) => point.t), ...goalData.map((point) => point.t)];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const spanDays = (max - min) / 86_400_000;
  const unit = metric === 'e1rm' ? 'kg' : 'Reps';
  const label = metric === 'e1rm' ? 'geschätztes 1RM' : 'Reps gesamt';

  return (
    <div style={{ height }} className="w-full" aria-label={`Diagramm: ${label} im Verlauf`} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="strengthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fe8c35" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#fe8c35" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="strengthStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffa30a" />
              <stop offset="100%" stopColor="#ff743e" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[min, max]}
            tickFormatter={(t: number) => dateTick(t, spanDays)}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[(dataMin: number) => Math.floor(dataMin * 0.92), (dataMax: number) => Math.ceil(dataMax * 1.04)]}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip content={<GlassTooltip unit={unit} label={label} />} cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 }} />
          {shifts.map((shift) => (
            <ReferenceLine
              key={shift.t}
              x={shift.t}
              stroke="rgba(255,255,255,0.28)"
              strokeDasharray="3 4"
              label={{ value: 'Gerätewechsel', position: (shift.t - min) / Math.max(1, max - min) > 0.6 ? 'insideTopRight' : 'insideTopLeft', fill: '#a3a3a3', fontSize: 10 }}
            />
          ))}
          {goal && (
            <Line
              data={goalData}
              dataKey="value"
              stroke="#18c152"
              strokeWidth={2}
              strokeDasharray="6 6"
              dot={{ r: 3, fill: '#18c152', strokeWidth: 0 }}
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke="url(#strengthStroke)"
            strokeWidth={3}
            fill="url(#strengthFill)"
            dot={{ r: 3, fill: '#ffb870', strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#ffffff', stroke: '#fe8c35', strokeWidth: 3 }}
            animationDuration={600}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Wöchentliches Volumen mit gleitendem 4-Wochen-Schnitt. */
export function VolumeChart({
  data,
  unit,
  height = 220,
}: {
  data: { t: number; value: number; avg: number }[];
  unit: string;
  height?: number;
}) {
  const min = data[0]?.t ?? 0;
  const max = data.at(-1)?.t ?? 0;
  const spanDays = (max - min) / 86_400_000;
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Diagramm: Volumen pro Woche (${unit})`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#18c152" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#18c152" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[min, max]}
            tickFormatter={(t: number) => dateTick(t, spanDays)}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip content={<GlassTooltip unit={unit} label="pro Woche" />} cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="value" stroke="#18c152" strokeOpacity={0.55} strokeWidth={1.5} fill="url(#volumeFill)" dot={false} activeDot={{ r: 4, fill: '#18c152', strokeWidth: 0 }} animationDuration={600} />
          <Line type="monotone" dataKey="avg" stroke="#fe8c35" strokeWidth={3} dot={false} activeDot={false} animationDuration={600} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Mini-Verlauf für Listen. */
export function Sparkline({ values, positive, width = 72, height = 26 }: { values: number[]; positive: boolean | null; width?: number; height?: number }) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const path = values
    .map((value, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${(height - 3 - ((value - min) / span) * (height - 6)).toFixed(1)}`)
    .join(' ');
  const color = positive === null ? '#767676' : positive ? '#18c152' : '#ff4d42';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0 overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Einfache Verlaufskurve, z. B. fürs Körpergewicht. */
export function TrendChart({ data, unit, label, height = 220 }: { data: { t: number; value: number }[]; unit: string; label: string; height?: number }) {
  const min = data[0]?.t ?? 0;
  const max = data.at(-1)?.t ?? 0;
  const spanDays = (max - min) / 86_400_000;
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Diagramm: ${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fe8c35" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#fe8c35" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[min, max]}
            tickFormatter={(t: number) => dateTick(t, spanDays)}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[(dataMin: number) => Math.floor(dataMin - 1), (dataMax: number) => Math.ceil(dataMax + 1)]}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip content={<GlassTooltip unit={unit} label={label} />} cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#fe8c35"
            strokeWidth={3}
            fill="url(#trendFill)"
            dot={{ r: 3, fill: '#ffb870', strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#ffffff', stroke: '#fe8c35', strokeWidth: 3 }}
            animationDuration={600}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
