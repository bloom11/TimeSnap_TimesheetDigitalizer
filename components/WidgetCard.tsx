import React, { useMemo } from 'react';
import { WidgetConfig } from '../../types';
import { evaluateWidget } from '../../services/widgetEngine';
import { SavedScan, ColumnConfig } from '../../types';

interface WidgetCardProps {
  config: WidgetConfig;
  scan: SavedScan | null;
  constants: Record<string, string | number>;
  columnConfigs: ColumnConfig[];
  onClick?: () => void;
}

export default function WidgetCard({ config, scan, constants, columnConfigs, onClick }: WidgetCardProps) {
  const result = useMemo(() => evaluateWidget(config, scan, constants, columnConfigs), [config, scan, constants, columnConfigs]);

  const { value, formattedValue, targetValue, formattedTarget, percentage } = result;

  const containerStyle = {
    backgroundColor: config.backgroundColor || '#ffffff',
    color: config.textColor || '#1e293b',
    borderColor: config.borderColor || '#e2e8f0',
    borderWidth: config.borderWidth ? `${config.borderWidth}px` : '1px',
    borderRadius: config.borderRadius ? `${config.borderRadius}px` : '16px',
    fontFamily: config.fontFamily || 'Inter, sans-serif',
  };

  const accentColor = config.accentColor || '#3b82f6';

  const renderContent = () => {
    switch (config.style) {
      case 'metric':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-4xl font-bold">{formattedValue}</span>
            {formattedTarget && (
              <span className="text-sm opacity-70 mt-1">Target: {formattedTarget}</span>
            )}
          </div>
        );
      case 'progress_linear':
        return (
          <div className="flex flex-col justify-center h-full space-y-3 w-full px-4">
            <div className="flex justify-between items-end">
              <span className="text-3xl font-bold">{formattedValue}</span>
              {formattedTarget && <span className="text-sm opacity-70">/ {formattedTarget}</span>}
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{ width: `${percentage || 0}%`, backgroundColor: accentColor }}
              />
            </div>
          </div>
        );
      case 'progress_circle':
        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - ((percentage || 0) / 100) * circumference;
        return (
          <div className="flex flex-col items-center justify-center h-full relative">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="opacity-20"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke={accentColor}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold">{formattedValue}</span>
            </div>
          </div>
        );
      case 'hourglass':
        return (
          <div className="flex flex-col items-center justify-center h-full">
             <div className="relative w-16 h-24 border-4 rounded-lg overflow-hidden flex flex-col" style={{ borderColor: config.textColor }}>
                <div className="flex-1 border-b-2" style={{ borderColor: config.textColor }}>
                   <div className="w-full h-full bg-transparent" />
                </div>
                <div className="flex-1 relative">
                   <div 
                     className="absolute bottom-0 left-0 right-0 transition-all duration-1000" 
                     style={{ height: `${percentage || 0}%`, backgroundColor: accentColor }} 
                   />
                </div>
             </div>
             <span className="mt-2 font-bold">{formattedValue}</span>
          </div>
        );
      case 'clock':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center relative" style={{ borderColor: config.textColor }}>
               <div className="w-1 h-8 origin-bottom absolute bottom-1/2" style={{ backgroundColor: accentColor, transform: `rotate(${(value / 60) * 30}deg)` }} />
               <div className="w-1.5 h-6 origin-bottom absolute bottom-1/2" style={{ backgroundColor: config.textColor, transform: `rotate(${(value / 60 / 12) * 360}deg)` }} />
               <div className="w-2 h-2 rounded-full absolute" style={{ backgroundColor: config.textColor }} />
            </div>
            <span className="mt-2 font-bold">{formattedValue}</span>
          </div>
        );
      default:
        return <div>Unknown Style</div>;
    }
  };

  return (
    <div
      onClick={onClick}
      className="relative overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col p-4 h-full"
      style={containerStyle}
    >
      <h3 className="text-sm font-semibold opacity-80 mb-2 truncate">{config.title}</h3>
      <div className="flex-1 flex items-center justify-center">
        {renderContent()}
      </div>
    </div>
  );
}
