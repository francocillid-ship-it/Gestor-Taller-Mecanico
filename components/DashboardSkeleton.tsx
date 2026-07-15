
import React from 'react';

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
);

const DashboardSkeleton = () => {
    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 dashboard-skeleton">
            {/* Header / Title */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <Skeleton className="h-[24px] w-28 rounded-md" />
                <div className="flex items-center gap-2 overflow-x-auto flex-nowrap pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide w-full md:w-auto">
                    <Skeleton className="h-[30px] sm:h-[34px] w-[80px] rounded-full flex-shrink-0" />
                    <Skeleton className="h-[30px] sm:h-[34px] w-[100px] rounded-full flex-shrink-0" />
                    <Skeleton className="h-[30px] sm:h-[34px] w-[100px] rounded-full flex-shrink-0" />
                    <Skeleton className="h-[30px] sm:h-[34px] w-[90px] rounded-full flex-shrink-0" />
                </div>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {[...Array(6)].map((_, i) => (
                    <div 
                        key={i} 
                        className="bg-white/40 dark:bg-gray-800/40 backdrop-blur-md border border-white/20 dark:border-gray-700/30 p-4 sm:p-6 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:space-x-4 h-full"
                    >
                        <Skeleton className="h-[36px] w-[36px] sm:h-12 sm:w-12 rounded-xl shrink-0" />
                        <div className="flex-1 space-y-1.5 sm:space-y-2 min-w-0 mt-1 sm:mt-0">
                            <Skeleton className="h-3 w-16 sm:h-4 sm:w-20" />
                            <Skeleton className="h-5 w-20 sm:h-6 sm:w-28" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DashboardSkeleton;
