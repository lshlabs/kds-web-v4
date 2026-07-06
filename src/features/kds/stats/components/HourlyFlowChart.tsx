import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type HourlyFlowDatum = {
  hour: string;
  hourTick: string;
  value: number | null;
  hasData: boolean;
  valueLabel: string;
  orders: string;
  revenue: string;
  averageCompletion: string;
  delayed: string;
};

type HourlyFlowChartProps = {
  data: HourlyFlowDatum[];
  metricLabel: string;
};

const ACCENT = "#e8650a";
const ACCENT_MUTED = "rgba(232, 101, 10, 0.35)";

export function HourlyFlowChart({ data, metricLabel }: HourlyFlowChartProps) {
  return (
    <div className="kds-hourly-chart-box" aria-label={`${metricLabel} 시간대별 흐름`}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: 4 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="rgba(0, 0, 0, 0.06)" />
          <XAxis
            dataKey="hourTick"
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickMargin={8}
            minTickGap={16}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={36}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(232, 101, 10, 0.08)" }}
            content={<HourlyTooltip metricLabel={metricLabel} />}
            wrapperStyle={{ outline: "none", zIndex: 40 }}
            allowEscapeViewBox={{ x: false, y: true }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.hour} fill={entry.hasData ? ACCENT : ACCENT_MUTED} fillOpacity={entry.hasData ? 1 : 0} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type HourlyTooltipProps = {
  active?: boolean;
  metricLabel?: string;
  payload?: Array<{ payload: HourlyFlowDatum }>;
};

function HourlyTooltip({ active, payload }: HourlyTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const datum = payload[0].payload;
  return (
    <div className="kds-hourly-tip">
      <span className="kds-hourly-tip-title">{datum.hour}</span>
      <span className="kds-hourly-tip-row">주문 수 <strong>{datum.orders}</strong></span>
      <span className="kds-hourly-tip-row">매출 <strong>{datum.revenue}</strong></span>
      <span className="kds-hourly-tip-row">평균 완료 시간 <strong>{datum.averageCompletion}</strong></span>
      <span className="kds-hourly-tip-row">지연 주문 <strong>{datum.delayed}</strong></span>
    </div>
  );
}
