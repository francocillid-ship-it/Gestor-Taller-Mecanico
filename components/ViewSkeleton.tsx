
import React from 'react';

const Pulse = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
);

/** Generic skeleton for list-based views like Trabajos, Clientes */
const ListSkeleton = () => (
    <div className="space-y-4 animate-in fade-in duration-300">
        {/* Search / Filter bar */}
        <div className="flex gap-2">
            <Pulse className="h-10 flex-1 rounded-lg" />
            <Pulse className="h-10 w-10 rounded-lg" />
        </div>
        {/* Tab bar */}
        <div className="flex gap-2 overflow-hidden">
            <Pulse className="h-8 w-20 rounded-full" />
            <Pulse className="h-8 w-24 rounded-full" />
            <Pulse className="h-8 w-20 rounded-full" />
            <Pulse className="h-8 w-24 rounded-full" />
        </div>
        {/* Cards */}
        {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                    <Pulse className="h-4 w-1/3" />
                    <Pulse className="h-6 w-16 rounded-full" />
                </div>
                <Pulse className="h-3 w-2/3" />
                <Pulse className="h-3 w-1/2" />
            </div>
        ))}
    </div>
);

/** Skeleton for the Settings view */
const SettingsSkeleton = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
        <Pulse className="h-8 w-28" />
        {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm space-y-4">
                <Pulse className="h-5 w-1/3" />
                <Pulse className="h-10 w-full rounded-lg" />
                <Pulse className="h-10 w-full rounded-lg" />
            </div>
        ))}
    </div>
);

/** Skeleton for Finanzas / charts view */
const ChartSkeleton = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center">
            <Pulse className="h-8 w-28" />
            <Pulse className="h-8 w-32 rounded-full" />
        </div>
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm space-y-2">
                    <Pulse className="h-3 w-1/2" />
                    <Pulse className="h-6 w-3/4" />
                </div>
            ))}
        </div>
        {/* Chart placeholder */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
            <Pulse className="h-48 w-full rounded-lg" />
        </div>
    </div>
);

type ViewType = 'dashboard' | 'trabajos' | 'clientes' | 'finanzas' | 'ajustes';

const ViewSkeleton = ({ view }: { view: ViewType }) => {
    switch (view) {
        case 'dashboard':
            // Re-use the existing DashboardSkeleton via dynamic import
            // But for now, a simple list skeleton works fine
            return <ListSkeleton />;
        case 'trabajos':
        case 'clientes':
            return <ListSkeleton />;
        case 'finanzas':
            return <ChartSkeleton />;
        case 'ajustes':
            return <SettingsSkeleton />;
        default:
            return <ListSkeleton />;
    }
};

export default ViewSkeleton;
