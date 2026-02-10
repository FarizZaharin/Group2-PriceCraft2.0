import { useState } from 'react';
import { Settings, Percent, Tag, Ruler, FileText, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canManageSettings } from '../lib/permissions';
import GeneralSettings from '../components/settings/GeneralSettings';
import DefaultAddOns from '../components/settings/DefaultAddOns';
import CategoryManager from '../components/settings/CategoryManager';
import UomManager from '../components/settings/UomManager';
import SectionTemplateManager from '../components/settings/SectionTemplateManager';

type SettingsTab = 'general' | 'addons' | 'categories' | 'uoms' | 'templates';

const TABS: { key: SettingsTab; label: string; icon: typeof Settings; adminOnly?: boolean }[] = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'addons', label: 'Default Add-ons', icon: Percent },
  { key: 'categories', label: 'Categories', icon: Tag },
  { key: 'uoms', label: 'Units of Measure', icon: Ruler },
  { key: 'templates', label: 'Section Templates', icon: FileText },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const isAdmin = user && canManageSettings(user.role);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">
          {isAdmin
            ? 'Configure system defaults, categories, units of measure, and templates'
            : 'View system configuration (read-only)'}
        </p>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-4 bg-amber-50 border border-amber-200 rounded-md">
          <Lock className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-800">
            Only administrators can modify settings. You have read-only access.
          </span>
        </div>
      )}

      <div className="flex gap-6">
        <nav className="w-56 shrink-0">
          <div className="sticky top-4 space-y-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'addons' && <DefaultAddOns />}
          {activeTab === 'categories' && <CategoryManager />}
          {activeTab === 'uoms' && <UomManager />}
          {activeTab === 'templates' && <SectionTemplateManager />}
        </div>
      </div>
    </div>
  );
}
