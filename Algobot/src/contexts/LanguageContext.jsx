import { createContext, useContext, useState, useEffect } from "react";

// Translation strings for 3 languages
const translations = {
  ru: {
    // Sidebar
    dashboard: "Дашборд",
    comparison: "Сравнение цен",
    recommendations: "Рекомендации",
    analytics: "Аналитика",
    database: "База данных",
    mappingReview: "Проверка маппинга",
    priceAnalyst: "Ценовой аналитик",
    glovoPartner: "Партнёр Ryadom",
    optimizeForTop1: "Оптимизация для позиции №1",

    // Dashboard
    dashboardTitle: "Дашборд",
    dashboardSubtitle: "Следите за своей позицией на рынке в реальном времени",
    refresh: "Обновить",
    totalProducts: "Всего товаров",
    inAssortment: "В ассортименте",
    top1Position: "Позиция ТОП 1",
    ofCatalog: "нашего каталога",
    needAction: "Требуют действий",
    priceAdjustment: "Нужна корректировка цены",
    missing: "Отсутствуют",
    competitorsOnly: "Только у конкурентов",
    awaitingDecision: "Ожидают решения",
    awaitingActions: "Ожидают действий",
    potentialSavings: "Потенциальная экономия",
    ifApplyAll: "Если применить все",
    marketCoverage: "Покрытие рынка",
    inStock: "Товаров в наличии",
    priceCompetitiveness: "Ценовая конкурентность",
    inTop1: "В позиции ТОП 1",
    statusDistribution: "Распределение статусов товаров",
    marketCoverageComparison: "Сравнение покрытия рынка",
    priceComparison: "Сравнение цен",
    viewAll: "Смотреть все",

    // Comparison
    comparisonTitle: "Сравнение цен",
    comparisonSubtitle: "Сравните цены на всех агрегаторах",
    export: "Экспорт",
    searchProducts: "Поиск товаров...",
    allCategories: "Все категории",
    all: "Все",
    top1: "ТОП 1",
    needActionFilter: "Требуют действий",
    missingFilter: "Отсутствуют",
    showPerUnit: "Показать за кг/л",
    product: "Товар",
    ourPosition: "Наша позиция",
    noProductsFound: "Товары не найдены",
    min: "МИН",
    link: "Ссылка",

    // Recommendations
    recommendationsTitle: "Рекомендации",
    recommendationsSubtitle:
      "AI-рекомендации по ценообразованию для достижения ТОП-1",
    showVisualization: "Показать визуализацию",
    hideVisualization: "Скрыть визуализацию",
    runAlgorithm: "Запустить алгоритм",
    running: "Выполняется...",
    total: "Всего",
    pending: "В ожидании",
    applied: "Применено",
    rejected: "Отклонено",
    lowerPrice: "Сниженная цена",
    addProduct: "Добавить продукт",
    current: "Текущая",
    recommended: "Рекомендуемая",
    notInStock: "Нет в наличии",
    savings: "Экономия",
    minCompetitor: "Мин. у конкурентов",
    lowerBy: "ниже",
    apply: "Применить",
    applying: "Применение...",
    reject: "Отклонить",
    successApplied: "Успешно применено",
    noRecommendations: "Вы лидируете! 🎉",
    noRecommendationsDesc:
      "Нет рекомендаций — все ваши цены уже конкурентоспособны",

    // Priority
    high: "Высокий",
    medium: "Средний",
    low: "Низкий",

    // Analytics
    analyticsTitle: "Аналитика",
    analyticsSubtitle: "Отслеживайте динамику цен и рыночные изменения",
    priceDynamics: "Динамика цен",
    marketShare: "Доля рынка",
    marketGaps: "Пробелы на рынке",

    // Database
    databaseTitle: "База данных",
    databaseSubtitle: "Управление данными о товарах, ценах и агрегаторах",
    import: "Импорт",
    downloadTemplate: "Скачать шаблон",
    products: "Товары",
    prices: "Цены",
    links: "Ссылки",
    categories: "Категории",
    aggregators: "Агрегаторы",
    name: "Название",
    color: "Цвет",
    ourCompany: "Наша компания",
    yes: "Да",
    no: "Нет",
    icon: "Иконка",
    category: "Категория",
    position: "Позиция",
    action: "Действие",
    status: "Статус",
    priority: "Приоритет",
    schema: "Схема",
    tables: "Таблиц",
    totalRecords: "Всего записей",
    records: "записей",

    // Common
    selectAll: "Выбрать все",
    clearSelection: "Снять выделение",
    noData: "Нет данных",
    loading: "Загрузка...",
    error: "Ошибка",
    success: "Успешно",
    cancel: "Отмена",
    save: "Сохранить",
    delete: "Удалить",
    edit: "Редактировать",
    close: "Закрыть",
  },

  en: {
    // Sidebar
    dashboard: "Dashboard",
    comparison: "Price Comparison",
    recommendations: "Recommendations",
    analytics: "Analytics",
    database: "Database",
    mappingReview: "Mapping Review",
    priceAnalyst: "Price Analyst",
    glovoPartner: "Ryadom Partner",
    optimizeForTop1: "Optimize for #1 position",

    // Dashboard
    dashboardTitle: "Dashboard",
    dashboardSubtitle: "Monitor your market position in real-time",
    refresh: "Refresh",
    totalProducts: "Total Products",
    inAssortment: "In assortment",
    top1Position: "TOP 1 Position",
    ofCatalog: "of our catalog",
    needAction: "Need Action",
    priceAdjustment: "Price adjustment needed",
    missing: "Missing",
    competitorsOnly: "Competitors only",
    awaitingDecision: "Awaiting Decision",
    awaitingActions: "Awaiting actions",
    potentialSavings: "Potential Savings",
    ifApplyAll: "If apply all",
    marketCoverage: "Market Coverage",
    inStock: "Products in stock",
    priceCompetitiveness: "Price Competitiveness",
    inTop1: "In TOP 1 position",
    statusDistribution: "Product Status Distribution",
    marketCoverageComparison: "Market Coverage Comparison",
    priceComparison: "Price Comparison",
    viewAll: "View all",

    // Comparison
    comparisonTitle: "Price Comparison",
    comparisonSubtitle: "Compare prices across all aggregators",
    export: "Export",
    searchProducts: "Search products...",
    allCategories: "All categories",
    all: "All",
    top1: "TOP 1",
    needActionFilter: "Need action",
    missingFilter: "Missing",
    showPerUnit: "Show per kg/l",
    product: "Product",
    ourPosition: "Our Position",
    noProductsFound: "No products found",
    min: "MIN",
    link: "Link",

    // Recommendations
    recommendationsTitle: "Recommendations",
    recommendationsSubtitle: "AI-powered pricing recommendations for TOP 1",
    showVisualization: "Show visualization",
    hideVisualization: "Hide visualization",
    runAlgorithm: "Run Algorithm",
    running: "Running...",
    total: "Total",
    pending: "Pending",
    applied: "Applied",
    rejected: "Rejected",
    lowerPrice: "Lower price",
    addProduct: "Add product",
    current: "Current",
    recommended: "Recommended",
    notInStock: "Not in stock",
    savings: "Savings",
    minCompetitor: "Min. competitor",
    lowerBy: "lower",
    apply: "Apply",
    applying: "Applying...",
    reject: "Reject",
    successApplied: "Successfully applied",
    noRecommendations: "You're leading! 🎉",
    noRecommendationsDesc:
      "No recommendations — all your prices are already competitive",

    // Priority
    high: "High",
    medium: "Medium",
    low: "Low",

    // Analytics
    analyticsTitle: "Analytics",
    analyticsSubtitle: "Track price dynamics and market changes",
    priceDynamics: "Price Dynamics",
    marketShare: "Market Share",
    marketGaps: "Market Gaps",

    // Database
    databaseTitle: "Database",
    databaseSubtitle: "Manage products, prices, and aggregators data",
    import: "Import",
    downloadTemplate: "Download template",
    products: "Products",
    prices: "Prices",
    links: "Links",
    categories: "Categories",
    aggregators: "Aggregators",
    name: "Name",
    color: "Color",
    ourCompany: "Our Company",
    yes: "Yes",
    no: "No",
    icon: "Icon",
    category: "Category",
    position: "Position",
    action: "Action",
    status: "Status",
    priority: "Priority",
    schema: "Schema",
    tables: "Tables",
    totalRecords: "Total Records",
    records: "records",

    // Common
    selectAll: "Select all",
    clearSelection: "Clear selection",
    noData: "No data",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
  },

  kz: {
    // Sidebar
    dashboard: "Басқару тақтасы",
    comparison: "Бағаларды салыстыру",
    recommendations: "Ұсыныстар",
    analytics: "Аналитика",
    database: "Дерекқор",
    mappingReview: "Маппинг тексеру",
    priceAnalyst: "Баға талдаушысы",
    glovoPartner: "Glovo серіктесі",
    optimizeForTop1: "№1 позиция үшін оңтайландыру",

    // Dashboard
    dashboardTitle: "Басқару тақтасы",
    dashboardSubtitle: "Нарықтағы позицияңызды нақты уақытта бақылаңыз",
    refresh: "Жаңарту",
    totalProducts: "Барлық тауарлар",
    inAssortment: "Ассортиментте",
    top1Position: "ТОП 1 позиция",
    ofCatalog: "біздің каталогтың",
    needAction: "Әрекет қажет",
    priceAdjustment: "Баға түзетуі қажет",
    missing: "Жоқ",
    competitorsOnly: "Тек бәсекелестерде",
    awaitingDecision: "Шешім күтуде",
    awaitingActions: "Әрекеттер күтуде",
    potentialSavings: "Ықтимал үнемдеу",
    ifApplyAll: "Барлығын қолданса",
    marketCoverage: "Нарық қамтуы",
    inStock: "Қоймада тауарлар",
    priceCompetitiveness: "Бағалық бәсекеге қабілеттілік",
    inTop1: "ТОП 1 позицияда",
    statusDistribution: "Тауар статустарының таралуы",
    marketCoverageComparison: "Нарық қамтуын салыстыру",
    priceComparison: "Бағаларды салыстыру",
    viewAll: "Барлығын көру",

    // Comparison
    comparisonTitle: "Бағаларды салыстыру",
    comparisonSubtitle: "Барлық агрегаторлар бойынша бағаларды салыстырыңыз",
    export: "Экспорт",
    searchProducts: "Тауарларды іздеу...",
    allCategories: "Барлық санаттар",
    all: "Барлығы",
    top1: "ТОП 1",
    needActionFilter: "Әрекет қажет",
    missingFilter: "Жоқ",
    showPerUnit: "Кг/л үшін көрсету",
    product: "Тауар",
    ourPosition: "Біздің позиция",
    noProductsFound: "Тауарлар табылмады",
    min: "МИН",
    link: "Сілтеме",

    // Recommendations
    recommendationsTitle: "Ұсыныстар",
    recommendationsSubtitle: "ТОП-1-ге жету үшін AI баға ұсыныстары",
    showVisualization: "Визуализацияны көрсету",
    hideVisualization: "Визуализацияны жасыру",
    runAlgorithm: "Алгоритмді іске қосу",
    running: "Орындалуда...",
    total: "Барлығы",
    pending: "Күтуде",
    applied: "Қолданылды",
    rejected: "Қабылданбады",
    lowerPrice: "Төмендетілген баға",
    addProduct: "Тауар қосу",
    current: "Ағымдағы",
    recommended: "Ұсынылған",
    notInStock: "Қоймада жоқ",
    savings: "Үнемдеу",
    minCompetitor: "Мин. бәсекелес",
    lowerBy: "төмен",
    apply: "Қолдану",
    applying: "Қолдануда...",
    reject: "Қабылдамау",
    successApplied: "Сәтті қолданылды",
    noRecommendations: "Сіз көшбасшысыз! 🎉",
    noRecommendationsDesc:
      "Ұсыныстар жоқ — барлық бағаларыңыз бәсекеге қабілетті",

    // Priority
    high: "Жоғары",
    medium: "Орта",
    low: "Төмен",

    // Analytics
    analyticsTitle: "Аналитика",
    analyticsSubtitle: "Баға динамикасын және нарық өзгерістерін бақылаңыз",
    priceDynamics: "Баға динамикасы",
    marketShare: "Нарық үлесі",
    marketGaps: "Нарық олқылықтары",

    // Database
    databaseTitle: "Дерекқор",
    databaseSubtitle: "Тауарлар, бағалар және агрегаторлар деректерін басқару",
    import: "Импорт",
    downloadTemplate: "Үлгіні жүктеу",
    products: "Тауарлар",
    prices: "Бағалар",
    links: "Сілтемелер",
    categories: "Санаттар",
    aggregators: "Агрегаторлар",
    name: "Атауы",
    color: "Түсі",
    ourCompany: "Біздің компания",
    yes: "Иә",
    no: "Жоқ",
    icon: "Белгіше",
    category: "Санат",
    position: "Позиция",
    action: "Әрекет",
    status: "Мәртебе",
    priority: "Басымдық",
    schema: "Схема",
    tables: "Кестелер",
    totalRecords: "Барлық жазбалар",
    records: "жазба",

    // Common
    selectAll: "Барлығын таңдау",
    clearSelection: "Таңдауды алып тастау",
    noData: "Деректер жоқ",
    loading: "Жүктелуде...",
    error: "Қате",
    success: "Сәтті",
    cancel: "Болдырмау",
    save: "Сақтау",
    delete: "Жою",
    edit: "Өңдеу",
    close: "Жабу",
  },
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("language") || "ru";
    }
    return "ru";
  });

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations.ru[key] || key;
  };

  const languages = [
    { code: "ru", name: "Русский", flag: "" },
    { code: "en", name: "English", flag: "" },
    { code: "kz", name: "Қазақша", flag: "" },
  ];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export default LanguageContext;
