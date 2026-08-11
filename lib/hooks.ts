"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Hook genérico para leer una tabla filtrada por household_id, ordenada opcionalmente.
export function useTable<T>(
  table: string,
  householdId: string | null,
  orderBy?: { column: string; ascending?: boolean }
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!householdId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase.from(table).select("*").eq("household_id", householdId);
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }
    const { data, error } = await query;
    if (!error) setData((data as T[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, householdId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh, setData };
}
