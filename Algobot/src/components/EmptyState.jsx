import { motion } from 'framer-motion';
import { Package, Inbox, SearchX, FileQuestion, CheckCircle2 } from 'lucide-react';

// Generic Empty State component
export default function EmptyState({
    icon: Icon = Inbox,
    title = 'Нет данных',
    description = 'Данные пока отсутствуют',
    action = null,
    variant = 'default'
}) {
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
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-gray-500 text-center max-w-sm mb-4">{description}</p>
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
    return (
        <EmptyState
            icon={SearchX}
            title="Товары не найдены"
            description="Попробуйте изменить параметры поиска или сбросить фильтры"
            variant="search"
            action={onReset ? { label: 'Сбросить фильтры', onClick: onReset } : null}
        />
    );
}

export function NoRecommendations() {
    return (
        <EmptyState
            icon={CheckCircle2}
            title="Вы лидируете! 🎉"
            description="Нет рекомендаций — все ваши цены уже конкурентоспособны"
            variant="success"
        />
    );
}

export function NoDataAvailable() {
    return (
        <EmptyState
            icon={FileQuestion}
            title="Данные недоступны"
            description="Загрузите данные через раздел 'База данных' для начала работы"
            variant="default"
        />
    );
}

export function EmptyCategory() {
    return (
        <EmptyState
            icon={Package}
            title="Категория пуста"
            description="В этой категории пока нет товаров"
            variant="default"
        />
    );
}
