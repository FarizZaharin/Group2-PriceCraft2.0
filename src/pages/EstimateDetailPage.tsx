import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../components/shared/Toast';
import { db } from '../lib/database';
import { canEditEstimate, canDeleteEstimate, canViewAuditLog } from '../lib/permissions';
import { Estimate, User } from '../types';
import StatusBadge from '../components/estimates/StatusBadge';
import EstimateFormModal, { EstimateFormData } from '../components/estimates/EstimateFormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import OverviewTab from '../components/estimates/OverviewTab';
import SOWTab from '../components/estimates/SOWTab';
import BoQTab from '../components/estimates/BoQTab';
import SummaryTab from '../components/estimates/SummaryTab';
import AuditTab from '../components/estimates/AuditTab';

type TabKey = 'overview' | 'sow' | 'boq' | 'summary' | 'audit';

interface TabDef {
  key: TabKey;
  label: string;
  path: string;
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', path: '' },
  { key: 'sow', label: 'Scope of Work', path: 'sow' },
  { key: 'boq', label: 'Bill of Quantities', path: 'boq' },
  { key: 'summary', label: 'Summary', path: 'summary' },
  { key: 'audit', label: 'Audit Log', path: 'audit' },
];

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [deletingEstimate, setDeletingEstimate] = useState(false);

  useEffect(() => {
    loadEstimate();
  }, [id]);

  const loadEstimate = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const estimateData = await db.estimates.getById(id);
      if (!estimateData) {
        showToast('error', 'Estimate not found');
        navigate('/');
        return;
      }

      setEstimate(estimateData);

      const ownerData = await db.users.getById(estimateData.owner_user_id);
      setOwner(ownerData);
    } catch (error) {
      console.error('Failed to load estimate:', error);
      showToast('error', 'Failed to load estimate');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleEditEstimate = async (data: EstimateFormData) => {
    if (!estimate) return;

    try {
      await db.estimates.update(estimate.id, {
        ...data,
        category_other: data.category === 'Others' ? data.category_other : null,
        timeline_start: data.timeline_start || null,
        timeline_end: data.timeline_end || null,
        duration_value: data.duration_value ? parseInt(data.duration_value) : null,
        duration_unit: data.duration_value ? data.duration_unit : null
      });
      showToast('success', 'Estimate updated successfully');
      setEditingEstimate(false);
      await loadEstimate();
    } catch (error) {
      console.error('Failed to update estimate:', error);
      throw error;
    }
  };

  const handleDeleteEstimate = async () => {
    if (!estimate) return;

    try {
      await db.estimates.delete(estimate.id);
      showToast('success', 'Estimate deleted successfully');
      navigate('/');
    } catch (error) {
      console.error('Failed to delete estimate:', error);
      showToast('error', 'Failed to delete estimate');
    }
  };

  const getActiveTab = (): TabKey => {
    const path = location.pathname;
    if (path.endsWith('/sow')) return 'sow';
    if (path.endsWith('/boq')) return 'boq';
    if (path.endsWith('/summary')) return 'summary';
    if (path.endsWith('/audit')) return 'audit';
    return 'overview';
  };

  const activeTab = getActiveTab();

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'audit') {
      return user && canViewAuditLog(user.role);
    }
    return true;
  });

  const canEdit = estimate && user && canEditEstimate(user.role, estimate.owner_user_id === user.id);
  const canDelete = estimate && user && canDeleteEstimate(user.role, estimate.owner_user_id === user.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading estimate...</div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500 mb-4">Estimate not found</p>
        <Link to="/" className="text-blue-600 hover:text-blue-800">
          Back to estimates
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to estimates
        </Link>

        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{estimate.title}</h1>
              <StatusBadge status={estimate.status} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1">
                <span className="font-medium">Category:</span> {estimate.category === 'Others' && estimate.category_other ? `${estimate.category} (${estimate.category_other})` : estimate.category}
              </span>
              {estimate.location && (
                <span className="inline-flex items-center gap-1">
                  <span className="font-medium">Location:</span> {estimate.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <span className="font-medium">Owner:</span> {owner?.name || 'Unknown'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => setEditingEstimate(true)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setDeletingEstimate(true)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.key}
              to={tab.path ? `/estimates/${id}/${tab.path}` : `/estimates/${id}`}
              className={`pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && <OverviewTab estimate={estimate} owner={owner} />}
      {activeTab === 'sow' && <SOWTab estimate={estimate} />}
      {activeTab === 'boq' && <BoQTab estimate={estimate} />}
      {activeTab === 'summary' && <SummaryTab estimate={estimate} />}
      {activeTab === 'audit' && <AuditTab estimateId={estimate.id} />}

      <EstimateFormModal
        isOpen={editingEstimate}
        onClose={() => setEditingEstimate(false)}
        onSubmit={handleEditEstimate}
        estimate={estimate}
        defaultCurrency={settings.defaultCurrency}
      />

      <ConfirmDialog
        isOpen={deletingEstimate}
        onClose={() => setDeletingEstimate(false)}
        onConfirm={handleDeleteEstimate}
        title="Delete Estimate"
        message={`Are you sure you want to delete "${estimate.title}"? This action cannot be undone and will delete all associated data including SOW versions, BoQ versions, and rows.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
