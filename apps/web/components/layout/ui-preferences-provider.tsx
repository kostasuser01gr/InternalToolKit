"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type DensityMode = "comfortable" | "compact";
type QuantumTheme = "violet" | "cyan" | "amber";

type UiPreferencesContextValue = {
  density: DensityMode;
  setDensity: (density: DensityMode) => void;
  quantumTheme: QuantumTheme;
  setQuantumTheme: (theme: QuantumTheme) => void;
  reduceMotion: boolean;
  setReduceMotion: (reduceMotion: boolean) => void;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

type UiPreferencesProviderProps = {
  children: ReactNode;
  initialDensity?: DensityMode;
  initialQuantumTheme?: QuantumTheme;
  initialReduceMotion?: boolean;
};

function UiPreferencesProvider({
  children,
  initialDensity = "comfortable",
  initialQuantumTheme = "violet",
  initialReduceMotion = false,
}: UiPreferencesProviderProps) {
  const [density, setDensity] = useState<DensityMode>(() => {
    if (typeof window === "undefined") {
      return initialDensity;
    }

    const storedDensity = window.localStorage.getItem("ui-density");
    return storedDensity === "compact" || storedDensity === "comfortable"
      ? storedDensity
      : initialDensity;
  });
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === "undefined") {
      return initialReduceMotion;
    }

    const storedMotion = window.localStorage.getItem("ui-reduce-motion");
    return storedMotion === "true" ? true : storedMotion === "false" ? false : initialReduceMotion;
  });
  const [quantumTheme, setQuantumTheme] = useState<QuantumTheme>(() => {
    if (typeof window === "undefined") {
      return initialQuantumTheme;
    }

    const storedTheme = window.localStorage.getItem("ui-quantum-theme");
    return storedTheme === "cyan" || storedTheme === "amber" || storedTheme === "violet"
      ? storedTheme
      : initialQuantumTheme;
  });

  useEffect(() => {
    document.documentElement.dataset.density = density;
    window.localStorage.setItem("ui-density", density);
  }, [density]);

  useEffect(() => {
    document.documentElement.dataset.motion = reduceMotion ? "reduced" : "full";
    window.localStorage.setItem("ui-reduce-motion", String(reduceMotion));
  }, [reduceMotion]);

  useEffect(() => {
    document.documentElement.dataset.quantumTheme = quantumTheme;
    window.localStorage.setItem("ui-quantum-theme", quantumTheme);
  }, [quantumTheme]);

  const value = useMemo(
    () => ({
      density,
      setDensity,
      quantumTheme,
      setQuantumTheme,
      reduceMotion,
      setReduceMotion,
    }),
    [density, quantumTheme, reduceMotion],
  );

  return (
    <UiPreferencesContext.Provider value={value}>
      {children}
    </UiPreferencesContext.Provider>
  );
}

function useUiPreferences() {
  const context = useContext(UiPreferencesContext);

  if (!context) {
    throw new Error("useUiPreferences must be used within UiPreferencesProvider.");
  }

  return context;
}

export { UiPreferencesProvider, useUiPreferences };
