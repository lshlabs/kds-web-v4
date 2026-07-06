import { useState } from "react";

import type { KdsStatsHourly, KdsStatsMenu, KdsStatsResponse, Order } from "../../../../types";
import { HourlyFlowChart, type HourlyFlowDatum } from "./HourlyFlowChart";

type HourlyMetric = "orders" | "revenue" | "averageCompletion" | "delayed";
type MenuChartMetric = "orders" | "revenue";
type MenuSortKey = "orders" | "revenue" | "averageCompletion" | "delayed";
type DisplayInsight = {
  prefix?: string;
  highlight: string;
  suffix?: string;
};

const FULL_DAY_HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const HOURLY_METRIC_OPTIONS: Array<{ key: HourlyMetric; label: string }> = [
  { key: "orders", label: "주문 수" },
  { key: "revenue", label: "매출" },
  { key: "averageCompletion", label: "평균 완료 시간" },
  { key: "delayed", label: "지연 주문" },
];

const MENU_CHART_OPTIONS: Array<{ key: MenuChartMetric; label: string }> = [
  { key: "orders", label: "주문 수" },
  { key: "revenue", label: "매출" },
];

const MENU_SORT_OPTIONS: Array<{ key: MenuSortKey; label: string }> = [
  { key: "orders", label: "주문 수순" },
  { key: "revenue", label: "매출순" },
  { key: "averageCompletion", label: "평균 완료 시간순" },
  { key: "delayed", label: "지연순" },
];

type StatsPanelProps = {
  loading?: boolean;
  orders: Order[];
  stats: KdsStatsResponse | null;
};

