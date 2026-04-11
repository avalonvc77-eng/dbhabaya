import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ReportData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: Record<string, string | number>;
}

export function ReportDownload({ data }: { data: ReportData }) {
  const downloadCSV = () => {
    const csv = [
      data.headers.join(','),
      ...data.rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    if (data.summary) {
      const summaryLines = Object.entries(data.summary).map(([k, v]) => `"${k}","${v}"`).join('\n');
      const blob = new Blob(['\uFEFF' + csv + '\n\n' + summaryLines], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `${data.title}.csv`);
    } else {
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `${data.title}.csv`);
    }
    toast.success('CSV ডাউনলোড সম্পন্ন');
  };

  const downloadExcel = () => {
    // Generate simple HTML table that Excel can open
    let html = `<html><head><meta charset="utf-8"></head><body>
    <h2>${data.title}</h2>
    <table border="1" cellpadding="5" cellspacing="0">
    <thead><tr>${data.headers.map(h => `<th style="background:#e2e8f0;font-weight:bold">${h}</th>`).join('')}</tr></thead>
    <tbody>${data.rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
    if (data.summary) {
      html += `<br/><table border="1" cellpadding="5"><tbody>${Object.entries(data.summary).map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('')}</tbody></table>`;
    }
    html += '</body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    downloadBlob(blob, `${data.title}.xls`);
    toast.success('Excel ডাউনলোড সম্পন্ন');
  };

  const downloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.title}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}h2{color:#1a1a1a}
    table{width:100%;border-collapse:collapse;margin:15px 0}
    th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}
    th{background:#f0f0f0;font-weight:bold}
    .summary{margin-top:20px;font-size:13px}
    @media print{body{padding:0}}</style></head><body>
    <h2>${data.title}</h2>
    <p style="color:#666;font-size:12px">তারিখ: ${new Date().toLocaleDateString('bn-BD')}</p>
    <table><thead><tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${data.rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    if (data.summary) {
      html += `<div class="summary">${Object.entries(data.summary).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('')}</div>`;
    }
    html += '</body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
    toast.success('PDF প্রিন্ট উইন্ডো খোলা হয়েছে');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><Download className="w-3 h-3 mr-1" />ডাউনলোড</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={downloadCSV}><FileSpreadsheet className="w-4 h-4 mr-2" />CSV ডাউনলোড</DropdownMenuItem>
        <DropdownMenuItem onClick={downloadExcel}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel ডাউনলোড</DropdownMenuItem>
        <DropdownMenuItem onClick={downloadPDF}><FileText className="w-4 h-4 mr-2" />PDF প্রিন্ট</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
