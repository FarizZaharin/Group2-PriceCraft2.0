import { useState, useEffect } from 'react';
import { Clock, ChevronDown, ChevronRight, User as UserIcon } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { db } from '../../lib/database';
import { AuditLog, User } from '../../types';

interface AuditTabProps {
  estimateId: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  freeze: 'Froze',
  duplicate: 'Duplicated',
  status_change: 'Changed status of',
  set_current: 'Set as current',
  accept: 'Accepted',
  reject: 'Rejected',
  ai_generate: 'AI Generated',
  ai_accept_row: 'Accepted AI draft',
  ai_reject_row: 'Rejected AI draft',
  ai_accept_bulk: 'Bulk accepted AI drafts in',
  ai_reject_bulk: 'Bulk rejected AI drafts in',
  ai_scope_analysis: 'Ran AI scope analysis on',
  create_version_via_import: 'Created version via import for',
  import_committed: 'Committed import to',
  export_csv: 'Exported CSV from',
  export_summary_csv: 'Exported summary CSV from',
  export_excel: 'Exported Excel from',
  export_summary_excel: 'Exported summary Excel from',
  export_print: 'Printed',
};

const ENTITY_LABELS: Record<string, string> = {
  estimate: 'Estimate',
  sow_version: 'SOW Version',
  boq_version: 'BoQ Version',
  boq_row: 'BoQ Row',
  addon_config: 'Add-on Config',
  row_comment: 'Comment',
  ai_run: 'AI Run',
};

export default function AuditTab({ estimateId }: AuditTabProps) {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [estimateId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await db.auditLogs.getByEstimateId(estimateId);
      setLogs(data);

      const uniqueUserIds = [...new Set(data.map((l) => l.actor_user_id))];
      const users: Record<string, User> = {};
      for (const uid of uniqueUserIds) {
        const u = await db.users.getById(uid);
        if (u) users[uid] = u;
      }
      setUserMap(users);
    } catch {
      showToast('error', 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionLabel = (log: AuditLog) => {
    const action = ACTION_LABELS[log.action_type] || log.action_type;
    const entity = ENTITY_LABELS[log.entity_type] || log.entity_type;
    return `${action} ${entity}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderSnapshot = (label: string, data: Record<string, unknown> | null) => {
    if (!data || Object.keys(data).length === 0) return null;
    return (
      <div className="mt-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <pre className="mt-1 text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-x-auto text-gray-700 leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-gray-500">Loading audit log...</div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No activity recorded yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Actions taken on this estimate will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-semibold text-gray-900">Activity Log</h3>
          <span className="text-sm text-gray-500">({logs.length} entries)</span>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {logs.map((log, index) => {
          const actor = userMap[log.actor_user_id];
          const isExpanded = expandedLogId === log.id;
          const hasSnapshots =
            (log.before_snapshot && Object.keys(log.before_snapshot).length > 0) ||
            (log.after_snapshot && Object.keys(log.after_snapshot).length > 0);

          return (
            <div key={log.id} className="relative">
              {index < logs.length - 1 && (
                <div className="absolute left-[2.15rem] top-12 bottom-0 w-px bg-gray-200" />
              )}

              <div
                className={`flex gap-3 p-4 px-5 ${hasSnapshots ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
                onClick={() => hasSnapshots && setExpandedLogId(isExpanded ? null : log.id)}
              >
                <div className="shrink-0 mt-0.5">
                  {actor ? (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                      {getInitials(actor.name)}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <UserIcon className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {actor?.name || 'Unknown user'}
                      </span>
                      <span className="text-sm text-gray-600 ml-1.5">
                        {getActionLabel(log)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">{formatDate(log.created_at)}</span>
                      {hasSnapshots && (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )
                      )}
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {log.entity_type}:{log.entity_id.slice(0, 8)}
                  </div>
                </div>
              </div>

              {isExpanded && hasSnapshots && (
                <div className="px-5 pb-4 pl-16">
                  {renderSnapshot('Before', log.before_snapshot)}
                  {renderSnapshot('After', log.after_snapshot)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
