import { Estimate, User } from '../../types';
import StatusBadge from './StatusBadge';

interface OverviewTabProps {
  estimate: Estimate;
  owner: User | null;
}

export default function OverviewTab({ estimate, owner }: OverviewTabProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Estimate Details</h2>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Title</label>
          <p className="text-gray-900">{estimate.title}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Category</label>
          <p className="text-gray-900">
            {estimate.category === 'Others' && estimate.category_other
              ? `${estimate.category} (${estimate.category_other})`
              : estimate.category}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Location</label>
          <p className="text-gray-900">{estimate.location || 'Not specified'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Currency</label>
          <p className="text-gray-900">{estimate.currency}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Estimate Class</label>
          <p className="text-gray-900">{estimate.estimate_class || 'Not specified'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
          <div>
            <StatusBadge status={estimate.status} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Timeline Start</label>
          <p className="text-gray-900">{formatDate(estimate.timeline_start)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Timeline End</label>
          <p className="text-gray-900">{formatDate(estimate.timeline_end)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Duration</label>
          <p className="text-gray-900">
            {estimate.duration_value && estimate.duration_unit
              ? `${estimate.duration_value} ${estimate.duration_unit}`
              : 'Not specified'}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Owner</label>
          <p className="text-gray-900">{owner?.name || 'Unknown'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Owner Role</label>
          <p className="text-gray-900 capitalize">{owner?.role.replace('_', ' ') || 'Unknown'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Created</label>
          <p className="text-gray-900">{formatDate(estimate.created_at)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Last Updated</label>
          <p className="text-gray-900">{formatDate(estimate.updated_at)}</p>
        </div>
      </div>
    </div>
  );
}
