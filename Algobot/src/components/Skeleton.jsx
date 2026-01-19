import { motion } from 'framer-motion';

// Skeleton component for loading states
export function Skeleton({ className = '', variant = 'text' }) {
    const baseClass = 'skeleton';

    const variantClasses = {
        text: 'h-4 w-full',
        title: 'h-8 w-3/4',
        card: 'h-32 w-full',
        avatar: 'h-12 w-12 rounded-full',
        chart: 'h-64 w-full',
        row: 'h-12 w-full',
    };

    return (
        <div className={`${baseClass} ${variantClasses[variant]} ${className}`} />
    );
}

// Skeleton Card for StatsCard loading state
export function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <Skeleton variant="text" className="w-24 mb-3" />
                    <Skeleton variant="title" className="w-20 mb-2" />
                    <Skeleton variant="text" className="w-32" />
                </div>
                <Skeleton variant="avatar" />
            </div>
        </div>
    );
}

// Skeleton Chart for chart loading state
export function SkeletonChart() {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <Skeleton variant="text" className="w-48 mb-4" />
            <Skeleton variant="chart" />
        </div>
    );
}

// Skeleton Table Row
export function SkeletonTableRow() {
    return (
        <tr className="border-b border-gray-100">
            <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                    <Skeleton variant="avatar" className="w-10 h-10" />
                    <div className="flex-1">
                        <Skeleton variant="text" className="w-32 mb-1" />
                        <Skeleton variant="text" className="w-20 h-3" />
                    </div>
                </div>
            </td>
            <td className="py-4 px-4"><Skeleton variant="text" className="w-16" /></td>
            <td className="py-4 px-4"><Skeleton variant="text" className="w-16" /></td>
            <td className="py-4 px-4"><Skeleton variant="text" className="w-16" /></td>
            <td className="py-4 px-4"><Skeleton variant="text" className="w-20" /></td>
        </tr>
    );
}

// Full table skeleton
export function SkeletonTable({ rows = 5 }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <th key={i} className="py-3 px-4">
                                <Skeleton variant="text" className="w-20" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <SkeletonTableRow key={i} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Skeleton;
