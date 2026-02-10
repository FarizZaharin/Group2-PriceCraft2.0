import { EstimateStatus } from '../../types';

interface StatusBadgeProps {
  status: EstimateStatus;
}

const STATUS_STYLES: Record<EstimateStatus, string> = {
  'Draft': 'bg-gray-100 text-gray-800 border-gray-300',
  'InReview': 'bg-amber-100 text-amber-800 border-amber-300',
  'Final': 'bg-green-100 text-green-800 border-green-300',
  'Archived': 'bg-slate-100 text-slate-800 border-slate-300'
};

const STATUS_LABELS: Record<EstimateStatus, string> = {
  'Draft': 'Draft',
  'InReview': 'In Review',
  'Final': 'Final',
  'Archived': 'Archived'
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
