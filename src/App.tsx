import { StatsPanel } from "./features/kds/stats/components/StatsPanel";
import type { KdsStatsResponse, Order } from "./types";

const sampleStats: KdsStatsResponse = {
  date: new Date().toISOString().slice(0, 10),
  summary: {
    total_orders: 7,
    completed_orders: 5,
    completion_rate: 71.4,
    revenue: 126000,
    average_completion_seconds: 530,
    delayed_orders: 1,
    peak_hour: "12:00~13:00",
  },
  comparison: {
    vs_yesterday: {
      orders_delta: 2,
      orders_delta_rate: 40,
      revenue_delta: 32000,
      revenue_delta_rate: 34,
      average_completion_seconds_delta: -45,
    },
    vs_7d_average: {
      orders_delta: 3,
      orders_delta_rate: 75,
      revenue_delta: 41000,
      revenue_delta_rate: 48,
      average_completion_seconds_delta: -20,
    },
  },
  hourly: [
    {
      hour: "11:00~12:00",
      orders: 1,
      revenue: 18000,
      average_completion_seconds: 360,
      delayed_orders: 0,
    },
    {
      hour: "12:00~13:00",
      orders: 4,
      revenue: 72000,
      average_completion_seconds: 620,
      delayed_orders: 1,
    },
    {
      hour: "18:00~19:00",
      orders: 2,
      revenue: 36000,
      average_completion_seconds: 480,
      delayed_orders: 0,
    },
  ],
  menus: [
    {
      menu_name: "직화 제육 덮밥",
      orders: 4,
      revenue: 52000,
      average_completion_seconds: 620,
      delayed_orders: 1,
      yesterday_delta_rate: 33.3,
      seven_day_average_delta_rate: 25,
    },
    {
      menu_name: "차돌 된장찌개",
      orders: 2,
      revenue: 32000,
      average_completion_seconds: 450,
      delayed_orders: 0,
      yesterday_delta_rate: null,
      seven_day_average_delta_rate: 12.5,
    },
    {
      menu_name: "수제 돈까스",
      orders: 1,
      revenue: 16000,
      average_completion_seconds: 390,
      delayed_orders: 0,
      yesterday_delta_rate: -50,
      seven_day_average_delta_rate: null,
    },
  ],
  kitchen: {
    on_time_rate: 80,
    slowest_order_seconds: 780,
    bottleneck_hour: "12:00~13:00",
    bottleneck_menu: "직화 제육 덮밥",
  },
  insights: [],
};

export default function App() {
  return (
    <main className="kds-stats-only-shell">
      <StatsPanel loading={false} orders={[] as Order[]} stats={sampleStats} />
    </main>
  );
}
