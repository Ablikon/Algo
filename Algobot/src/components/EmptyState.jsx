import { motion } from 'framer-motion';
import { Package, Inbox, SearchX, FileQuestion, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

// Generic Empty State component
export default function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    action = null,
    variant = 'default'
}) {
    const { t } = useLanguage();
    const displayTitle = title || t("noData");
    const displayDescription = description || t("noDataDesc");
    const variants = {
        default: {
            iconBg: 'bg-gray-100',
            iconColor: 'text-gray-400',
        },
        success: {
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-500',
        },
        search: {
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-500',
        },
        warning: {
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-500',
        },
    };

    const style = variants[variant] || variants.default;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 px-4"
        >
            <div className={`w-16 h-16 rounded-2xl ${style.iconBg} flex items-center justify-center mb-4`}>
                <Icon className={`w-8 h-8 ${style.iconColor}`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{displayTitle}</h3>
            <p className="text-gray-500 text-center max-w-sm mb-4">{displayDescription}</p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                >
                    {action.icon && <action.icon className="w-4 h-4" />}
                    {action.label}
                </button>
            )}
        </motion.div>
    );
}

// Pre-configured empty states
export function NoProductsFound({ onReset }) {
    const { t } = useLanguage();
    return (
        <EmptyState
            icon={SearchX}
            title={t("productsNotFound")}
            description={t("tryChangeFilters")}
            variant="search"
            action={onReset ? { label: t("resetFilters"), onClick: onReset } : null}
        />
    );
}

export function NoRecommendations() {
    const { t } = useLanguage();
    return (
        <EmptyState
            icon={CheckCircle2}
            title={t("noRecommendations")}
            description={t("noRecommendationsDesc")}
            variant="success"
        />
    );
}

export function NoDataAvailable() {
    const { t } = useLanguage();
    return (
        <EmptyState
            icon={FileQuestion}
            title={t("dataUnavailable")}
            description={t("uploadDataDesc")}
            variant="default"
        />
    );
}

export function EmptyCategory() {
    const { t } = useLanguage();
    return (
        <EmptyState
            icon={Package}
            title={t("emptyCategoryTitle")}
            description={t("emptyCategoryDesc")}
            variant="default"
        />
    );
}
