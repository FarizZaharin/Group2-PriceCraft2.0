import { Check } from 'lucide-react';

interface ImportStepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export default function ImportStepIndicator({ currentStep, steps }: ImportStepIndicatorProps) {
  return (
    <nav className="mb-6">
      <ol className="flex items-center">
        {steps.map((label, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <li key={label} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap hidden sm:inline ${
                    isCurrent ? 'text-blue-700' : isCompleted ? 'text-emerald-700' : 'text-gray-500'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 transition-colors ${
                    isCompleted ? 'bg-emerald-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
