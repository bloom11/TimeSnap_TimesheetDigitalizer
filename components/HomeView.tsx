
import React, { useState } from 'react';
import { Smartphone, Monitor, ChevronRight, X, Scan, Zap } from 'lucide-react';

interface HomeViewProps {
  onStart: () => void;
  showModalityModal?: boolean;
  showDataSyncModal?: boolean;
  onSelectLocal?: () => void;
  onSelectHost?: () => void;
  onSelectClient?: () => void;
  onSelectDataSyncHost?: () => void;
  onSelectDataSyncClient?: () => void;
  onSelectManualDataTransfer?: () => void;
  onCancel?: () => void;
  onDataSync?: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ 
    onStart, 
    showModalityModal = false, 
    showDataSyncModal = false,
    onSelectLocal, 
    onSelectHost, 
    onSelectClient, 
    onSelectDataSyncHost,
    onSelectDataSyncClient,
    onSelectManualDataTransfer,
    onCancel,
    onDataSync
}) => {
  const [remoteSelection, setRemoteSelection] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center pt-8 px-4 animate-fade-in">
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white text-center mb-4 leading-tight mt-4">
            Digitize your<br />
            <span className="text-blue-600 dark:text-blue-400">Work Hours</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-center max-w-sm mb-8">
            Scan physical timesheets, extract hours with AI, and sync effortlessly with Excel.
        </p>
        
        <button 
            onClick={onStart}
            className="w-full max-w-xs bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 dark:shadow-blue-900/20 hover:shadow-xl hover:bg-blue-700 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center text-lg gap-2"
        >
            <Scan className="w-6 h-6" />
            Start Digitizing
        </button>

        <button 
            onClick={onDataSync}
            className="w-full max-w-xs mt-4 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold py-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center text-lg gap-2"
        >
            <Zap className="w-6 h-6" />
            Share / Sync Data
        </button>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
            <FeatureCard 
                title="Smart Scan" 
                desc="Uses advanced AI to read handwritten or printed times." 
                icon="📸" 
            />
            <FeatureCard 
                title="Excel Sync" 
                desc="Merge data directly into your company's existing format." 
                icon="📊" 
            />
            <FeatureCard 
                title="History" 
                desc="Access and re-edit your previous scans anytime." 
                icon="↺" 
            />
        </div>

        {/* Modality Selection Modal */}
        {showModalityModal && (
            <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Choose Modality</h2>
                        <button onClick={onCancel} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <div className="p-6">
                        {!remoteSelection ? (
                            <div className="space-y-4">
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 text-center">How would you like to perform the scan today?</p>
                                
                                <button 
                                    onClick={onSelectLocal}
                                    className="w-full flex items-center p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group text-left"
                                >
                                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl mr-5 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                                        <Zap className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Single Device</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Scan and process directly on this device.</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-400" />
                                </button>

                                <button 
                                    onClick={() => setRemoteSelection(true)}
                                    className="w-full flex items-center p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-purple-500 hover:shadow-md transition-all group text-left"
                                >
                                    <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-xl mr-5 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors">
                                        <Smartphone className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Two Devices (Remote)</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Use your phone as a camera for your PC.</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <button 
                                        onClick={() => setRemoteSelection(false)} 
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-4 hover:underline"
                                    >
                                        &larr; Back to device choice
                                    </button>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Identify which device you are using right now.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={onSelectHost}
                                        className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-3xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                                    >
                                        <div className="bg-white dark:bg-slate-700 p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                            <Monitor className="w-10 h-10 text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                                        </div>
                                        <span className="font-bold text-slate-800 dark:text-white">Desktop Station</span>
                                        <span className="text-[10px] text-slate-500 text-center mt-2 leading-tight uppercase tracking-wider">I'm on a computer<br/>waiting for scans</span>
                                    </button>

                                    <button 
                                        onClick={onSelectClient}
                                        className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-3xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                                    >
                                        <div className="bg-white dark:bg-slate-700 p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                            <Smartphone className="w-10 h-10 text-slate-700 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
                                        </div>
                                        <span className="font-bold text-slate-800 dark:text-white">Mobile Scanner</span>
                                        <span className="text-[10px] text-slate-500 text-center mt-2 leading-tight uppercase tracking-wider">I'm on my phone<br/>taking photos</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Data Sync Modal */}
        {showDataSyncModal && (
            <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Data Synchronization</h2>
                        <button onClick={onCancel} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="text-center">
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Choose your role for data synchronization.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={onSelectDataSyncHost}
                                className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-3xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                            >
                                <div className="bg-white dark:bg-slate-700 p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                    <Monitor className="w-10 h-10 text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                                </div>
                                <span className="font-bold text-slate-800 dark:text-white">Host Device</span>
                                <span className="text-[10px] text-slate-500 text-center mt-2 leading-tight uppercase tracking-wider">Generate QR Code<br/>to pair</span>
                            </button>

                            <button 
                                onClick={onSelectDataSyncClient}
                                className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-3xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                            >
                                <div className="bg-white dark:bg-slate-700 p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                    <Smartphone className="w-10 h-10 text-slate-700 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
                                </div>
                                <span className="font-bold text-slate-800 dark:text-white">Client Device</span>
                                <span className="text-[10px] text-slate-500 text-center mt-2 leading-tight uppercase tracking-wider">Scan QR Code<br/>to pair</span>
                            </button>
                        </div>
                        
                        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                            <button 
                                onClick={onSelectManualDataTransfer}
                                className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Export / Import Manually
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

const FeatureCard = ({ title, desc, icon }: { title: string, desc: string, icon: string }) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center">
        <div className="text-3xl mb-3">{icon}</div>
        <h3 className="font-bold text-slate-800 dark:text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
    </div>
);

export default HomeView;
