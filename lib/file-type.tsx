import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  FileAudio,
  FileVideo,
  Binary,
  File,
  Presentation,
  ImageIcon,
} from 'lucide-react';

export interface FileTypeStyle {
  label: string;
  category: string;
  bgClass: string;
  borderClass: string;
  iconColorClass: string;
  badgeClass: string;
  renderIcon: (className?: string) => React.ReactNode;
}

export function isImageFile(fileName: string, fileType?: string): boolean {
  if (fileType?.toLowerCase().startsWith('image/')) return true;
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
}

export function getFileTypeStyle(fileName: string, fileType?: string): FileTypeStyle {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const label = (ext ? ext.toUpperCase().slice(0, 5) : 'FILE');

  // PDF
  if (ext === 'pdf') {
    return {
      label: 'PDF',
      category: 'pdf',
      bgClass: 'bg-red-50/80 hover:bg-red-100/80',
      borderClass: 'border-red-200/90',
      iconColorClass: 'text-red-500',
      badgeClass: 'bg-red-100/90 text-red-700 border-red-200',
      renderIcon: (cls = 'w-7 h-7 text-red-500 stroke-[1.6]') => <FileText className={cls} />,
    };
  }

  // Word & Documents
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
    return {
      label,
      category: 'word',
      bgClass: 'bg-blue-50/80 hover:bg-blue-100/80',
      borderClass: 'border-blue-200/90',
      iconColorClass: 'text-blue-500',
      badgeClass: 'bg-blue-100/90 text-blue-700 border-blue-200',
      renderIcon: (cls = 'w-7 h-7 text-blue-500 stroke-[1.6]') => <FileText className={cls} />,
    };
  }

  // Excel & Spreadsheets
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return {
      label,
      category: 'spreadsheet',
      bgClass: 'bg-emerald-50/80 hover:bg-emerald-100/80',
      borderClass: 'border-emerald-200/90',
      iconColorClass: 'text-emerald-500',
      badgeClass: 'bg-emerald-100/90 text-emerald-800 border-emerald-200',
      renderIcon: (cls = 'w-7 h-7 text-emerald-500 stroke-[1.6]') => (
        <FileSpreadsheet className={cls} />
      ),
    };
  }

  // PowerPoint & Presentations
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) {
    return {
      label,
      category: 'presentation',
      bgClass: 'bg-orange-50/80 hover:bg-orange-100/80',
      borderClass: 'border-orange-200/90',
      iconColorClass: 'text-orange-500',
      badgeClass: 'bg-orange-100/90 text-orange-800 border-orange-200',
      renderIcon: (cls = 'w-7 h-7 text-orange-500 stroke-[1.6]') => (
        <Presentation className={cls} />
      ),
    };
  }

  // Archives & Compressed
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return {
      label,
      category: 'archive',
      bgClass: 'bg-amber-50/80 hover:bg-amber-100/80',
      borderClass: 'border-amber-200/90',
      iconColorClass: 'text-amber-500',
      badgeClass: 'bg-amber-100/90 text-amber-800 border-amber-200',
      renderIcon: (cls = 'w-7 h-7 text-amber-500 stroke-[1.6]') => (
        <FileArchive className={cls} />
      ),
    };
  }

  // Executables & Binaries
  if (['exe', 'msi', 'dmg', 'apk', 'bin', 'iso', 'deb', 'rpm'].includes(ext)) {
    return {
      label,
      category: 'executable',
      bgClass: 'bg-purple-50/80 hover:bg-purple-100/80',
      borderClass: 'border-purple-200/90',
      iconColorClass: 'text-purple-500',
      badgeClass: 'bg-purple-100/90 text-purple-700 border-purple-200',
      renderIcon: (cls = 'w-7 h-7 text-purple-500 stroke-[1.6]') => <Binary className={cls} />,
    };
  }

  // Code & Data Scripts
  if (
    [
      'js',
      'ts',
      'tsx',
      'jsx',
      'json',
      'html',
      'css',
      'scss',
      'py',
      'java',
      'sql',
      'php',
      'sh',
      'bash',
      'c',
      'cpp',
      'cs',
      'go',
      'rs',
      'rb',
      'yaml',
      'yml',
      'xml',
    ].includes(ext)
  ) {
    return {
      label,
      category: 'code',
      bgClass: 'bg-indigo-50/80 hover:bg-indigo-100/80',
      borderClass: 'border-indigo-200/90',
      iconColorClass: 'text-indigo-500',
      badgeClass: 'bg-indigo-100/90 text-indigo-700 border-indigo-200',
      renderIcon: (cls = 'w-7 h-7 text-indigo-500 stroke-[1.6]') => <FileCode className={cls} />,
    };
  }

  // Audio Files
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes(ext)) {
    return {
      label,
      category: 'audio',
      bgClass: 'bg-pink-50/80 hover:bg-pink-100/80',
      borderClass: 'border-pink-200/90',
      iconColorClass: 'text-pink-500',
      badgeClass: 'bg-pink-100/90 text-pink-700 border-pink-200',
      renderIcon: (cls = 'w-7 h-7 text-pink-500 stroke-[1.6]') => <FileAudio className={cls} />,
    };
  }

  // Video Files
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'wmv'].includes(ext)) {
    return {
      label,
      category: 'video',
      bgClass: 'bg-rose-50/80 hover:bg-rose-100/80',
      borderClass: 'border-rose-200/90',
      iconColorClass: 'text-rose-500',
      badgeClass: 'bg-rose-100/90 text-rose-700 border-rose-200',
      renderIcon: (cls = 'w-7 h-7 text-rose-500 stroke-[1.6]') => <FileVideo className={cls} />,
    };
  }

  // Plain Text & Markdown
  if (['txt', 'md', 'log'].includes(ext)) {
    return {
      label,
      category: 'text',
      bgClass: 'bg-slate-100/80 hover:bg-slate-200/80',
      borderClass: 'border-slate-300/90',
      iconColorClass: 'text-slate-500',
      badgeClass: 'bg-slate-200 text-slate-700 border-slate-300',
      renderIcon: (cls = 'w-7 h-7 text-slate-500 stroke-[1.6]') => <FileText className={cls} />,
    };
  }

  // Image fallback (when thumbnail is not rendered as img)
  if (isImageFile(fileName, fileType)) {
    return {
      label,
      category: 'image',
      bgClass: 'bg-teal-50/80 hover:bg-teal-100/80',
      borderClass: 'border-teal-200/90',
      iconColorClass: 'text-teal-500',
      badgeClass: 'bg-teal-100/90 text-teal-700 border-teal-200',
      renderIcon: (cls = 'w-7 h-7 text-teal-500 stroke-[1.6]') => <ImageIcon className={cls} />,
    };
  }

  // Generic File Fallback
  return {
    label: label || 'FILE',
    category: 'generic',
    bgClass: 'bg-slate-50/80 hover:bg-slate-100/80',
    borderClass: 'border-slate-200/90',
    iconColorClass: 'text-slate-400',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    renderIcon: (cls = 'w-7 h-7 text-slate-400 stroke-[1.6]') => <File className={cls} />,
  };
}

