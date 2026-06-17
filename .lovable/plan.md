# কোড পুনর্বিন্যাস পরিকল্পনা

বর্তমানে কিছু পেজ ৪০০–৫৭০ লাইন এবং প্রতিটি পেজে data-fetching, form state, dialog, table, ও business logic একসাথে মিশে আছে। লক্ষ্য — প্রতিটি ফাইল ১৫০ লাইনের নিচে, প্রতিটি কম্পোনেন্টের একটিই দায়িত্ব, এবং পুনঃব্যবহারযোগ্য hooks/components।

## নতুন ফোল্ডার কাঠামো

```text
src/
├── components/
│   ├── common/              নতুন — সকল পেজে পুনঃব্যবহারযোগ্য
│   │   ├── PageHeader.tsx
│   │   ├── DataTable.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingState.tsx
│   │   ├── BranchFilter.tsx
│   │   └── SearchInput.tsx
│   ├── sales/               নতুন
│   │   ├── SalesTable.tsx
│   │   ├── SalesForm.tsx
│   │   ├── CartManager.tsx
│   │   ├── InvoiceDialog.tsx
│   │   └── printInvoice.ts  (pure function, XSS-safe)
│   ├── returns/             নতুন
│   │   ├── ReturnsTable.tsx
│   │   ├── ReturnForm.tsx
│   │   └── ReturnDetailDialog.tsx
│   └── ...                  বিদ্যমান (Product*, AppSidebar, ErrorBoundary)
├── hooks/                   নতুন hooks
│   ├── useSupabaseQuery.ts  generic fetch + loading + error
│   ├── useBranchData.ts     branches + branch scoping
│   ├── useCart.ts           cart state + totals
│   └── useAuth.tsx          বিদ্যমান
└── pages/                   শুধু composition + routing
    ├── Sales.tsx            ৪০১ → ~৮০ লাইন
    ├── SalesReturn.tsx      ৩৫৭ → ~৮০ লাইন
    └── ...
```

## প্রথম পর্ব — Sales ও SalesReturn (এই plan এ)

পরের পর্বে Settings, Transfer, Reports, Products হাত দেওয়া হবে (আলাদা plan এ, কারণ scope বড়)।

### Sales.tsx ভাঙা হবে

| নতুন ফাইল | দায়িত্ব |
|---|---|
| `hooks/useCart.ts` | cart state, addItem, removeItem, totals, validation |
| `components/sales/CartManager.tsx` | product selector + qty input + cart table |
| `components/sales/SalesForm.tsx` | customer info + cart + payment + submit (calls `create_sale` RPC) |
| `components/sales/SalesTable.tsx` | বিক্রয় তালিকা টেবিল |
| `components/sales/InvoiceDialog.tsx` | view + print invoice button |
| `components/sales/printInvoice.ts` | XSS-safe print HTML generator (escapeHtml আগে থেকেই আছে) |
| `pages/Sales.tsx` | শুধু data fetch + dialog state + composition |

### SalesReturn.tsx ভাঙা হবে

| নতুন ফাইল | দায়িত্ব |
|---|---|
| `components/returns/ReturnForm.tsx` | invoice search + item select + submit RPC |
| `components/returns/ReturnsTable.tsx` | রিটার্ন তালিকা |
| `components/returns/ReturnDetailDialog.tsx` | রিটার্ন বিস্তারিত |
| `pages/SalesReturn.tsx` | composition only |

### Shared common components

| ফাইল | ব্যবহার |
|---|---|
| `common/PageHeader.tsx` | শিরোনাম + subtitle + ডান-পাশের actions slot |
| `common/EmptyState.tsx` | icon + text — সকল pages এ duplicate প্যাটার্ন |
| `common/LoadingState.tsx` | "লোড হচ্ছে..." একবার লেখা |
| `common/BranchFilter.tsx` | admin-only branch select dropdown |
| `common/SearchInput.tsx` | icon + input combo |

## কোড-লেভেল নিয়মাবলী

- প্রতিটি নতুন কম্পোনেন্ট strict props interface — কোনো `any` নয়
- Business logic (RPC কল, validation) → hooks বা helper functions; কম্পোনেন্ট শুধু render
- State প্রয়োজনীয় সর্বনিম্ন স্তরে — global lift করব না
- পূর্বের behavior ১০০% সংরক্ষিত — কোনো user-facing পরিবর্তন নেই
- import paths বিদ্যমান alias (`@/components/...`, `@/hooks/...`) মেনে

## প্রভাব

- **পরিবর্তিত:** `src/pages/Sales.tsx`, `src/pages/SalesReturn.tsx`
- **নতুন:** ১৩টি ছোট ফাইল (উপরে তালিকাভুক্ত)
- **অপরিবর্তিত:** database, RPC functions, validation schemas, RLS, routes, UI কাজ
- **ঝুঁকি:** শুধুমাত্র refactor — functional regression না হওয়ার জন্য প্রতিটি ফাইল পুরোনো লজিকের সাথে মিলিয়ে লেখা হবে

## পরবর্তী ধাপ (এই plan-এর বাইরে)

অনুমোদন পেলে পরে আলাদা ছোট plan-এ:
- Settings.tsx (৫৭০ লাইন) → tabs আলাদা ফাইলে
- Transfer.tsx (৪৬৮) → TransferForm + TransferHistory
- Products.tsx (২৪৪) → ProductTable + ProductFilters
- Reports.tsx (৩৩৪) → প্রতিটি report widget আলাদা
