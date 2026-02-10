import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { GlobalSettings, CategoryRecord, UomRecord, FALLBACK_CATEGORIES, FALLBACK_UOMS } from '../types';
import { adminDb } from '../lib/admin-database';

interface SettingsContextType {
  settings: GlobalSettings;
  categories: CategoryRecord[];
  categoryNames: string[];
  uoms: UomRecord[];
  uomCodes: string[];
  loading: boolean;
  updateSettings: (newSettings: Partial<GlobalSettings>) => void;
  resetSettings: () => void;
  refreshCategories: () => Promise<void>;
  refreshUoms: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  defaultCurrency: 'MYR',
  defaultTaxPercent: 6.0,
  roundingDecimals: 2,
  defaultPrelimsPct: 10.0,
  defaultContingencyPct: 5.0,
  defaultProfitPct: 10.0,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GlobalSettings>(() => {
    const stored = localStorage.getItem('pricecraft_settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
    return DEFAULT_SETTINGS;
  });
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [uoms, setUoms] = useState<UomRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryNames = categories.length > 0
    ? categories.map((c) => c.name)
    : [...FALLBACK_CATEGORIES];

  const uomCodes = uoms.length > 0
    ? uoms.map((u) => u.code)
    : [...FALLBACK_UOMS];

  const loadSettings = useCallback(async () => {
    try {
      const dbSettings = await adminDb.settings.getAll();
      setSettings(dbSettings);
      localStorage.setItem('pricecraft_settings', JSON.stringify(dbSettings));
    } catch {
      const stored = localStorage.getItem('pricecraft_settings');
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const data = await adminDb.categories.getAll(true);
      setCategories(data);
    } catch {
      setCategories([]);
    }
  }, []);

  const loadUoms = useCallback(async () => {
    try {
      const data = await adminDb.uoms.getAll(true);
      setUoms(data);
    } catch {
      setUoms([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadSettings(), loadCategories(), loadUoms()]);
  }, [loadSettings, loadCategories, loadUoms]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await refreshAll();
      setLoading(false);
    };
    init();
  }, [refreshAll]);

  const updateSettings = (newSettings: Partial<GlobalSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('pricecraft_settings', JSON.stringify(updated));
      return updated;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('pricecraft_settings', JSON.stringify(DEFAULT_SETTINGS));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        categories,
        categoryNames,
        uoms,
        uomCodes,
        loading,
        updateSettings,
        resetSettings,
        refreshCategories: loadCategories,
        refreshUoms: loadUoms,
        refreshAll,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
