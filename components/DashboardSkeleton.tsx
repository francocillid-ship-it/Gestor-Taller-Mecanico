
import React from 'react';

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
);

const DashboardSkeleton = () => {
    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
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

            {/* Expenses Section */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-6">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-9 w-32 rounded-lg" />
                </div>

                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex justify-between items-center py-3 border-b dark:border-gray-700 last:border-0">
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-1/4" />
                            </div>
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-5 w-16" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-8 w-8 rounded" />
                                    <Skeleton className="h-8 w-8 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DashboardSkeleton;
