import { createContext, useContext } from 'react'
import type { AppLanguage } from '@shared/store/ui-store'

/**
 * Minimal, dependency-free i18n. `ar` is the language this app is actually
 * used in today and is fully populated from the existing product copy;
 * `fr`/`en` carry real (if unpolished) translations of the same keys so the
 * RTL/LTR + language-switch mechanism is provably correct now, rather than
 * pretending trilingual coverage is finished.
 */

const resources = {
  ar: {
    nav: {
      dashboard: 'الرئيسية',
      products: 'المنتجات',
      suppliers: 'الموردون والديون',
      customers: 'العملاء',
      purchaseOrders: 'أوامر الشراء',
      invoices: 'الفواتير',
      payments: 'المدفوعات',
      debt: 'الديون',
      reports: 'التقارير',
      notifications: 'الإشعارات',
      settings: 'الإعدادات',
      aiAssistant: 'المساعد الذكي'
    },
    common: {
      search: 'بحث',
      loading: 'جاري التحميل...',
      retry: 'إعادة المحاولة',
      cancel: 'إلغاء',
      save: 'حفظ',
      close: 'إغلاق',
      create: 'إنشاء',
      errorTitle: 'حدث خطأ',
      emptyTitle: 'لا توجد بيانات',
      comingSoonTitle: 'قريباً',
      comingSoonBody: 'هذا القسم قيد التطوير ولم يُبنَ بعد.'
    },
    dashboard: {
      title: 'الرئيسية',
      subtitle: 'ما الذي يحتاج انتباهك اليوم؟',
      stockValue: 'قيمة المخزون',
      totalDebt: 'الديون المستحقة',
      pendingInvoices: 'فواتير معلقة',
      totalProducts: 'المنتجات المسجلة',
      needsAttention: 'يحتاج إلى إجراء',
      whoToCall: 'من يجب الاتصال به',
      purchaseTrend: 'اتجاه المشتريات'
    },
    products: {
      title: 'المنتجات',
      subtitle: 'بحث في المنتجات وإضافة منتجات جديدة',
      addProduct: 'إضافة منتج',
      searchPlaceholder: 'ابحث باسم المنتج بالعربية أو الفرنسية...',
      priceHistory: 'سجل الأسعار'
    },
    suppliers: {
      title: 'الموردون والديون',
      subtitle: 'متابعة أرصدة الموردين وتسجيل المدفوعات',
      searchPlaceholder: 'ابحث باسم المورد...',
      currentBalance: 'الرصيد الحالي',
      recordPayment: 'تسجيل دفعة',
      adjustBalance: 'تسوية الرصيد',
      ledger: 'كشف الحساب',
      aging: 'أعمار الديون'
    },
    invoices: {
      title: 'الفواتير',
      subtitle: 'مراجعة الفواتير المعلقة ومتابعة المعتمدة',
      pendingTab: 'معلقة',
      approvedTab: 'معتمدة',
      submitInvoice: 'رفع صورة الفاتورة',
      createManual: 'فاتورة يدوية',
      review: 'مراجعة',
      approve: 'اعتماد الفاتورة'
    },
    purchaseOrders: {
      title: 'أوامر الشراء',
      subtitle: 'إنشاء ومتابعة أوامر الشراء قبل وصول الفواتير',
      newOrder: 'أمر شراء جديد',
      addItem: 'إضافة صنف'
    },
    customers: {
      title: 'العملاء',
      subtitle: 'إدارة عملاء الجملة، فواتيرهم، ومدفوعاتهم',
      searchPlaceholder: 'ابحث باسم العميل...',
      addCustomer: 'إضافة عميل',
      currentBalance: 'الرصيد الحالي',
      newInvoice: 'فاتورة جديدة',
      recordPayment: 'تسجيل دفعة',
      invoicesTab: 'الفواتير',
      paymentsTab: 'المدفوعات',
      statementTab: 'كشف الحساب',
      reportsTab: 'التقارير',
      previousBalance: 'الرصيد السابق',
      invoiceAmount: 'مبلغ الفاتورة',
      newBalance: 'الرصيد الجديد',
      print: 'طباعة'
    }
  },
  fr: {
    nav: {
      dashboard: 'Tableau de bord',
      products: 'Produits',
      suppliers: 'Fournisseurs et dettes',
      customers: 'Clients',
      purchaseOrders: 'Bons de commande',
      invoices: 'Factures',
      payments: 'Paiements',
      debt: 'Dettes',
      reports: 'Rapports',
      notifications: 'Notifications',
      settings: 'Paramètres',
      aiAssistant: 'Assistant IA'
    },
    common: {
      search: 'Rechercher',
      loading: 'Chargement...',
      retry: 'Réessayer',
      cancel: 'Annuler',
      save: 'Enregistrer',
      close: 'Fermer',
      create: 'Créer',
      errorTitle: "Une erreur s'est produite",
      emptyTitle: 'Aucune donnée',
      comingSoonTitle: 'Bientôt disponible',
      comingSoonBody: "Ce module est en cours de développement."
    },
    dashboard: {
      title: 'Tableau de bord',
      subtitle: "Qu'est-ce qui mérite votre attention aujourd'hui ?",
      stockValue: 'Valeur du stock',
      totalDebt: 'Dettes dues',
      pendingInvoices: 'Factures en attente',
      totalProducts: 'Produits enregistrés',
      needsAttention: 'Nécessite une action',
      whoToCall: 'Qui appeler',
      purchaseTrend: "Tendance des achats"
    },
    products: {
      title: 'Produits',
      subtitle: 'Rechercher et ajouter des produits',
      addProduct: 'Ajouter un produit',
      searchPlaceholder: 'Rechercher un produit en arabe ou français...',
      priceHistory: 'Historique des prix'
    },
    suppliers: {
      title: 'Fournisseurs et dettes',
      subtitle: 'Suivre les soldes fournisseurs et enregistrer les paiements',
      searchPlaceholder: 'Rechercher un fournisseur...',
      currentBalance: 'Solde actuel',
      recordPayment: 'Enregistrer un paiement',
      adjustBalance: 'Ajuster le solde',
      ledger: 'Relevé de compte',
      aging: 'Ancienneté des dettes'
    },
    invoices: {
      title: 'Factures',
      subtitle: 'Examiner les factures en attente et suivre les approuvées',
      pendingTab: 'En attente',
      approvedTab: 'Approuvées',
      submitInvoice: 'Téléverser une photo de facture',
      createManual: 'Facture manuelle',
      review: 'Examiner',
      approve: 'Approuver la facture'
    },
    purchaseOrders: {
      title: 'Bons de commande',
      subtitle: 'Créer et suivre les bons de commande avant réception des factures',
      newOrder: 'Nouveau bon de commande',
      addItem: 'Ajouter un article'
    },
    customers: {
      title: 'Clients',
      subtitle: 'Gérer les clients grossistes, leurs factures et paiements',
      searchPlaceholder: 'Rechercher un client...',
      addCustomer: 'Ajouter un client',
      currentBalance: 'Solde actuel',
      newInvoice: 'Nouvelle facture',
      recordPayment: 'Enregistrer un paiement',
      invoicesTab: 'Factures',
      paymentsTab: 'Paiements',
      statementTab: 'Relevé de compte',
      reportsTab: 'Rapports',
      previousBalance: 'Solde précédent',
      invoiceAmount: 'Montant de la facture',
      newBalance: 'Nouveau solde',
      print: 'Imprimer'
    }
  },
  en: {
    nav: {
      dashboard: 'Dashboard',
      products: 'Products',
      suppliers: 'Suppliers & Debt',
      customers: 'Customers',
      purchaseOrders: 'Purchase Orders',
      invoices: 'Invoices',
      payments: 'Payments',
      debt: 'Debt',
      reports: 'Reports',
      notifications: 'Notifications',
      settings: 'Settings',
      aiAssistant: 'AI Assistant'
    },
    common: {
      search: 'Search',
      loading: 'Loading...',
      retry: 'Retry',
      cancel: 'Cancel',
      save: 'Save',
      close: 'Close',
      create: 'Create',
      errorTitle: 'Something went wrong',
      emptyTitle: 'No data',
      comingSoonTitle: 'Coming soon',
      comingSoonBody: 'This module is still being built.'
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'What needs your attention today?',
      stockValue: 'Stock value',
      totalDebt: 'Debt owed',
      pendingInvoices: 'Pending invoices',
      totalProducts: 'Products tracked',
      needsAttention: 'Needs attention',
      whoToCall: 'Who to call',
      purchaseTrend: 'Purchase trend'
    },
    products: {
      title: 'Products',
      subtitle: 'Search products and add new ones',
      addProduct: 'Add product',
      searchPlaceholder: 'Search by product name (Arabic or French)...',
      priceHistory: 'Price history'
    },
    suppliers: {
      title: 'Suppliers & Debt',
      subtitle: 'Track supplier balances and record payments',
      searchPlaceholder: 'Search by supplier name...',
      currentBalance: 'Current balance',
      recordPayment: 'Record payment',
      adjustBalance: 'Adjust balance',
      ledger: 'Ledger',
      aging: 'Debt aging'
    },
    invoices: {
      title: 'Invoices',
      subtitle: 'Review pending invoices and track approved ones',
      pendingTab: 'Pending',
      approvedTab: 'Approved',
      submitInvoice: 'Upload invoice photo',
      createManual: 'Manual invoice',
      review: 'Review',
      approve: 'Approve invoice'
    },
    purchaseOrders: {
      title: 'Purchase Orders',
      subtitle: 'Create and track purchase orders before invoices arrive',
      newOrder: 'New purchase order',
      addItem: 'Add item'
    },
    customers: {
      title: 'Customers',
      subtitle: 'Manage wholesale customers, their invoices, and payments',
      searchPlaceholder: 'Search by customer name...',
      addCustomer: 'Add customer',
      currentBalance: 'Current balance',
      newInvoice: 'New invoice',
      recordPayment: 'Record payment',
      invoicesTab: 'Invoices',
      paymentsTab: 'Payments',
      statementTab: 'Account statement',
      reportsTab: 'Reports',
      previousBalance: 'Previous balance',
      invoiceAmount: 'Invoice amount',
      newBalance: 'New balance',
      print: 'Print'
    }
  }
} as const

