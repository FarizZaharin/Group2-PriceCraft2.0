import { useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import type { ParsedCSV } from '../../../lib/csv-parser';
import { parseCSV } from '../../../lib/csv-parser';
import { parseExcelFile, getExcelSheetNames } from '../../../lib/excel-parser';

interface StepUploadProps {
  parsedCSV: ParsedCSV | null;
  setParsedCSV: (csv: ParsedCSV | null) => void;
  fileName: string;
  setFileName: (name: string) => void;
  setFileData?: (data: ArrayBuffer | Blob | null) => void;
  setFileType?: (type: string | null) => void;
}

export default function StepUpload({ parsedCSV, setParsedCSV, fileName, setFileName, setFileData, setFileType }: StepUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [excelSheets, setExcelSheets] = useState<string[] | null>(null);
  const [excelBuffer, setExcelBuffer] = useState<ArrayBuffer | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const isExcelFile = (filename: string) => {
    const lower = filename.toLowerCase();
    return lower.endsWith('.xlsx') || lower.endsWith('.xls');
  };

  const processFile = (file: File) => {
    setParseError(null);
    setExcelSheets(null);
    setExcelBuffer(null);
    setSelectedSheet('');
    setCurrentFile(file);

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setParseError('Only CSV and Excel files are supported. Please upload a .csv, .xlsx, or .xls file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setParseError('File size exceeds 5MB limit.');
      return;
    }

    if (isExcelFile(file.name)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        try {
          const sheets = getExcelSheetNames(buffer);
          if (sheets.length === 0) {
            setParseError('No sheets found in the Excel file.');
            return;
          }
          setExcelBuffer(buffer);
          setExcelSheets(sheets);
          if (sheets.length === 1) {
            setSelectedSheet(sheets[0]);
            parseExcelSheet(buffer, sheets[0], file.name);
          }
        } catch (err) {
          setParseError('Failed to read Excel file. Please check the file format.');
        }
      };
      reader.onerror = () => {
        setParseError('Failed to read file.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const result = parseCSV(text);
          if (result.headers.length === 0) {
            setParseError('No data found in the file. Please check the file contents.');
            return;
          }
          if (result.rows.length === 0) {
            setParseError('File contains headers but no data rows.');
            return;
          }
          if (result.rows.length > 2000) {
            setParseError(`File contains ${result.rows.length} data rows, exceeding the maximum of 2,000.`);
            return;
          }
          setParsedCSV(result);
          setFileName(file.name);
          if (setFileData) setFileData(new Blob([text], { type: 'text/csv' }));
          if (setFileType) setFileType('csv');
        } catch {
          setParseError('Failed to parse CSV file. Please check the file format.');
        }
      };
      reader.onerror = () => {
        setParseError('Failed to read file.');
      };
      reader.readAsText(file);
    }
  };

  const parseExcelSheet = (buffer: ArrayBuffer, sheetName: string, filename: string) => {
    try {
      const result = parseExcelFile(buffer, sheetName);
      if (result.headers.length === 0) {
        setParseError('No data found in the selected sheet. Please check the file contents.');
        return;
      }
      if (result.rows.length === 0) {
        setParseError('Sheet contains headers but no data rows.');
        return;
      }
      if (result.rows.length > 2000) {
        setParseError(`Sheet contains ${result.rows.length} data rows, exceeding the maximum of 2,000.`);
        return;
      }
      setParsedCSV(result);
      setFileName(filename);
      if (setFileData) setFileData(buffer);
      if (setFileType) setFileType('xlsx');
      setExcelSheets(null);
      setExcelBuffer(null);
    } catch (err) {
      setParseError('Failed to parse Excel sheet. Please check the file format.');
    }
  };

  const handleSheetSelect = () => {
    if (excelBuffer && selectedSheet) {
      parseExcelSheet(excelBuffer, selectedSheet, currentFile?.name || 'file.xlsx');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleClear = () => {
    setParsedCSV(null);
    setFileName('');
    setParseError(null);
    setExcelSheets(null);
    setExcelBuffer(null);
    setSelectedSheet('');
    setCurrentFile(null);
    if (setFileData) setFileData(null);
    if (setFileType) setFileType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (parsedCSV) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-sm font-medium text-gray-900">{fileName}</div>
              <div className="text-xs text-gray-500">
                {parsedCSV.headers.length} columns, {parsedCSV.rows.length} data rows
              </div>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {parsedCSV.headers.map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap border-b border-gray-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedCSV.rows.slice(0, 5).map((row, ri) => (
                  <tr key={ri} className="border-b border-gray-100">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                        {cell || <span className="text-gray-300">--</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedCSV.rows.length > 5 && (
            <div className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
              Showing 5 of {parsedCSV.rows.length} rows
            </div>
          )}
        </div>
      </div>
    );
  }

  if (excelSheets && excelSheets.length > 1) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-sm font-medium text-gray-900">{currentFile?.name}</div>
              <div className="text-xs text-gray-500">
                Excel file with {excelSheets.length} sheets
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Select sheet to import:
            </label>
            <select
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select a sheet --</option>
              {excelSheets.map((sheet) => (
                <option key={sheet} value={sheet}>
                  {sheet}
                </option>
              ))}
            </select>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSheetSelect}
                disabled={!selectedSheet}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
          dragOver
            ? 'border-blue-400 bg-blue-50/50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50/30'
        }`}
      >
        <Upload className={`h-8 w-8 mb-3 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-sm font-medium text-gray-700">
          Drop your CSV or Excel file here, or click to browse
        </p>
        <p className="text-xs text-gray-500 mt-1">
          CSV or Excel files, up to 2,000 rows
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileInput}
        className="hidden"
      />

      {parseError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{parseError}</p>
        </div>
      )}
    </div>
  );
}
