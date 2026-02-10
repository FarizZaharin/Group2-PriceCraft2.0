import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { EstimateStatus } from '../../types';

interface StatusDropdownProps {
  currentStatus: EstimateStatus;
  onStatusChange: (newStatus: EstimateStatus) => Promise<void>;
  disabled?: boolean;
}

const STATUS_TRANSITIONS: Record<EstimateStatus, EstimateStatus[]> = {
  'Draft': ['InReview'],
  'InReview': ['Draft', 'Final'],
  'Final': ['Archived'],
  'Archived': []
};

const STATUS_LABELS: Record<EstimateStatus, string> = {
  'Draft': 'Draft',
  'InReview': 'In Review',
  'Final': 'Final',
  'Archived': 'Archived'
};

export default function StatusDropdown({
  currentStatus,
  onStatusChange,
  disabled = false
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const availableTransitions = STATUS_TRANSITIONS[currentStatus];

  if (availableTransitions.length === 0) {
    return null;
  }

  const handleStatusChange = async (newStatus: EstimateStatus) => {
    setIsUpdating(true);
    try {
      await onStatusChange(newStatus);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isUpdating}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Change Status
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20">
            {availableTransitions.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={isUpdating}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 first:rounded-t-md last:rounded-b-md"
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