export type TranslationResources = typeof resources.ar
type NavKey = keyof TranslationResources['nav']
type CommonKey = keyof TranslationResources['common']
type DashboardKey = keyof TranslationResources['dashboard']
type ProductsKey = keyof TranslationResources['products']
type SuppliersKey = keyof TranslationResources['suppliers']
type InvoicesKey = keyof TranslationResources['invoices']
type PurchaseOrdersKey = keyof TranslationResources['purchaseOrders']
type CustomersKey = keyof TranslationResources['customers']

export type TranslationKey =
  | `nav.${NavKey}`
  | `common.${CommonKey}`
  | `dashboard.${DashboardKey}`
  | `products.${ProductsKey}`
  | `suppliers.${SuppliersKey}`
  | `invoices.${InvoicesKey}`
  | `purchaseOrders.${PurchaseOrdersKey}`
  | `customers.${CustomersKey}`

export const rtlLanguages: AppLanguage[] = ['ar']

interface I18nContextValue {
  language: AppLanguage
  dir: 'rtl' | 'ltr'
  t: (key: TranslationKey) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export function translate(language: AppLanguage, key: TranslationKey): string {
  const [namespace, leaf] = key.split('.') as [keyof TranslationResources, string]
  const dict = resources[language][namespace] as Record<string, string>
  return dict[leaf] ?? key
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>')
  return ctx
}
