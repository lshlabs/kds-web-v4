import { useCallback, useEffect, useState } from "react";

import { apiGetKdsStats } from "../../../../lib/api";
import { requestWithReauth } from "../../../../shared/lib/requestWithReauth";
import type { ShowToast } from "../../../../shared/hooks/useToast";
import type { KdsStatsResponse } from "../../../../types";

type UseKdsStatsParams = {
  accessToken: string;
  onUnauthorized: () => Promise<string | null>;
  showToast: ShowToast;
};

export function useKdsStats({
  accessToken,
  onUnauthorized,
  showToast,
}: UseKdsStatsParams) {
  const [stats, setStats] = useState<KdsStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStats = useCallback(async () => {
    const data = await requestWithReauth(accessToken, onUnauthorized, apiGetKdsStats);
    setStats(data);
  }, [accessToken, onUnauthorized]);

  useEffect(() => {
    void refreshStats()
      .catch((error) => {
        showToast(error instanceof Error ? error.message : "통계를 불러오지 못했습니다.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refreshStats, showToast]);

  return {
    loading,
    refreshStats,
    stats,
  };
}
