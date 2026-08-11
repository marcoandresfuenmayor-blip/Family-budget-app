"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

type HouseholdContextValue = {
  session: Session | null;
  loading: boolean;
  householdId: string | null;
  displayName: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue>({
  session: null,
  loading: true,
  householdId: null,
  displayName: null,
  refresh: async () => {},
  signOut: async () => {},
});

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMembership = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("household_members")
      .select("household_id, display_name")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    setHouseholdId(data?.household_id ?? null);
    setDisplayName(data?.display_name ?? null);
  }, []);

  const refresh = useCallback(async () => {
    const {
      data: { session: current },
    } = await supabase.auth.getSession();
    setSession(current);
    if (current?.user) {
      await loadMembership(current.user.id);
    } else {
      setHouseholdId(null);
      setDisplayName(null);
    }
  }, [loadMembership]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadMembership(newSession.user.id);
      } else {
        setHouseholdId(null);
        setDisplayName(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [refresh, loadMembership]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setHouseholdId(null);
    setDisplayName(null);
  }, []);

  return (
    <HouseholdContext.Provider
      value={{ session, loading, householdId, displayName, refresh, signOut }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  return useContext(HouseholdContext);
}
