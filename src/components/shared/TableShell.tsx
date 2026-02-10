import { ReactNode } from 'react';

interface Column {
  key: string;
  label: string;
  width?: string;
}

interface TableShellProps {
  columns: Column[];
  children: ReactNode;
  emptyMessage?: string;
}

export default function TableShell({ columns, children, emptyMessage = 'No data available' }: TableShellProps) {
  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style={{ width: column.width }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function TableRow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={onClick ? 'hover:bg-gray-50 cursor-pointer transition-colors' : ''}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`}>
      {children}
    </td>
  );
}

export function TableEmptyState({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={100} className="px-6 py-12 text-center text-sm text-gray-500">
        {message}
      </td>
    </tr>
  );
}
