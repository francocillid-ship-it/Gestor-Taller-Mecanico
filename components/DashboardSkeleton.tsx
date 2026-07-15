
import React from 'react';

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
);

const DashboardSkeleton = () => {
    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 dashboard-skeleton">
            {/* Header / Title */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <Skeleton className="h-8 w-32" />
                <div className="flex gap-2 overflow-hidden">
                    <Skeleton className="h-8 w-20 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-8 w-20 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full hidden sm:block" />
                </div>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:space-x-4 h-full">
                        <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2 min-w-0">
                            <Skeleton className="h-3 w-1/2" />
                            <Skeleton className="h-5 w-3/4" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DashboardSkeleton;
