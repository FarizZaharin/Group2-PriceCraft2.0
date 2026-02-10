import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../components/shared/Toast';
import { db } from '../lib/database';
import { canCreateEstimate, canEditEstimate, canDeleteEstimate, canChangeEstimateStatus } from '../lib/permissions';
import { Estimate, EstimateStatus, User } from '../types';
import TableShell, { TableRow, TableCell, TableEmptyState } from '../components/shared/TableShell';
import EstimateFormModal, { EstimateFormData } from '../components/estimates/EstimateFormModal';
import StatusBadge from '../components/estimates/StatusBadge';
import StatusDropdown from '../components/estimates/StatusDropdown';
import ConfirmDialog from '../components/shared/ConfirmDialog';

type SortField = 'title' | 'category' | 'location' | 'owner' | 'status' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

export default function EstimatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | 'All'>('All');
  const [viewFilter, setViewFilter] = useState<'all' | 'mine'>('all');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [deletingEstimate, setDeletingEstimate] = useState<Estimate | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [estimatesData, usersData] = await Promise.all([
        db.estimates.getAll(),
        db.users.getAll()
      ]);
      setEstimates(estimatesData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('error', 'Failed to load estimates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEstimate = async (data: EstimateFormData) => {
    if (!user) return;

    try {
      await db.estimates.createWithDefaults(
        {
          ...data,
          category_other: data.category === 'Others' ? data.category_other : null,
          owner_user_id: user.id,
          timeline_start: data.timeline_start || null,
          timeline_end: data.timeline_end || null,
          duration_value: data.duration_value ? parseInt(data.duration_value) : null,
          duration_unit: data.duration_value ? data.duration_unit : null
        },
        {
          taxPct: settings.defaultTaxPercent,
          prelimsPct: settings.defaultPrelimsPct,
          contingencyPct: settings.defaultContingencyPct,
          profitPct: settings.defaultProfitPct,
          roundingDecimals: settings.roundingDecimals,
        }
      );
      showToast('success', 'Estimate created successfully');
      await loadData();
    } catch (error) {
      console.error('Failed to create estimate:', error);
      throw error;
    }
  };

  const handleEditEstimate = async (data: EstimateFormData) => {
    if (!editingEstimate) return;

    try {
      await db.estimates.update(editingEstimate.id, {
        ...data,
        category_other: data.category === 'Others' ? data.category_other : null,
        timeline_start: data.timeline_start || null,
        timeline_end: data.timeline_end || null,
        duration_value: data.duration_value ? parseInt(data.duration_value) : null,
        duration_unit: data.duration_value ? data.duration_unit : null
      });
      showToast('success', 'Estimate updated successfully');
      setEditingEstimate(null);
      await loadData();
    } catch (error) {
      console.error('Failed to update estimate:', error);
      throw error;
    }
  };

  const handleDeleteEstimate = async () => {
    if (!deletingEstimate) return;

    try {
      await db.estimates.delete(deletingEstimate.id);
      showToast('success', 'Estimate deleted successfully');
      setDeletingEstimate(null);
      await loadData();
    } catch (error) {
      console.error('Failed to delete estimate:', error);
      showToast('error', 'Failed to delete estimate');
    }
  };

  const handleStatusChange = async (estimate: Estimate, newStatus: EstimateStatus) => {
    try {
      await db.estimates.updateStatus(estimate.id, newStatus);
      showToast('success', 'Status updated successfully');
      await loadData();
    } catch (error) {
      console.error('Failed to update status:', error);
      showToast('error', 'Failed to update status');
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  const filteredAndSortedEstimates = useMemo(() => {
    let filtered = estimates;

    if (viewFilter === 'mine' && user) {
      filtered = filtered.filter(est => est.owner_user_id === user.id);
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter(est => est.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(est =>
        est.title.toLowerCase().includes(query) ||
        est.category.toLowerCase().includes(query) ||
        est.location.toLowerCase().includes(query)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (sortField === 'owner') {
        const aOwner = users.find(u => u.id === a.owner_user_id);
        const bOwner = users.find(u => u.id === b.owner_user_id);
        aVal = aOwner?.name || '';
        bVal = bOwner?.name || '';
      } else {
        aVal = a[sortField] || '';
        bVal = b[sortField] || '';
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal > bVal ? 1 : -1)
        : (bVal > aVal ? 1 : -1);
    });

    return sorted;
  }, [estimates, users, user, viewFilter, statusFilter, searchQuery, sortField, sortDirection]);

  const getUserName = (userId: string) => {
    return users.find(u => u.id === userId)?.name || 'Unknown';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const canEdit = (estimate: Estimate) => {
    return user && canEditEstimate(user.role, estimate.owner_user_id === user.id);
  };

  const canDelete = (estimate: Estimate) => {
    return user && canDeleteEstimate(user.role, estimate.owner_user_id === user.id);
  };

  const canChangeStatus = (estimate: Estimate) => {
    return user && canChangeEstimateStatus(user.role, estimate.owner_user_id === user.id);
  };

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'category', label: 'Category', width: '150px' },
    { key: 'location', label: 'Location', width: '150px' },
    { key: 'currency', label: 'Currency', width: '100px' },
    { key: 'owner', label: 'Owner', width: '150px' },
    { key: 'status', label: 'Status', width: '130px' },
    { key: 'updated_at', label: 'Updated', width: '120px' },
    { key: 'actions', label: 'Actions', width: '180px' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading estimates...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your tender cost estimates</p>
        </div>
        {user && canCreateEstimate(user.role) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Estimate
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, category, or location..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={viewFilter}
              onChange={(e) => setViewFilter(e.target.value as 'all' | 'mine')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Estimates</option>
              <option value="mine">My Estimates</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EstimateStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="InReview">In Review</option>
              <option value="Final">Final</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      <TableShell columns={columns}>
        {filteredAndSortedEstimates.length === 0 ? (
          <TableEmptyState
            message={
              searchQuery || statusFilter !== 'All'
                ? 'No estimates match your filters'
                : 'No estimates yet. Create your first estimate to get started.'
            }
          />
        ) : (
          filteredAndSortedEstimates.map((estimate) => (
            <TableRow
              key={estimate.id}
              onClick={() => navigate(`/estimates/${estimate.id}`)}
            >
              <TableCell>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort('title');
                  }}
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800"
                >
                  {estimate.title}
                  {getSortIcon('title')}
                </button>
              </TableCell>
              <TableCell>{estimate.category}</TableCell>
              <TableCell>{estimate.location}</TableCell>
              <TableCell>{estimate.currency}</TableCell>
              <TableCell>{getUserName(estimate.owner_user_id)}</TableCell>
              <TableCell>
                <StatusBadge status={estimate.status} />
              </TableCell>
              <TableCell className="text-gray-500 text-xs">
                {formatDate(estimate.updated_at)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {canEdit(estimate) && (
                    <button
                      onClick={() => setEditingEstimate(estimate)}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit estimate"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete(estimate) && (
                    <button
                      onClick={() => setDeletingEstimate(estimate)}
                      className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete estimate"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {canChangeStatus(estimate) && (
                    <StatusDropdown
                      currentStatus={estimate.status}
                      onStatusChange={(newStatus) => handleStatusChange(estimate, newStatus)}
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableShell>

      <EstimateFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateEstimate}
        defaultCurrency={settings.defaultCurrency}
      />

      <EstimateFormModal
        isOpen={!!editingEstimate}
        onClose={() => setEditingEstimate(null)}
        onSubmit={handleEditEstimate}
        estimate={editingEstimate}
        defaultCurrency={settings.defaultCurrency}
      />

      <ConfirmDialog
        isOpen={!!deletingEstimate}
        onClose={() => setDeletingEstimate(null)}
        onConfirm={handleDeleteEstimate}
        title="Delete Estimate"
        message={`Are you sure you want to delete "${deletingEstimate?.title}"? This action cannot be undone and will delete all associated data including SOW versions, BoQ versions, and rows.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