export function StatsPanel({ loading = false, orders, stats }: StatsPanelProps) {
  const [hourlyMetric, setHourlyMetric] = useState<HourlyMetric>("orders");
  const [menuChartMetric, setMenuChartMetric] = useState<MenuChartMetric>("orders");
  const [menuSortKey, setMenuSortKey] = useState<MenuSortKey>("orders");
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const todayOrders = orders.filter((order) => {
    const timestamp = order.ordered_at ?? order.created_at;
    return timestamp.startsWith(todayStr);
  });

  const doneToday = todayOrders.filter((order) => order.status === "DONE");
  const totalRevenue = todayOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (item.total_price ?? 0), 0), 0);
  const completionRate = todayOrders.length > 0 ? Math.round((doneToday.length / todayOrders.length) * 100) : 0;
  const summary = stats?.summary;
  const summaryDate = stats?.date ?? todayStr;
  const totalOrders = summary?.total_orders ?? todayOrders.length;
  const completedOrders = summary?.completed_orders ?? doneToday.length;
  const displayCompletionRate = summary ? formatRate(summary.completion_rate) : `${completionRate}%`;
  const displayRevenue = summary?.revenue ?? totalRevenue;
  const averageCompletionLabel = summary
    ? formatSeconds(summary.average_completion_seconds)
    : doneToday.length > 0 ? "집계 중" : "완료 주문 필요";
  const delayedOrders = summary?.delayed_orders ?? 0;
  const peakHourLabel = summary?.peak_hour ?? (totalOrders > 0 ? "집계 중" : "주문 없음");
  const insights = buildDisplayInsights(stats);
  const showReferenceNote = !stats || totalOrders < 5 || completedOrders < 2;
  const hourly = fillHourlySlots(stats?.hourly ?? []);
  const hasHourlyData = (stats?.hourly.length ?? 0) > 0;
  const hourlyChartData: HourlyFlowDatum[] = hourly.map((item) => {
    const value = getHourlyValue(item, hourlyMetric);
    const hasData = value !== null && value > 0;
    return {
      hour: item.hour,
      hourTick: formatHourTick(item.hour),
      value: hasData ? value : 0,
      hasData,
      valueLabel: getHourlyDisplayValue(item, hourlyMetric),
      orders: `${item.orders}건`,
      revenue: formatCurrency(item.revenue),
      averageCompletion: formatSeconds(item.average_completion_seconds),
      delayed: `${item.delayed_orders}건`,
    };
  });
  const kitchen = stats?.kitchen;
  const kitchenCoreMetrics = [
    {
      label: "평균 완료 시간",
      value: averageCompletionLabel,
      note: summary?.average_completion_seconds === null ? "완료 주문 필요" : "완료 주문 기준",
    },
    {
      label: "정시 완료율",
      value: kitchen?.on_time_rate === undefined || kitchen.on_time_rate === null ? "-" : formatRate(kitchen.on_time_rate),
      note: kitchen?.on_time_rate === undefined || kitchen.on_time_rate === null ? "완료 주문 필요" : "10분 기준",
    },
    {
      label: "지연 주문 수",
      value: `${delayedOrders}건`,
      note: delayedOrders === 0 ? "지연 주문 없음" : "10분 초과",
    },
  ];
  const kitchenDetails = [
    {
      label: "가장 오래 걸린 주문",
      value: kitchen ? formatSeconds(kitchen.slowest_order_seconds) : "-",
      note: kitchen?.slowest_order_seconds === null ? "완료 주문 필요" : "완료 시간 기준",
    },
    {
      label: "병목 시간대",
      value: kitchen?.bottleneck_hour ?? "-",
      note: kitchen?.bottleneck_hour ? getReferenceTone(totalOrders, "처리 지연 집중") : "시간대 데이터 부족",
    },
    {
      label: "병목 메뉴",
      value: kitchen?.bottleneck_menu ?? "-",
      note: kitchen?.bottleneck_menu ? getReferenceTone(totalOrders, "평균 완료 시간 기준") : "메뉴 데이터 부족",
    },
  ];

  const menuMap = new Map<string, number>();
  todayOrders.forEach((order) => {
    order.items.forEach((item) => {
      menuMap.set(item.name, (menuMap.get(item.name) ?? 0) + item.quantity);
    });
  });
  const sortedMenus = Array.from(menuMap.entries()).sort((left, right) => right[1] - left[1]);
  const fallbackMenus = sortedMenus.map(([name, count]) => createFallbackMenu(name, count));
  const menus = stats?.menus ?? fallbackMenus;
  const sortedPerformanceMenus = sortMenus(menus, menuSortKey);
  const topMenus = sortMenus(menus, menuChartMetric).slice(0, 5);
  const topMenuMaxValue = Math.max(...topMenus.map((item) => getMenuChartValue(item, menuChartMetric)), 0);

  return (
    <section className="kds-panel kds-panel--stats" aria-label="통계">
      <div className="kds-panel-header">
        <div>
          <h2 className="kds-panel-title">오늘 장사 현황</h2>
          <p className="kds-panel-subtitle">{summaryDate}</p>
        </div>
      </div>

      <div className="kds-metric-strip">
        <div className="kds-metric primary">
          <span className="kds-metric-value">{totalOrders}</span>
          <span className="kds-metric-label">총 주문</span>
        </div>
        <div className="kds-metric-divider" />
        <div className="kds-metric primary">
          <span className="kds-metric-value">{displayRevenue > 0 ? `${displayRevenue.toLocaleString()}원` : "-"}</span>
          <span className="kds-metric-label">매출</span>
        </div>
        <div className="kds-metric-divider" />
        <div className="kds-metric secondary">
          <span className="kds-metric-value">{averageCompletionLabel}</span>
          <span className="kds-metric-label">평균 완료 시간</span>
        </div>
        <div className="kds-metric-divider" />
        <div className="kds-metric secondary">
          <span className="kds-metric-value">{delayedOrders}</span>
          <span className="kds-metric-label">지연 주문</span>
        </div>
      </div>

      <div className="kds-stats-insights">
        <span className="kds-stats-insights-title">오늘 장사 요약</span>
        {loading ? (
          <p className="kds-panel-empty">통계를 불러오는 중입니다.</p>
        ) : insights.length === 0 ? (
          <p className="kds-panel-empty">{totalOrders === 0 ? "오늘은 아직 주문이 없습니다." : "분석할 주문 데이터가 더 필요합니다."}</p>
        ) : (
          <div className="kds-stats-insight-copy">
            {insights.slice(0, 3).map((insight) => (
              <p className="kds-stats-insight-line" key={`${insight.prefix ?? ""}${insight.highlight}${insight.suffix ?? ""}`}>
                {insight.prefix}
                <strong>{insight.highlight}</strong>
                {insight.suffix}
              </p>
            ))}
          </div>
        )}
        {showReferenceNote ? (
          <p className="kds-stats-reference-note">주문/완료 데이터가 적어 분석 참고용으로만 확인하세요.</p>
        ) : null}
      </div>

      <div className="kds-section-divider">
        <span className="kds-section-label">오늘 한눈에 보기</span>
      </div>

      <div className="kds-stats-snapshot">
        <span>완료 <strong>{completedOrders}건</strong></span>
        <span>완료율 <strong>{displayCompletionRate}</strong></span>
        <span>피크 시간 <strong>{getReferenceTone(totalOrders, peakHourLabel)}</strong></span>
        <span>평균 완료 <strong>{averageCompletionLabel}</strong></span>
        <span>지연 <strong>{delayedOrders}건</strong></span>
      </div>

      <div className="kds-section-divider">
        <span className="kds-section-label">시간대별 주문 흐름</span>
      </div>

      <div className="kds-hourly-flow">
        <div className="kds-hourly-tabs" role="tablist" aria-label="시간대별 지표">
          {HOURLY_METRIC_OPTIONS.map((option) => (
            <button
              aria-selected={hourlyMetric === option.key}
              className={`kds-hourly-tab${hourlyMetric === option.key ? " active" : ""}`}
              key={option.key}
              onClick={() => setHourlyMetric(option.key)}
              role="tab"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="kds-panel-empty">시간대별 통계를 불러오는 중입니다.</p>
        ) : !hasHourlyData ? (
          <p className="kds-panel-empty">표시할 시간대별 데이터가 없습니다.</p>
        ) : (
          <HourlyFlowChart data={hourlyChartData} metricLabel={getHourlyMetricLabel(hourlyMetric)} />
        )}
      </div>

      <div className="kds-section-divider">
        <span className="kds-section-label">주방 처리 상태</span>
      </div>

      {loading ? (
        <p className="kds-panel-empty">주방 효율 통계를 불러오는 중입니다.</p>
      ) : !stats ? (
        <p className="kds-panel-empty">주방 효율은 주문이 더 쌓이면 표시됩니다.</p>
      ) : (
        <div className="kds-kitchen-block">
          <div className="kds-kitchen-grid">
            {kitchenCoreMetrics.map((metric) => (
              <div className="kds-kitchen-card" key={metric.label}>
                <span className="kds-kitchen-label">{metric.label}</span>
                <span className="kds-kitchen-value">{metric.value}</span>
                <span className="kds-kitchen-note">{metric.note}</span>
              </div>
            ))}
          </div>
          <div className="kds-kitchen-detail">
            <span className="kds-kitchen-detail-title">상세 분석</span>
            {kitchenDetails.map((metric) => (
              <div className="kds-kitchen-detail-row" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <em>{metric.note}</em>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="kds-section-divider">
        <span className="kds-section-label">메뉴별 장사 성과</span>
      </div>

      {loading ? (
        <p className="kds-panel-empty">메뉴별 통계를 불러오는 중입니다.</p>
      ) : menus.length === 0 ? (
        <p className="kds-panel-empty">메뉴 통계는 주문이 더 쌓이면 표시됩니다.</p>
      ) : (
        <div className="kds-menu-performance">
          <div className="kds-menu-toolbar">
            <div className="kds-menu-control-group" role="tablist" aria-label="메뉴 TOP 차트 기준">
              {MENU_CHART_OPTIONS.map((option) => (
                <button
                  aria-selected={menuChartMetric === option.key}
                  className={`kds-menu-control${menuChartMetric === option.key ? " active" : ""}`}
                  key={option.key}
                  onClick={() => setMenuChartMetric(option.key)}
                  role="tab"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="kds-menu-sort">
              <span>정렬</span>
              <select value={menuSortKey} onChange={(event) => setMenuSortKey(event.target.value as MenuSortKey)}>
                {MENU_SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="kds-menu-subsection">
            <span className="kds-menu-subtitle">TOP 메뉴 차트</span>
            <div className="kds-menu-stat-list" aria-label={`메뉴 TOP ${getMenuChartLabel(menuChartMetric)}`}>
              {topMenus.map((menu) => {
                const value = getMenuChartValue(menu, menuChartMetric);
                const width = topMenuMaxValue > 0 ? Math.round((value / topMenuMaxValue) * 100) : 0;

                return (
                  <div className="kds-menu-stat-row" key={menu.menu_name}>
                    <span className="kds-menu-stat-name">{menu.menu_name}</span>
                    <div className="kds-menu-stat-bar-wrap">
                      <div className="kds-menu-stat-bar" style={{ width: `${width}%` }} />
                    </div>
                    <span className="kds-menu-stat-count">{getMenuChartDisplayValue(menu, menuChartMetric)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="kds-menu-subsection">
            <span className="kds-menu-subtitle">메뉴별 상세 표</span>
            <div className="kds-menu-table-wrap">
              <table className="kds-menu-table">
                <thead>
                  <tr>
                    <th>메뉴명</th>
                    <th>주문 수</th>
                    <th>매출</th>
                    <th>평균 완료 시간</th>
                    <th>지연 수</th>
                    <th>전일 대비</th>
                    <th>최근 7일 평균 대비</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPerformanceMenus.map((menu) => (
                    <tr key={menu.menu_name}>
                      <td className="kds-menu-table-name">{menu.menu_name}</td>
                      <td>{menu.orders}건</td>
                      <td>{formatCurrency(menu.revenue)}</td>
                      <td>{formatSeconds(menu.average_completion_seconds)}</td>
                      <td>{menu.delayed_orders}건</td>
                      <td>{formatDeltaRate(menu.yesterday_delta_rate)}</td>
                      <td>{formatDeltaRate(menu.seven_day_average_delta_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function formatRate(rate: number) {
  return `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%`;
}

function formatSeconds(seconds: number | null) {
  if (seconds === null) {
    return "완료 주문 필요";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes <= 0) {
    return `${remainingSeconds}초`;
  }
  return remainingSeconds > 0 ? `${minutes}분 ${remainingSeconds}초` : `${minutes}분`;
}

function formatCurrency(value: number) {
  return value > 0 ? `${value.toLocaleString()}원` : "-";
}

function getHourlyMetricLabel(metric: HourlyMetric) {
  return HOURLY_METRIC_OPTIONS.find((option) => option.key === metric)?.label ?? "";
}

function getHourlyValue(item: KdsStatsHourly, metric: HourlyMetric) {
  if (metric === "orders") {
    return item.orders;
  }
  if (metric === "revenue") {
    return item.revenue;
  }
  if (metric === "averageCompletion") {
    return item.average_completion_seconds;
  }
  return item.delayed_orders;
}

function getHourlyDisplayValue(item: KdsStatsHourly, metric: HourlyMetric) {
  if (metric === "revenue") {
    return formatCurrency(item.revenue);
  }
  if (metric === "averageCompletion") {
    return formatSeconds(item.average_completion_seconds);
  }
  const value = getHourlyValue(item, metric);
  return value === null ? "-" : `${value}건`;
}

function fillHourlySlots(hourly: KdsStatsHourly[]) {
  const byHour = new Map(hourly.map((item) => [getHourFromLabel(item.hour), item]));
  return FULL_DAY_HOURS.map((hour) => byHour.get(hour) ?? createEmptyHourly(hour));
}

function createEmptyHourly(hour: number): KdsStatsHourly {
  return {
    hour: formatHourRange(hour),
    orders: 0,
    revenue: 0,
    average_completion_seconds: null,
    delayed_orders: 0,
  };
}

function getHourFromLabel(label: string) {
  const parsed = Number.parseInt(label.slice(0, 2), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatHourRange(hour: number) {
  const nextHour = (hour + 1) % 24;
  return `${String(hour).padStart(2, "0")}:00~${String(nextHour).padStart(2, "0")}:00`;
}

function formatHourTick(label: string) {
  return label.slice(0, 5);
}

function buildDisplayInsights(stats: KdsStatsResponse | null): DisplayInsight[] {
  if (!stats) {
    return [];
  }
  const insights: DisplayInsight[] = [];
  const totalOrders = stats.summary.total_orders;
  const sevenDayDelta = stats.comparison.vs_7d_average.orders_delta;
  if (sevenDayDelta !== null) {
    if (Math.abs(sevenDayDelta) > 0) {
      const direction = sevenDayDelta > 0 ? "많습니다." : "적습니다.";
      insights.push({
        prefix: "최근 7일 평균보다 주문이 ",
        highlight: `${Math.abs(sevenDayDelta)}건 ${sevenDayDelta > 0 ? "많음" : "적음"}`,
        suffix: ` ${direction}`,
      });
    } else {
      insights.push({ prefix: "최근 7일 평균과 주문 흐름이 ", highlight: "비슷합니다." });
    }
  } else if (totalOrders === 0) {
    insights.push({ highlight: "아직 주문이 없습니다.", suffix: " 주문이 들어오면 흐름을 보여드릴게요." });
  }
  if (stats.summary.peak_hour) {
    insights.push({
      prefix: "주문은 ",
      highlight: getReferenceTone(totalOrders, stats.summary.peak_hour),
      suffix: totalOrders < 5 ? "에 상대적으로 많았습니다." : "에 가장 몰렸습니다.",
    });
  }
  if (stats.summary.delayed_orders > 0) {
    insights.push({ prefix: "10분 넘게 걸린 주문이 ", highlight: `${stats.summary.delayed_orders}건`, suffix: " 있습니다." });
  } else if (totalOrders > 0) {
    insights.push({ highlight: "지연 주문은 없습니다.", suffix: " 현재 처리 흐름은 안정적입니다." });
  }
  if (stats.kitchen.bottleneck_menu) {
    insights.push({ prefix: "완료 시간이 긴 메뉴는 ", highlight: stats.kitchen.bottleneck_menu, suffix: "입니다." });
  }
  return insights.length > 0 ? insights.slice(0, 3) : stats.insights.slice(0, 3).map((insight) => ({ highlight: insight }));
}

function getReferenceTone(totalOrders: number, text: string) {
  return totalOrders > 0 && totalOrders < 5 ? `${text} 참고용` : text;
}

function createFallbackMenu(menuName: string, orders: number): KdsStatsMenu {
  return {
    menu_name: menuName,
    orders,
    revenue: 0,
    average_completion_seconds: null,
    delayed_orders: 0,
    yesterday_delta_rate: null,
    seven_day_average_delta_rate: null,
  };
}

function sortMenus(menus: KdsStatsMenu[], sortKey: MenuSortKey | MenuChartMetric) {
  return [...menus].sort((left, right) => {
    const leftValue = getMenuSortValue(left, sortKey);
    const rightValue = getMenuSortValue(right, sortKey);
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    return left.menu_name.localeCompare(right.menu_name);
  });
}

function getMenuSortValue(menu: KdsStatsMenu, sortKey: MenuSortKey | MenuChartMetric) {
  if (sortKey === "orders") {
    return menu.orders;
  }
  if (sortKey === "revenue") {
    return menu.revenue;
  }
  if (sortKey === "averageCompletion") {
    return menu.average_completion_seconds ?? -1;
  }
  return menu.delayed_orders;
}

function getMenuChartLabel(metric: MenuChartMetric) {
  return MENU_CHART_OPTIONS.find((option) => option.key === metric)?.label ?? "";
}

function getMenuChartValue(menu: KdsStatsMenu, metric: MenuChartMetric) {
  return metric === "orders" ? menu.orders : menu.revenue;
}

function getMenuChartDisplayValue(menu: KdsStatsMenu, metric: MenuChartMetric) {
  return metric === "orders" ? `${menu.orders}건` : formatCurrency(menu.revenue);
}

function formatDeltaRate(rate: number | null) {
  if (rate === null) {
    return "";
  }
  const sign = rate > 0 ? "+" : "";
  return `${sign}${rate.toFixed(1)}%`;
}
