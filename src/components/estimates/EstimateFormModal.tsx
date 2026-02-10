import { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { Estimate } from '../../types';

interface EstimateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EstimateFormData) => Promise<void>;
  estimate?: Estimate | null;
  defaultCurrency: string;
}

export interface EstimateFormData {
  title: string;
  category: string;
  category_other: string;
  location: string;
  currency: string;
  estimate_class: string;
  timeline_start: string;
  timeline_end: string;
  duration_value: string;
  duration_unit: string;
}

const TENDER_CATEGORIES = [
  'Services',
  'Supply',
  'Works',
  'Others'
];

const MALAYSIAN_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Penang',
  'Perak',
  'Perlis',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
  'Kuala Lumpur',
  'Labuan',
  'Putrajaya'
];

const DURATION_UNITS = ['weeks', 'months', 'years'];

const CURRENCIES = ['MYR', 'USD', 'SGD', 'EUR'];

export default function EstimateFormModal({
  isOpen,
  onClose,
  onSubmit,
  estimate,
  defaultCurrency
}: EstimateFormModalProps) {
  const [formData, setFormData] = useState<EstimateFormData>({
    title: '',
    category: TENDER_CATEGORIES[0],
    category_other: '',
    location: MALAYSIAN_STATES[0],
    currency: defaultCurrency,
    estimate_class: '',
    timeline_start: '',
    timeline_end: '',
    duration_value: '',
    duration_unit: DURATION_UNITS[0]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (estimate) {
      setFormData({
        title: estimate.title,
        category: estimate.category,
        category_other: estimate.category_other || '',
        location: estimate.location,
        currency: estimate.currency,
        estimate_class: estimate.estimate_class,
        timeline_start: estimate.timeline_start || '',
        timeline_end: estimate.timeline_end || '',
        duration_value: estimate.duration_value?.toString() || '',
        duration_unit: estimate.duration_unit || DURATION_UNITS[0]
      });
    } else {
      setFormData({
        title: '',
        category: TENDER_CATEGORIES[0],
        category_other: '',
        location: MALAYSIAN_STATES[0],
        currency: defaultCurrency,
        estimate_class: '',
        timeline_start: '',
        timeline_end: '',
        duration_value: '',
        duration_unit: DURATION_UNITS[0]
      });
    }
    setError('');
  }, [estimate, defaultCurrency, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (formData.category === 'Others' && !formData.category_other.trim()) {
      setError('Please specify the category');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save estimate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof EstimateFormData, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'category' && value !== 'Others') {
        updated.category_other = '';
      }
      return updated;
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={estimate ? 'Edit Estimate' : 'Create New Estimate'}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="estimate-form"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : estimate ? 'Save Changes' : 'Create Estimate'}
          </button>
        </>
      }
    >
      <form id="estimate-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter estimate title"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TENDER_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <select
              id="location"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MALAYSIAN_STATES.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>

        {formData.category === 'Others' && (
          <div>
            <label htmlFor="category_other" className="block text-sm font-medium text-gray-700 mb-1">
              Please specify <span className="text-red-500">*</span>
            </label>
            <input
              id="category_other"
              type="text"
              value={formData.category_other}
              onChange={(e) => handleChange('category_other', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter category specification"
              required={formData.category === 'Others'}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              id="currency"
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CURRENCIES.map(curr => (
                <option key={curr} value={curr}>{curr}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="estimate_class" className="block text-sm font-medium text-gray-700 mb-1">
              Estimate Class
            </label>
            <input
              id="estimate_class"
              type="text"
              value={formData.estimate_class}
              onChange={(e) => handleChange('estimate_class', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., AACE Class 3"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="timeline_start" className="block text-sm font-medium text-gray-700 mb-1">
              Timeline Start
            </label>
            <input
              id="timeline_start"
              type="date"
              value={formData.timeline_start}
              onChange={(e) => handleChange('timeline_start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="timeline_end" className="block text-sm font-medium text-gray-700 mb-1">
              Timeline End
            </label>
            <input
              id="timeline_end"
              type="date"
              value={formData.timeline_end}
              onChange={(e) => handleChange('timeline_end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration
          </label>
          <div className="grid grid-cols-2 gap-4">
            <input
              id="duration_value"
              type="number"
              min="0"
              value={formData.duration_value}
              onChange={(e) => handleChange('duration_value', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter duration"
            />
            <select
              id="duration_unit"
              value={formData.duration_unit}
              onChange={(e) => handleChange('duration_unit', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DURATION_UNITS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
