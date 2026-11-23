import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dataFreshness, loadPowerWatchData, type DataFreshness, type PowerWatchData } from "../lib/data";

interface DataContextValue {
  data: PowerWatchData;
  loading: boolean;
  freshness: DataFreshness;
  reload: () => void;
}

const EMPTY_DATA: PowerWatchData = {
  sample: null,
  manifest: null,
  coverage: null,
  quality: null,
  priceSummary: null,
  overview: null,
  errors: [],
};

const DataContext = createContext<DataContextValue>({
  data: EMPTY_DATA,
  loading: true,
  freshness: "loading",
  reload: () => undefined,
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PowerWatchData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadPowerWatchData()
      .then((payload) => {
        if (active) setData(payload);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const freshness = useMemo(() => dataFreshness(data, loading), [data, loading]);

  return (
    <DataContext.Provider value={{ data, loading, freshness, reload }}>
      {children}
    </DataContext.Provider>
  );
}

export function usePowerWatchData(): DataContextValue {
  return useContext(DataContext);
}
