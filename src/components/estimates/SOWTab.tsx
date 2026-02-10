import { useState, useEffect } from 'react';
import { Plus, Clock, Check, FileText, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../shared/Toast';
import { db } from '../../lib/database';
import { canEditEstimate, canUseAI } from '../../lib/permissions';
import { Estimate, SOWVersion } from '../../types';
import Modal from '../shared/Modal';
import ScopeAnalysisPanel from './ai/ScopeAnalysisPanel';

interface SOWTabProps {
  estimate: Estimate;
}

export default function SOWTab({ estimate }: SOWTabProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [versions, setVersions] = useState<SOWVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newSOWText, setNewSOWText] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [showScopeAnalysis, setShowScopeAnalysis] = useState(false);

  const isOwner = user?.id === estimate.owner_user_id;
  const canEdit = user && canEditEstimate(user.role, isOwner);
  const canAI = user && canUseAI(user.role, isOwner);
  const currentVersion = versions.find((v) => v.is_current);
  const hasSOW = currentVersion?.sow_text && currentVersion.sow_text.trim().length > 0;

  useEffect(() => {
    loadVersions();
  }, [estimate.id]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await db.sowVersions.getByEstimateId(estimate.id);
      setVersions(data);
    } catch {
      showToast('error', 'Failed to load SOW versions');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewVersion = () => {
    setNewSOWText(currentVersion?.sow_text || '');
    setShowNewVersionModal(true);
  };

  const getNextVersionLabel = () => {
    if (versions.length === 0) return 'v0.1';
    const latest = versions[0];
    const match = latest.version_label.match(/v(\d+)\.(\d+)/);
    if (match) {
      const minor = parseInt(match[2]) + 1;
      return `v${match[1]}.${minor}`;
    }
    return `v0.${versions.length + 1}`;
  };

  const handleCreateVersion = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await db.sowVersions.create({
        estimate_id: estimate.id,
        version_label: getNextVersionLabel(),
        sow_text: newSOWText,
        created_by_user_id: user.id,
        is_current: true,
      });

      const allVersions = await db.sowVersions.getByEstimateId(estimate.id);
      const newCurrent = allVersions.find((v) => v.is_current);
      if (newCurrent) {
        await db.sowVersions.setCurrent(newCurrent.id, estimate.id);
      }

      showToast('success', 'New SOW version created');
      setShowNewVersionModal(false);
      await loadVersions();
    } catch {
      showToast('error', 'Failed to create SOW version');
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrent = async (versionId: string) => {
    try {
      await db.sowVersions.setCurrent(versionId, estimate.id);
      showToast('success', 'Current SOW version updated');
      await loadVersions();
    } catch {
      showToast('error', 'Failed to update current version');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-gray-500">Loading scope of work...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-semibold text-gray-900">Current Scope of Work</h3>
            {currentVersion && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {currentVersion.version_label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canAI && hasSOW && (
              <button
                onClick={() => setShowScopeAnalysis(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-300 rounded-md hover:bg-teal-100 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Analyze Scope
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleOpenNewVersion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Version
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          {currentVersion && currentVersion.sow_text ? (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-md p-4 border border-gray-100">
                {currentVersion.sow_text}
              </pre>
            </div>
          ) : (
            <div className="text-center py-10">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No scope of work defined yet</p>
              {canEdit && (
                <p className="text-sm text-gray-400 mt-1">
                  Click "New Version" to start writing the scope of work
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <button
          onClick={() => setHistoryExpanded(!historyExpanded)}
          className="flex items-center justify-between w-full p-5 text-left"
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">Version History</h3>
            <span className="text-sm text-gray-500">({versions.length})</span>
          </div>
          {historyExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {historyExpanded && (
          <div className="border-t border-gray-100">
            {versions.length === 0 ? (
              <div className="p-5 text-center text-sm text-gray-500">
                No versions yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`flex items-center justify-between p-4 px-5 ${
                      version.is_current ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 shrink-0">
                        {version.version_label}
                      </span>
                      {version.is_current && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 shrink-0">
                          <Check className="h-3 w-3" />
                          Current
                        </span>
                      )}
                      <span className="text-sm text-gray-500 truncate">
                        {formatDate(version.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!version.is_current && canEdit && (
                        <button
                          onClick={() => handleSetCurrent(version.id)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors px-2 py-1 rounded hover:bg-blue-50"
                        >
                          Set as Current
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showNewVersionModal}
        onClose={() => setShowNewVersionModal(false)}
        title={`New SOW Version (${getNextVersionLabel()})`}
        size="xl"
        footer={
          <>
            <button
              onClick={() => setShowNewVersionModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateVersion}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create Version'}
            </button>
          </>
        }
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scope of Work Text
          </label>
          <textarea
            value={newSOWText}
            onChange={(e) => setNewSOWText(e.target.value)}
            rows={18}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed resize-y"
            placeholder="Describe the full scope of work for this estimate..."
          />
        </div>
      </Modal>

      <ScopeAnalysisPanel
        isOpen={showScopeAnalysis}
        onClose={() => setShowScopeAnalysis(false)}
        sowText={currentVersion?.sow_text || ''}
        category={estimate.category || undefined}
      />
    </div>
  );
}
