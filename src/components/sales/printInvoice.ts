import { format } from 'date-fns';
import { escapeHtml as e } from '@/lib/escape';

interface InvoiceItem {
  id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface InvoicePayload {
  invoice_number: string;
  created_at: string;
  customer_name: string;
  customer_mobile?: string | null;
  payment_method: string;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  total_amount: number;
  items: InvoiceItem[];
}

const paymentLabel = (m: string) =>
  m === 'cash' ? 'নগদ' : m === 'bkash' ? 'বিকাশ' : m === 'nagad' ? 'নগদ (ডিজিটাল)' : 'কার্ড';

export function printInvoice(invoice: InvoicePayload) {
  const win = window.open('', '_blank');
  if (!win) return;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ইনভয়েস ${e(invoice.invoice_number)}</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto}
  h2{text-align:center;margin-bottom:5px}p{margin:2px 0;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:10px 0}
  th,td{border-bottom:1px solid #ddd;padding:5px;font-size:12px;text-align:left}
  th{background:#f5f5f5}.right{text-align:right}.total{font-weight:bold;font-size:14px}
  .divider{border-top:1px dashed #999;margin:10px 0}
  @media print{body{padding:0}}</style></head><body>
  <h2>দুবাই বোরকা হাউজ</h2>
  <p style="text-align:center">ইনভয়েস</p>
  <div class="divider"></div>
  <p><strong>ইনভয়েস নং:</strong> ${e(invoice.invoice_number)}</p>
  <p><strong>তারিখ:</strong> ${e(format(new Date(invoice.created_at), 'dd/MM/yyyy hh:mm a'))}</p>
  <p><strong>গ্রাহক:</strong> ${e(invoice.customer_name)}</p>
  ${invoice.customer_mobile ? `<p><strong>মোবাইল:</strong> ${e(invoice.customer_mobile)}</p>` : ''}
  <p><strong>পেমেন্ট:</strong> ${e(paymentLabel(invoice.payment_method))}</p>
  <table><thead><tr><th>প্রোডাক্ট</th><th class="right">পরিমাণ</th><th class="right">দর</th><th class="right">মোট</th></tr></thead><tbody>
  ${invoice.items.map(i => `<tr><td>${e(i.product_name)}</td><td class="right">${e(i.quantity)}</td><td class="right">৳${e(i.unit_price)}</td><td class="right">৳${e(i.total_price)}</td></tr>`).join('')}
  </tbody></table>
  <div class="divider"></div>
  <p class="right">সাবটোটাল: ৳${e(invoice.subtotal)}</p>
  ${invoice.discount_amount > 0 ? `<p class="right">ডিসকাউন্ট (${e(invoice.discount_percent)}%): -৳${e(invoice.discount_amount)}</p>` : ''}
  <p class="right total">মোট: ৳${e(invoice.total_amount)}</p>
  <div class="divider"></div>
  <p style="text-align:center;font-size:11px;margin-top:20px">ধন্যবাদ! আবার আসবেন।</p>
  </body></html>`;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
  setTimeout(() => win.close(), 500);
}
