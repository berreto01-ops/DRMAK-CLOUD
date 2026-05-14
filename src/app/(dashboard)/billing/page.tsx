'use client';

import * as React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc, runTransaction } from 'firebase/firestore';
import type { Patient, Supplier, SupplierProduct } from '@/lib/types';
import { Search, Plus, Trash2, Printer, CheckCircle2, CircleDollarSign, Bell, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { 
    AlertCircle, 
    FileText, 
    History, 
    Calendar as CalendarIcon,
    RefreshCcw,
    X
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Edit } from 'lucide-react';


// Define PharmacyItem type based on typical app structure (or adjust if needed)
interface PharmacyItem {
    id: string;
    name: string;
    sellingPrice: number;
    quantity: number;
    rack?: string;
}

interface BillItem {
    id: string; // supplierId_productId
    name: string;
    type: 'procedure' | 'pharmacy' | 'custom';
    price: number;
    qty: number;
    supplierId?: string;
    productId?: string;
}

interface Reimbursement {
    id: string;
    description: string;
    amount: number;
}

const COMMON_PROCEDURES = [
    { id: 'proc-1', name: 'Standard Consultation', price: 1500 },
    { id: 'proc-2', name: 'Follow-up Consultation', price: 1000 },
    { id: 'proc-3', name: 'Laser Hair Removal (Face)', price: 5000 },
    { id: 'proc-4', name: 'HydraFacial', price: 8000 },
    { id: 'proc-5', name: 'Acne Treatment', price: 3000 },
    { id: 'proc-6', name: 'Botox (Per Unit)', price: 500 },
];

interface BillingRecord {
    id: string;
    patientId: string;
    patientName: string;
    patientMobile: string;
    items: BillItem[];
    reimbursements: Reimbursement[];
    subTotal: number;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    discountAmount: number;
    reimbursementTotal: number;
    taxRate: number;
    taxAmount: number;
    grandTotal: number;
    paymentMethod: string;
    timestamp: string;
    status: string;
    editReason?: string;
    dailyInvoiceNumber?: number;
}

export default function BillingPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    // Fetch Data
    const patientsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'patients') : null, [firestore]);
    const suppliersRef = useMemoFirebase(() => firestore ? collection(firestore, 'suppliers') : null, [firestore]);
    const proceduresQuery = useMemoFirebase(() => firestore ? collection(firestore, 'procedures') : null, [firestore]);
    const billingRecordsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'billingRecords') : null, [firestore]);

    const { data: patients } = useCollection<Patient>(patientsQuery);
    const { data: suppliers } = useCollection<Supplier>(suppliersRef);
    const { data: dynamicProcedures } = useCollection<any>(proceduresQuery); // Using any temporarily to avoid circular deps with ProceduresPage
    const { data: billingRecords, isLoading: isBillingLoading } = useCollection<BillingRecord>(billingRecordsQuery);

    const pharmacyItems = React.useMemo(() => {
        if (!suppliers) return [];
        const items: (SupplierProduct & { supplierName: string; supplierId: string })[] = [];
        // Show items from all suppliers that have products
        suppliers
            .forEach(s => {
                s.products?.forEach(p => {
                    items.push({ ...p, supplierName: s.name, supplierId: s.id });
                });
            });
        return items;
    }, [suppliers]);

    // State
    const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
    const [patientSearch, setPatientSearch] = React.useState('');
    const [pharmacySearch, setPharmacySearch] = React.useState('');

    const [billItems, setBillItems] = React.useState<BillItem[]>([]);
    const [reimbursements, setReimbursements] = React.useState<Reimbursement[]>([]);
    const [discountType, setDiscountType] = React.useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = React.useState<number>(0);
    const [paymentMethod, setPaymentMethod] = React.useState<'Cash' | 'Card' | 'Online' | 'Nill' | ''>('');
    const [nilTaxSubMethod, setNilTaxSubMethod] = React.useState<'Cash' | 'Online' | ''>('');
    const [originalBillItems, setOriginalBillItems] = React.useState<BillItem[]>([]);

    const [activeTab, setActiveTab] = React.useState('new-bill');
    const [editingBillId, setEditingBillId] = React.useState<string | null>(null);
    const [editReason, setEditReason] = React.useState('');
    const [billingSearch, setBillingSearch] = React.useState('');
    const [categoryFilter, setCategoryFilter] = React.useState('All');

    // Custom Item Temp State
    const [customName, setCustomName] = React.useState('');
    const [customPrice, setCustomPrice] = React.useState('');

    // Reimbursement Temp State
    const [reimbursementName, setReimbursementName] = React.useState('');
    const [reimbursementAmount, setReimbursementAmount] = React.useState('');

    const filteredPatients = React.useMemo(() => {
        if (!patients || !patientSearch) return [];
        const term = patientSearch.toLowerCase();
        return patients.filter(p =>
            (p.name || '').toLowerCase().includes(term) ||
            (p.mobileNumber || '').includes(term)
        );
    }, [patients, patientSearch]);

    const filteredPharmacyItems = React.useMemo(() => {
        if (!pharmacyItems || !pharmacySearch) return [];
        const term = pharmacySearch.toLowerCase();
        return pharmacyItems
            .filter(p => 
                (p.name || '').toLowerCase().includes(term) ||
                (p.supplierName || '').toLowerCase().includes(term)
            )
            .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim(), undefined, { sensitivity: 'base' }));
    }, [pharmacyItems, pharmacySearch]);

    const addProcedure = (procId: string) => {
        // Check dynamic procedures first, then fallback to common (for legacy support during transition if needed, but we'll prioritize dynamic)
        const procedure = dynamicProcedures?.find(p => p.id === procId) || COMMON_PROCEDURES.find(p => p.id === procId);
        if (procedure) {
            setBillItems(prev => {
                const existing = prev.find(i => i.id === procedure.id);
                if (existing) {
                    return prev.map(i => i.id === procedure.id ? { ...i, qty: i.qty + 1 } : i);
                }
                return [...prev, { id: procedure.id, name: procedure.name, type: 'procedure', price: Number(procedure.price), qty: 1 }];
            });
        }
    };

    const addPharmacyItem = (compoundId: string) => {
        const item = pharmacyItems?.find(p => `${p.supplierId}_${p.id}` === compoundId);
        if (item) {
            if (item.quantity <= 0) {
                toast({ variant: 'destructive', title: 'Out of Stock', description: `${item.name} is currently out of stock.` });
                return;
            }

            setBillItems(prev => {
                const existing = prev.find(i => i.id === compoundId);
                if (existing) {
                    if (existing.qty >= item.quantity) {
                        toast({ variant: 'destructive', title: 'Insufficient Stock', description: `Only ${item.quantity} units of ${item.name} are available.` });
                        return prev;
                    }
                    return prev.map(i => i.id === compoundId ? { ...i, qty: i.qty + 1 } : i);
                }
                return [...prev, { 
                    id: compoundId, 
                    name: item.name, 
                    type: 'pharmacy', 
                    price: Number(item.sellingPrice) || 0, 
                    qty: 1,
                    supplierId: item.supplierId,
                    productId: item.id
                }];
            });
        }
    };

    const addCustomItem = () => {
        if (!customName || !customPrice) return;
        const price = parseFloat(customPrice);
        if (isNaN(price)) return;

        setBillItems(prev => [...prev, {
            id: `custom-${Date.now()}`,
            name: customName,
            type: 'custom',
            price: price,
            qty: 1
        }]);
        setCustomName('');
        setCustomPrice('');
    };

    const removeItem = (id: string) => {
        setBillItems(prev => prev.filter(i => i.id !== id));
    };

    const updateQty = (id: string, delta: number) => {
        setBillItems(prev => {
            const itemToUpdate = prev.find(i => i.id === id);
            if (!itemToUpdate) return prev;

            let newQty = Math.max(1, itemToUpdate.qty + delta);

            // Stock Validation for Pharmacy items
            if (itemToUpdate.type === 'pharmacy') {
                const inventoryItem = pharmacyItems?.find(p => `${p.supplierId}_${p.id}` === id);
                if (inventoryItem && newQty > inventoryItem.quantity) {
                    toast({ variant: 'destructive', title: 'Insufficient Stock', description: `Only ${inventoryItem.quantity} units of ${inventoryItem.name} are available in inventory.` });
                    newQty = inventoryItem.quantity; // Cap at max available
                }
            }

            return prev.map(i => {
                if (i.id === id) {
                    return { ...i, qty: newQty };
                }
                return i;
            });
        });
    };

    const addReimbursement = () => {
        if (!reimbursementName || !reimbursementAmount) return;
        const amount = parseFloat(reimbursementAmount);
        if (isNaN(amount)) return;

        setReimbursements(prev => [...prev, {
            id: `reimb-${Date.now()}`,
            description: reimbursementName,
            amount: amount
        }]);
        setReimbursementName('');
        setReimbursementAmount('');
    };

    const removeReimbursement = (id: string) => {
        setReimbursements(prev => prev.filter(r => r.id !== id));
    };

    const addProcedureReturn = (procId: string) => {
        const procedure = dynamicProcedures?.find(p => p.id === procId) || COMMON_PROCEDURES.find(p => p.id === procId);
        if (procedure) {
            setReimbursements(prev => [...prev, {
                id: `reimb-proc-${Date.now()}`,
                description: procedure.name,
                amount: Number(procedure.price)
            }]);
        }
    };

    const addPharmacyReturn = (itemId: string) => {
        const item = pharmacyItems?.find(p => p.id === itemId);
        if (item) {
            setReimbursements(prev => [...prev, {
                id: `reimb-pharm-${Date.now()}`,
                description: item.name || (item as any).productName || 'Unnamed Item',
                amount: Number(item.sellingPrice) || 0
            }]);
        }
    };

    // Calculations
    const subTotal = billItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // Calculate items eligible for tax: Non-pharmacy procedures, EXCLUDING Consultation
    const taxableItemsSubTotal = billItems
        .filter(i => i.type !== 'pharmacy' && !(i.name || '').toLowerCase().includes('consultation'))
        .reduce((sum, item) => sum + (item.price * item.qty), 0);

    const discountAmount = discountType === 'percentage' ? (subTotal * (discountValue / 100)) : discountValue;
    const reimbursementTotal = reimbursements.reduce((sum, r) => sum + r.amount, 0);

    // Apply discount and reimbursements proportionally to taxable items for accurate net-tax calculation
    const taxableDiscount = discountType === 'percentage' 
        ? (taxableItemsSubTotal * (discountValue / 100)) 
        : (discountValue * (taxableItemsSubTotal / (subTotal || 1)));
        
    const taxableReimbursement = reimbursementTotal * (taxableItemsSubTotal / (subTotal || 1));

    // Taxable amount is strictly the taxable portion after its share of deductions
    const taxableAmount = Math.max(0, taxableItemsSubTotal - taxableDiscount - taxableReimbursement);

    const taxRate = paymentMethod === 'Cash' ? 0.18 : (paymentMethod === 'Card' || paymentMethod === 'Online') ? 0.05 : 0;
    const taxAmount = taxableAmount * taxRate;
    
    // Total cost after all global deductions, plus the tax calculated ONLY on non-pharmacy items
    const totalAfterDeductions = Math.max(0, subTotal - discountAmount - reimbursementTotal);
    const grandTotal = Math.max(0, totalAfterDeductions + taxAmount);

    const getDailyInvoiceNumber = (billId?: string) => {
        if (billId && billingRecords) {
            const existing = billingRecords.find(b => b.id === billId);
            if (existing && existing.dailyInvoiceNumber) return existing.dailyInvoiceNumber;
        }
        if (!billingRecords) return 1;

        // Base the calculation on the timestamp of the record if editing, otherwise today
        let targetDate = new Date();
        if (billId) {
             const existing = billingRecords.find(b => b.id === billId);
             if (existing) targetDate = new Date(existing.timestamp);
        }
        
        const targetDateString = targetDate.toLocaleDateString();
        const daysRecords = billingRecords.filter(b => new Date(b.timestamp).toLocaleDateString() === targetDateString);
        
        const maxNumber = daysRecords.reduce((max, record) => {
            return Math.max(max, record.dailyInvoiceNumber || 0);
        }, 0);

        return maxNumber + 1;
    };

    const handlePrint = (billOverride?: BillingRecord) => {
        // Use override if provided, otherwise use current state
        const itemsToPrint = billOverride ? billOverride.items : billItems;
        const paymentMethodToPrint = billOverride ? billOverride.paymentMethod : paymentMethod;
        const patientToPrintName = billOverride ? billOverride.patientName : selectedPatient?.name || 'Guest';
        const patientToPrintMobile = billOverride ? billOverride.patientMobile : selectedPatient?.mobileNumber || '—';
        const reimbursementsToPrint = billOverride ? (billOverride.reimbursements || []) : reimbursements;
        
        // Calculations for print
        const printSubTotal = billOverride ? billOverride.subTotal : subTotal;
        const printDiscountType = billOverride ? billOverride.discountType : discountType;
        const printDiscountValue = billOverride ? billOverride.discountValue : discountValue;
        const printDiscountAmount = billOverride ? billOverride.discountAmount : discountAmount;
        const printReimbursementTotal = billOverride ? billOverride.reimbursementTotal : reimbursementTotal;
        const printTaxRate = billOverride ? billOverride.taxRate : taxRate;
        const printTaxAmount = billOverride ? billOverride.taxAmount : taxAmount;
        const printGrandTotal = billOverride ? billOverride.grandTotal : grandTotal;
        const printToken = billOverride ? billOverride.dailyInvoiceNumber : getDailyInvoiceNumber(editingBillId || undefined);
        const printDate = billOverride ? new Date(billOverride.timestamp) : new Date();

        if (itemsToPrint.length === 0) {
            toast({ variant: 'destructive', title: 'No Items', description: 'Please add at least one item to the bill before printing.' });
            return;
        }

        if (!paymentMethodToPrint) {
            toast({ variant: 'destructive', title: 'Payment Method Required', description: 'Please select a payment method before printing.' });
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast({ variant: 'destructive', title: 'Popup Blocked', description: 'Please allow popups for this site to print bills.' });
            return;
        }

        // Determine Stamp Layer
        let stampHtml = '';
        
        const itemsRows = itemsToPrint.map(item => `
            <tr>
                <td style="padding:10px 8px; border-bottom:1px solid #eee;">
                    <div style="font-weight:600;">${item.name}</div>
                    <div style="font-size:10px;color:#888;text-transform:uppercase;">${item.type}</div>
                </td>
                <td style="padding:10px 8px; border-bottom:1px solid #eee; text-align:center;">${item.qty}</td>
                <td style="padding:10px 8px; border-bottom:1px solid #eee; text-align:right;">${(item.price * item.qty).toLocaleString()} Rs</td>
            </tr>
        `).join('');

        const reimbursementRows = reimbursementsToPrint.map(r => `
            <tr style="color: #c00;">
                <td style="padding:10px 8px; border-bottom:1px solid #eee;">
                    <div style="font-weight:600;">RETURN: ${r.description}</div>
                    <div style="font-size:10px;text-transform:uppercase;">Reimbursement</div>
                </td>
                <td style="padding:10px 8px; border-bottom:1px solid #eee; text-align:center;">1</td>
                <td style="padding:10px 8px; border-bottom:1px solid #eee; text-align:right;">- ${r.amount.toLocaleString()} Rs</td>
            </tr>
        `).join('');

        const receiptHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Receipt - ${patientToPrintName}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; background: #fff; padding: 32px; max-width: 600px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 20px; position: relative; }
                    .header h1 { font-size: 22px; font-weight: bold; }
                    .header p { color: #555; font-size: 12px; margin-top: 4px; }
                    .receipt-no { position: absolute; top: 0; right: 0; font-size: 14px; font-weight: bold; background: #f0f0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd; }
                    .patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f9f9f9; border: 1px solid #eee; border-radius: 6px; padding: 14px; margin-bottom: 20px; }
                    .patient-grid .label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.05em; }
                    .patient-grid .value { font-weight: 600; margin-top: 2px; }
                    .patient-grid .right { text-align: right; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                    thead tr { border-bottom: 2px solid #333; }
                    thead th { font-size: 11px; text-transform: uppercase; color: #555; padding: 8px; text-align: left; font-weight: 600; }
                    thead th:nth-child(2) { text-align: center; }
                    thead th:nth-child(3) { text-align: right; }
                    .totals { border-top: 2px solid #333; padding-top: 12px; }
                    .totals .row { display: flex; justify-content: space-between; padding: 4px 0; color: #555; }
                    .totals .grand { display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #ccc; margin-top: 8px; font-size: 16px; font-weight: bold; color: #111; }
                    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 16px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="receipt-no">Token: #${printToken || 'N/A'}</div>
                    <h1>SkinSmith Clinic</h1>
                    <p>Payment Receipt</p>
                    <p style="margin-top:6px;">Date: ${printDate.toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                <div class="patient-grid">
                    <div>
                        <div class="label">Patient Name</div>
                        <div class="value">${patientToPrintName}</div>
                    </div>
                    <div class="right">
                        <div class="label">Mobile Number</div>
                        <div class="value">${patientToPrintMobile}</div>
                    </div>
                </div>

                ${stampHtml}

                <table>
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align:center;">Qty</th>
                            <th style="text-align:right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                        ${reimbursementRows}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="row"><span>Subtotal</span><span>${printSubTotal.toLocaleString()} Rs</span></div>
                    ${printDiscountValue > 0 ? `<div class="row"><span>Discount ${printDiscountType === 'percentage' ? `(${printDiscountValue}%)` : ''}</span><span>- ${printDiscountAmount.toLocaleString()} Rs</span></div>` : ''}
                    ${printReimbursementTotal > 0 ? `<div class="row" style="color: #c00;"><span>Reimbursements</span><span>- ${printReimbursementTotal.toLocaleString()} Rs</span></div>` : ''}
                    <div class="row"><span>Tax (${paymentMethodToPrint} - ${(printTaxRate * 100).toFixed(0)}% excl. Pharmacy)</span><span>${printTaxAmount.toLocaleString()} Rs</span></div>
                    <div class="grand"><span>Total Amount</span><span>${printGrandTotal.toLocaleString()} Rs</span></div>
                </div>

                <div class="footer">
                    <p style="font-weight: 600; color: #333; margin-bottom: 4px;">SkinSmith Clinic</p>
                    <p>1st Floor, Lord Trade Centre, 06, F-11 Markaz Islamabad</p>
                    <p>Mobile: +92333 0477704 | Landline: 0518748123</p>
                    <p style="margin-top: 12px; font-weight: bold; color: #333; text-transform: uppercase; letter-spacing: 1px;">No Refund and Exchange Policy</p>
                    <p style="margin-top: 12px; font-style: italic; color: #888;">Thank you for your trust in our services.</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    const updateInventoryStock = async (items: BillItem[], type: 'deduct' | 'return' | 'diff', oldItems: BillItem[] = []) => {
        if (!firestore) return;

        try {
            await runTransaction(firestore, async (transaction) => {
                const pharmacyItems = items.filter(i => i.type === 'pharmacy' && i.supplierId && (i.productId || i.id));
                const oldPharmacyItems = oldItems.filter(i => i.type === 'pharmacy' && i.supplierId && (i.productId || i.id));

                if (pharmacyItems.length === 0 && oldPharmacyItems.length === 0) return;

                // Map of supplierId -> { productId: adjustmentAmount }
                const adjustments: Record<string, Record<string, number>> = {};

                const processItem = (item: BillItem, multiplier: number) => {
                    const sId = item.supplierId!;
                    const pId = item.productId || item.id;
                    if (!adjustments[sId]) adjustments[sId] = {};
                    adjustments[sId][pId] = (adjustments[sId][pId] || 0) + (item.qty * multiplier);
                };

                if (type === 'deduct') {
                    pharmacyItems.forEach(item => processItem(item, 1));
                } else if (type === 'return') {
                    pharmacyItems.forEach(item => processItem(item, -1));
                } else if (type === 'diff') {
                    pharmacyItems.forEach(item => {
                        const oldItem = oldPharmacyItems.find(oi => oi.supplierId === item.supplierId && (oi.productId === item.productId || oi.id === item.id));
                        const oldQty = oldItem ? oldItem.qty : 0;
                        processItem(item, 1); // Add new qty
                        if (oldItem) processItem(oldItem, -1); // Subtract old qty
                    });
                    // Handle items removed completely
                    oldPharmacyItems.forEach(oldItem => {
                        const stillExists = pharmacyItems.find(i => i.supplierId === oldItem.supplierId && (i.productId === oldItem.productId || i.id === oldItem.id));
                        if (!stillExists) processItem(oldItem, -1);
                    });
                }

                // Collect all needed reads
                const supplierDataMap: Record<string, any> = {};
                const pharmacyItemDocs: Record<string, any> = {};

                for (const supplierId of Object.keys(adjustments)) {
                    const supplierDocRef = doc(firestore, 'suppliers', supplierId);
                    const supplierDoc = await transaction.get(supplierDocRef);
                    if (supplierDoc.exists()) {
                        supplierDataMap[supplierId] = supplierDoc.data();
                    }

                    // Also fetch individual pharmacyItems doc (used by POS)
                    for (const productId of Object.keys(adjustments[supplierId])) {
                        const pItemRef = doc(firestore, 'pharmacyItems', productId);
                        const pItemDoc = await transaction.get(pItemRef);
                        if (pItemDoc.exists()) {
                            pharmacyItemDocs[productId] = pItemDoc.data();
                        }
                    }
                }

                // Perform Writes
                for (const supplierId of Object.keys(supplierDataMap)) {
                    const supplierDocRef = doc(firestore, 'suppliers', supplierId);
                    const products = supplierDataMap[supplierId].products || [];
                    const supplierAdjustments = adjustments[supplierId];

                    const updatedProducts = products.map((p: any) => {
                        if (supplierAdjustments[p.id]) {
                            const currentQty = Number(p.quantity) || 0;
                            const adj = Number(supplierAdjustments[p.id]) || 0;
                            return { ...p, quantity: Math.max(0, currentQty - adj) };
                        }
                        return p;
                    });

                    transaction.update(supplierDocRef, { products: updatedProducts });

                    // Sync to pharmacyItems collection
                    for (const productId of Object.keys(supplierAdjustments)) {
                        if (pharmacyItemDocs[productId]) {
                            const currentQty = Number(pharmacyItemDocs[productId].quantity) || 0;
                            const adj = Number(supplierAdjustments[productId]) || 0;
                            transaction.update(doc(firestore, 'pharmacyItems', productId), { 
                                quantity: Math.max(0, currentQty - adj) 
                            });
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Critical Error updating inventory stock:', error);
            throw error;
        }
    };

    const handleSaveBill = async () => {
        if (!firestore || !selectedPatient || billItems.length === 0) return;

        if (!paymentMethod) {
            toast({ variant: 'destructive', title: 'Payment Method Required', description: 'Please select a payment method before saving.' });
            return;
        }

        // Create a comprehensive bill record in a new 'billingRecords' collection
        const billData = {
            patientId: selectedPatient.id,
            patientName: selectedPatient.name,
            patientMobile: selectedPatient.mobileNumber,
            items: billItems,
            reimbursements,
            subTotal,
            discountType,
            discountValue,
            discountAmount,
            reimbursementTotal,
            taxRate,
            taxAmount,
            grandTotal,
            paymentMethod: paymentMethod === 'Nill' ? `Nill (${nilTaxSubMethod})` : paymentMethod,
            timestamp: editingBillId ? (billingRecords?.find(b => b.id === editingBillId)?.timestamp || new Date().toISOString()) : new Date().toISOString(),
            status: 'Paid',
            addedBy: user?.email || 'Unknown',
            ...(editingBillId ? {
                editReason,
                dailyInvoiceNumber: billingRecords?.find(b => b.id === editingBillId)?.dailyInvoiceNumber || getDailyInvoiceNumber(editingBillId)
            } : {
                dailyInvoiceNumber: getDailyInvoiceNumber()
            })
        };

        try {
            if (editingBillId) {
                if (!editReason.trim()) {
                    toast({ variant: 'destructive', title: 'Reason Required', description: 'Please provide a reason for updating this bill.' });
                    return;
                }
                
                // Sync stock for edits by calculating the diff
                await updateInventoryStock(billItems, 'diff', originalBillItems);
                
                await updateDocumentNonBlocking(doc(firestore, 'billingRecords', editingBillId), billData);
                toast({
                    title: 'Bill Updated',
                    description: 'The bill and inventory have been successfully updated.',
                });
                setEditingBillId(null);
                setOriginalBillItems([]);
            } else {
                // Deduct stock for new pharmacy items
                await updateInventoryStock(billItems, 'deduct');

                await addDocumentNonBlocking(collection(firestore, 'billingRecords'), billData);
                toast({
                    title: 'Bill Saved',
                    description: 'The bill has been saved and inventory updated.',
                });
            }
            
            // Reset state
            handleClear();
        } catch (error) {
            console.error('Save failed:', error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'Could not update inventory or save the bill. Please try again.',
            });
        }
    };

    const handleClear = () => {
        setSelectedPatient(null);
        setBillItems([]);
        setReimbursements([]);
        setDiscountValue(0);
        setPaymentMethod('');
        setNilTaxSubMethod('');
        setEditingBillId(null);
        setOriginalBillItems([]);
        setEditReason('');
    };

    const handleEditBill = (bill: BillingRecord) => {
        const patient = patients?.find(p => p.id === bill.patientId);
        if (patient) {
            setSelectedPatient(patient);
        } else {
            // Minimal patient object if not found in current collection
            setSelectedPatient({ id: bill.patientId, name: bill.patientName, mobileNumber: bill.patientMobile } as any);
        }

        setBillItems(bill.items);
        setOriginalBillItems(JSON.parse(JSON.stringify(bill.items))); // Deep copy for comparison
        setReimbursements(bill.reimbursements || []);
        setDiscountType(bill.discountType);
        setDiscountValue(bill.discountValue);
        if (bill.paymentMethod.startsWith('Nill')) {
            setPaymentMethod('Nill');
            const sub = bill.paymentMethod.match(/\((.*?)\)/)?.[1];
            setNilTaxSubMethod(sub as any || '');
        } else {
            setPaymentMethod(bill.paymentMethod as any);
            setNilTaxSubMethod('');
        }
        setEditingBillId(bill.id);
        setEditReason(''); // Clear any previous reason
        setActiveTab('new-bill');
        toast({ title: 'Editing Bill', description: `Now editing bill for ${bill.patientName}` });
    };

    const handleDeleteBill = async (billId: string) => {
        if (!firestore || !window.confirm('Are you sure you want to delete this billing record?')) return;
        try {
            const billToDelete = billingRecords?.find(b => b.id === billId);
            if (billToDelete) {
                // Return stock before deleting
                await updateInventoryStock(billToDelete.items, 'return');
            }
            
            await deleteDocumentNonBlocking(doc(firestore, 'billingRecords', billId));
            toast({ title: 'Bill Deleted', description: 'The record has been permanently removed and stock restored.' });
        } catch (error) {
            console.error('Delete failed:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete record or update inventory.' });
        }
    };

    const handleMarkAsPaid = async (billId: string) => {
        if (!firestore) return;
        try {
            await updateDocumentNonBlocking(doc(firestore, 'billingRecords', billId), {
                status: 'Paid',
                paymentMethod: 'Cash', // Default to cash if marked paid later, or could prompt for this
                editReason: 'Marked as Paid from Invoices list'
            });
            toast({ title: 'Payment Marked', description: 'The bill has been successfully marked as Paid.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update payment status.' });
        }
    };

    const filteredRecords = React.useMemo(() => {
        if (!billingRecords) return [];
        const term = billingSearch.toLowerCase();
        
        let filtered = billingRecords.filter(b => 
            (b.patientName || '').toLowerCase().includes(term) ||
            (b.patientMobile || '').includes(term) ||
            (b.id || '').toLowerCase().includes(term)
        );

        if (categoryFilter !== 'All') {
            filtered = filtered.filter(b => {
                const types = new Set(b.items.map(i => i.type));
                
                if (categoryFilter === 'Consultation') {
                    return types.has('procedure') && !types.has('pharmacy') && !types.has('custom') && b.items.every(i => (i.name || '').toLowerCase().includes('consultation'));
                }
                if (categoryFilter === 'Procedure') {
                    return types.has('procedure') && !types.has('pharmacy') && !types.has('custom') && b.items.some(i => !(i.name || '').toLowerCase().includes('consultation'));
                }
                if (categoryFilter === 'Pharmacy') {
                    return types.has('pharmacy') && !types.has('procedure') && !types.has('custom');
                }
                if (categoryFilter === 'Mixed') {
                    return (types.has('pharmacy') && types.has('procedure')) || types.has('custom');
                }
                return true;
            });
        }

        return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [billingRecords, billingSearch, categoryFilter]);

    return (
        <div className="flex flex-col h-full p-4 space-y-6">
            <div className="flex justify-between items-center bg-background p-4 rounded-xl border border-dashed shadow-sm">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <CircleDollarSign className="h-6 w-6 text-primary" /> Billing & Invoicing
                    </h2>
                    <p className="text-muted-foreground text-sm">Manage patient billing, generate invoices and track payment history.</p>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="new-bill" className="gap-2"><Plus className="h-4 w-4" /> New Bill</TabsTrigger>
                        <TabsTrigger value="all-invoices" className="gap-2"><History className="h-4 w-4" /> All Invoices</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                <TabsContent value="new-bill" className="flex-1 mt-0 outline-none">
                    <div className="flex flex-col md:flex-row gap-6 h-full print:p-0">
                        {/* LEFT COLUMN: CONTROLS (Hidden when printing) */}
                        <div className="w-full md:w-1/2 lg:w-[45%] flex flex-col gap-6 print:hidden">
                            {editingBillId && (
                                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                                                <RefreshCcw className="h-4 w-4 text-primary animate-spin-slow" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-primary">Editing Existing Bill</p>
                                                <p className="text-xs text-primary/70">Changes will overwrite the original record.</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={handleClear} className="text-primary hover:bg-primary/20"><X className="h-4 w-4 mr-1"/> Cancel</Button>
                                    </div>
                                    <div className="space-y-1.5 border-t border-primary/10 pt-3">
                                        <Label className="text-xs font-bold text-primary flex items-center gap-1.5">
                                            <AlertCircle className="h-3 w-3" /> Reason for Update <span className="text-red-500">*</span>
                                        </Label>
                                        <Input 
                                            placeholder="Enter reason for modification (required)..." 
                                            className="h-9 border-primary/20 bg-background/50 text-sm focus-visible:ring-primary"
                                            value={editReason}
                                            onChange={(e) => setEditReason(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                {/* Patient Selection */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2"><Search className="h-4 w-4" /> Patient Selection</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {selectedPatient ? (
                            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                                <div>
                                    <p className="font-semibold">{selectedPatient.name}</p>
                                    <p className="text-xs text-muted-foreground">{selectedPatient.mobileNumber}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>Change</Button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or number..."
                                    className="pl-9"
                                    value={patientSearch}
                                    onChange={(e) => setPatientSearch(e.target.value)}
                                />
                                {patientSearch && filteredPatients.length > 0 && (
                                    <div className="absolute top-11 left-0 right-0 bg-background border rounded-md shadow-lg z-10 max-h-[200px] overflow-y-auto">
                                        {filteredPatients.map(p => (
                                            <div
                                                key={p.id}
                                                className="p-3 hover:bg-muted cursor-pointer border-b last:border-0"
                                                onClick={() => {
                                                    setSelectedPatient(p);
                                                    setPatientSearch('');
                                                }}
                                            >
                                                <p className="font-semibold text-sm">{p.name}</p>
                                                <p className="text-xs text-muted-foreground">{p.mobileNumber}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Item Addition — locked until patient is selected */}
                <Card className="flex-1">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        {/* Lock Banner */}
                        {!selectedPatient && (
                            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 mb-2">
                                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                                    <Search className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Patient Required</p>
                                    <p className="text-xs text-amber-700 dark:text-amber-400">Please search and select a patient above before adding items to the bill.</p>
                                </div>
                            </div>
                        )}

                        <div className={`space - y - 4 transition - opacity duration - 200 ${!selectedPatient ? 'opacity-40 pointer-events-none select-none' : ''} `}>

                            <div className="space-y-1.5">
                                <Select onValueChange={(value: any) => {
                                    setPaymentMethod(value);
                                    if (value !== 'Nill') setNilTaxSubMethod('');
                                }} value={paymentMethod} disabled={!selectedPatient}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select payment method..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">Cash (18% Tax — Consultation 0%)</SelectItem>
                                        <SelectItem value="Card">Card Payment (5% Tax — Consultation 0%)</SelectItem>
                                        <SelectItem value="Nill">Complementary (No Collection - 0% Tax)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {paymentMethod === 'Nill' && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-xs font-bold text-primary">Track Nill Collection As:</Label>
                                    <Select onValueChange={(value: any) => setNilTaxSubMethod(value)} value={nilTaxSubMethod}>
                                        <SelectTrigger className="h-9 border-primary/30">
                                            <SelectValue placeholder="Select sub-method..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Cash">Physical Cash</SelectItem>
                                            <SelectItem value="Online">Online Transfer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground italic">Required to balance your daily cash-in-hand reports.</p>
                                </div>
                            )}

                            <Separator className="my-2" />

                            <div className="space-y-1.5">
                                <Label>Procedures</Label>
                                <Select onValueChange={addProcedure} value="" disabled={!selectedPatient}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a procedure..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* Render dynamic procedures first */}
                                        {dynamicProcedures && dynamicProcedures.length > 0 ? (
                                            [...dynamicProcedures]
                                                .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim(), undefined, { sensitivity: 'base' }))
                                                .map(p => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.name} - {p.price} Rs
                                                    </SelectItem>
                                                ))
                                        ) : (
                                            /* Fallback to common if empty */
                                            [...COMMON_PROCEDURES]
                                                .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim(), undefined, { sensitivity: 'base' }))
                                                .map(p => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.name} - {p.price} Rs
                                                    </SelectItem>
                                                ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-1.5 relative">
                                <Label>Pharmacy Items</Label>
                                <div className="relative" tabIndex={-1}>
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search pharmacy item..."
                                        className="pl-9 peer"
                                        value={pharmacySearch}
                                        onChange={(e) => setPharmacySearch(e.target.value)}
                                        disabled={!selectedPatient}
                                    />
                                    {/* Using CSS peer-focus to show the dropdown, combined with hover on the dropdown itself to keep it open when interacting with it */}
                                    <div className="absolute top-11 left-0 right-0 bg-background border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto hidden peer-focus:block hover:block">
                                        {filteredPharmacyItems.length > 0 ? (
                                            filteredPharmacyItems.map(p => (
                                                <div
                                                    key={`${p.supplierId}_${p.id}`}
                                                    className="p-3 hover:bg-muted cursor-pointer border-b last:border-0"
                                                    onMouseDown={(e) => {
                                                        // use onMouseDown instead of onClick to fire BEFORE the input's onBlur happens
                                                        e.preventDefault(); 
                                                        addPharmacyItem(`${p.supplierId}_${p.id}`);
                                                        setPharmacySearch('');
                                                    }}
                                                >
                                                    <p className="font-semibold text-sm">{p.rack ? `[Rack ${p.rack}] ` : ''}{p.name}</p>
                                                    <p className="text-xs text-muted-foreground">Supplier: {p.supplierName} | Price: {p.sellingPrice} Rs | Stock: {p.quantity}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-sm text-muted-foreground">
                                                No matching items found.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Separator className="my-4" />

                            <div className="space-y-1.5">
                                <Label>Custom Item</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Description"
                                        className="flex-1"
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                        disabled={!selectedPatient}
                                    />
                                    <Input
                                        placeholder="Price (Rs)"
                                        type="number"
                                        className="w-24"
                                        value={customPrice}
                                        onChange={e => setCustomPrice(e.target.value)}
                                        disabled={!selectedPatient}
                                    />
                                    <Button variant="secondary" onClick={addCustomItem} disabled={!selectedPatient}>Add</Button>
                                </div>
                            </div>

                            {/* Flexible Discount Selector */}
                            <div className="space-y-1.5 pt-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <CircleDollarSign className="h-3 w-3" /> Set Bill Discount
                                </Label>
                                <Tabs defaultValue="percentage" value={discountType} onValueChange={(v: any) => {
                                    setDiscountType(v);
                                    setDiscountValue(0);
                                }}>
                                    <TabsList className="grid w-full grid-cols-2 h-8">
                                        <TabsTrigger value="percentage" className="text-[10px]">Percentage %</TabsTrigger>
                                        <TabsTrigger value="fixed" className="text-[10px]">Fixed Rs</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="percentage" className="mt-1.5">
                                        <div className="flex items-center justify-between p-2 border border-dashed rounded-md bg-muted/30">
                                            <div className="text-[10px] text-muted-foreground">Apply % discount</div>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    className="h-7 w-16 text-right text-xs font-bold"
                                                    value={discountValue || ''}
                                                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                                                    placeholder="0"
                                                    disabled={!selectedPatient}
                                                    min="0"
                                                    max="100"
                                                />
                                                <span className="font-bold text-sm text-muted-foreground">%</span>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="fixed" className="mt-1.5">
                                        <div className="flex items-center justify-between p-2 border border-dashed rounded-md bg-muted/30">
                                            <div className="text-[10px] text-muted-foreground">Apply flat discount (Rs)</div>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    className="h-7 w-20 text-right text-xs font-bold"
                                                    value={discountValue || ''}
                                                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                                                    placeholder="0"
                                                    disabled={!selectedPatient}
                                                    min="0"
                                                />
                                                <span className="font-bold text-[10px] text-muted-foreground">Rs</span>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>

                            <Separator className="my-2" />

                            {/* Bill Reimbursement Section */}
                            <div className="space-y-2 pt-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-red-600 flex items-center gap-2">
                                    <Trash2 className="h-3 w-3" /> Bill Reimbursement / Returns
                                </Label>
                                <div className="space-y-2 bg-red-50/50 dark:bg-red-950/10 p-3 rounded-md border border-red-100 dark:border-red-900/30">
                                    <p className="text-[10px] text-muted-foreground mb-2">Select existing items or enter manually to add a return.</p>

                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-red-700">Return Procedure</Label>
                                            <Select onValueChange={addProcedureReturn} value="" disabled={!selectedPatient}>
                                                <SelectTrigger className="h-8 text-xs border-red-100 bg-white/50">
                                                    <SelectValue placeholder="Select procedure..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {dynamicProcedures && dynamicProcedures.length > 0 ? (
                                                        dynamicProcedures.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                        ))
                                                    ) : (
                                                        COMMON_PROCEDURES.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-red-700">Return Product</Label>
                                            <Select onValueChange={addPharmacyReturn} value="" disabled={!selectedPatient}>
                                                <SelectTrigger className="h-8 text-xs border-red-100 bg-white/50">
                                                    <SelectValue placeholder="Select product..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(pharmacyItems || [])
                                                        .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim(), undefined, { sensitivity: 'base' }))
                                                        .map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 border-t border-red-100 pt-3">
                                        <Input
                                            placeholder="Return reason..."
                                            className="flex-1 h-8 text-xs"
                                            value={reimbursementName}
                                            onChange={e => setReimbursementName(e.target.value)}
                                            disabled={!selectedPatient}
                                        />
                                        <Input
                                            placeholder="Amount"
                                            type="number"
                                            className="w-20 h-8 text-xs"
                                            value={reimbursementAmount}
                                            onChange={e => setReimbursementAmount(e.target.value)}
                                            disabled={!selectedPatient}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-[10px] border-red-200 text-red-600 hover:bg-red-50"
                                            onClick={addReimbursement}
                                            disabled={!selectedPatient}
                                        >
                                            Add Return
                                        </Button>
                                    </div>

                                    {reimbursements.length > 0 && (
                                        <div className="mt-3 space-y-1">
                                            {reimbursements.map(r => (
                                                <div key={r.id} className="flex items-center justify-between text-xs p-1.5 bg-background rounded border border-red-100">
                                                    <span className="font-medium truncate flex-1 mr-2">{r.description}</span>
                                                    <span className="text-red-600 font-bold mr-2">-{r.amount} Rs</span>
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-red-500" onClick={() => removeReimbursement(r.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </CardContent>
                </Card>
            </div>

            {/* RIGHT COLUMN: RECEIPT PREVIEW (This replaces the entire screen when printing) */}
            <div className="w-full md:w-1/2 lg:w-[55%] flex flex-col h-full print:w-full print:block">
                <Card className="flex-1 flex flex-col shadow-none border-dashed bg-muted/10 print:bg-white print:border-none print:shadow-none min-h-[600px]">
                    <CardHeader className="text-center border-b pb-6 print:pb-4">
                        <div className="flex justify-center mb-2">
                            <div className="h-12 w-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                <CircleDollarSign className="h-6 w-6" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl">SkinSmith Clinic</CardTitle>
                        <CardDescription>Payment Receipt</CardDescription>
                        <p className="text-xs text-muted-foreground mt-1">Date: {new Date().toLocaleDateString()}</p>
                    </CardHeader>

                    <CardContent className="flex-1 pt-6 print:pt-4 flex flex-col overflow-y-auto">
                        {/* Patient Info */}
                        <div className="mb-6 grid grid-cols-2 text-sm bg-background p-4 rounded-lg border print:border-none print:p-0 print:bg-transparent">
                            <div>
                                <p className="text-muted-foreground text-xs">Patient Name</p>
                                <p className="font-medium">{selectedPatient?.name || '---'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-muted-foreground text-xs">Mobile Number</p>
                                <p className="font-medium">{selectedPatient?.mobileNumber || '---'}</p>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="flex-1">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left pb-2 font-medium">Description</th>
                                        <th className="text-center pb-2 font-medium w-16">Qty</th>
                                        <th className="text-right pb-2 font-medium w-24">Amount</th>
                                        <th className="w-8 print:hidden"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {billItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-8 text-muted-foreground text-xs italic">
                                                No items added to the bill yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        billItems.map(item => (
                                            <tr key={item.id} className="border-b last:border-0 group">
                                                <td className="py-3">
                                                    <p className="font-medium">{item.name}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{item.type}</p>
                                                </td>
                                                <td className="py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button variant="outline" size="icon" className="h-5 w-5 print:hidden" onClick={() => updateQty(item.id, -1)}>-</Button>
                                                        <span>{item.qty}</span>
                                                        <Button variant="outline" size="icon" className="h-5 w-5 print:hidden" onClick={() => updateQty(item.id, 1)}>+</Button>
                                                    </div>
                                                </td>
                                                <td className="py-3 text-right">{(item.price * item.qty).toLocaleString()} Rs</td>
                                                <td className="py-3 text-right print:hidden">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}

                                    {reimbursements.map(r => (
                                        <tr key={r.id} className="border-b last:border-0 group bg-red-50/20 print:bg-transparent">
                                            <td className="py-3">
                                                <p className="font-medium text-red-600">RETURN: {r.description}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase">REIMBURSEMENT</p>
                                            </td>
                                            <td className="py-3 text-center">1</td>
                                            <td className="py-3 text-right text-red-600">-{r.amount.toLocaleString()} Rs</td>
                                            <td className="py-3 text-right print:hidden">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeReimbursement(r.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="mt-8 pt-4 border-t space-y-2 pb-4">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Subtotal</span>
                                <span>{subTotal.toLocaleString()} Rs</span>
                            </div>

                            {discountValue > 0 && (
                                <div className="flex justify-between text-sm text-green-600 font-medium">
                                    <span>Discount {discountType === 'percentage' ? `(${discountValue}%)` : ''}</span>
                                    <span>- {discountAmount.toLocaleString()} Rs</span>
                                </div>
                            )}

                            {reimbursements.length > 0 && (
                                <div className="flex justify-between text-sm text-red-600 font-medium">
                                    <span>Reimbursements / Returns</span>
                                    <span>- {reimbursementTotal.toLocaleString()} Rs</span>
                                </div>
                            )}

                            {paymentMethod && (
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Tax ({paymentMethod} - {(taxRate * 100).toFixed(0)}% excl. Pharmacy)</span>
                                    <span>{taxAmount.toLocaleString()} Rs</span>
                                </div>
                            )}

                            <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                                <span>Total Amount</span>
                                <span>{grandTotal.toLocaleString()} Rs</span>
                            </div>

                            <div className="mt-6 pt-4 border-t border-dashed text-center text-[10px] text-muted-foreground space-y-1">
                                <p className="font-bold text-foreground">SkinSmith Clinic</p>
                                <p>1st Floor, Lord Trade Centre, 06, F-11 Markaz Islamabad</p>
                                <p>Mobile: +92 333 0477704 | Landline: 051-8748123</p>
                                <p className="font-bold text-foreground pt-2 uppercase tracking-wider text-[9px]">No Refund and Exchange Policy</p>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="bg-muted/30 pt-4 print:hidden flex justify-between">
                        <div className="flex gap-2">
                            {editingBillId && (
                                <Button variant="outline" onClick={handleClear} className="border-red-200 text-red-600 hover:bg-red-50">Clear</Button>
                            )}
                            <Button variant="outline" onClick={handleSaveBill} disabled={!selectedPatient || !paymentMethod || (paymentMethod === 'Nill' && !nilTaxSubMethod) || billItems.length === 0}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> {editingBillId ? 'Update Record' : 'Save Record'}
                            </Button>
                        </div>
                        <Button onClick={() => handlePrint()} disabled={!paymentMethod || billItems.length === 0} className="w-32"><Printer className="mr-2 h-4 w-4" /> Print Bill</Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    </TabsContent>

                <TabsContent value="all-invoices" className="flex-1 mt-0 outline-none">
                    <Card className="h-full flex flex-col overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <History className="h-5 w-5" /> Recent Billing Records
                                </CardTitle>
                                <CardDescription>Search and manage all past invoices generated.</CardDescription>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="relative w-64 self-end">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search name, mobile, id..."
                                        className="pl-9 h-9"
                                        value={billingSearch}
                                        onChange={(e) => setBillingSearch(e.target.value)}
                                    />
                                </div>
                                <div className="flex bg-muted/30 p-1 rounded-md border text-sm w-fit self-end">
                                    {['All', 'Consultation', 'Procedure', 'Pharmacy', 'Mixed'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setCategoryFilter(cat)}
                                            className={cn(
                                                "px-3 py-1 rounded-sm transition-all text-xs font-semibold",
                                                categoryFilter === cat ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-0 border-t">
                            {isBillingLoading ? (
                                <div className="flex flex-col items-center justify-center h-64 gap-3">
                                    <RefreshCcw className="h-8 w-8 text-primary animate-spin" />
                                    <p className="text-muted-foreground text-sm">Loading records...</p>
                                </div>
                            ) : filteredRecords.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                                    <AlertCircle className="h-8 w-8 opacity-20" />
                                    <p className="text-sm">No billing records found.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-[180px]">Date & ID</TableHead>
                                            <TableHead>Patient Details</TableHead>
                                            <TableHead>Items Summary</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecords.map((bill) => (
                                            <TableRow key={bill.id} className="group hover:bg-muted/30 transition-colors">
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-xs flex items-center gap-1">
                                                            <CalendarIcon className="h-3 w-3 opacity-60" />
                                                            {format(new Date(bill.timestamp), 'MMM dd, yyyy')}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground font-mono">#{bill.id.slice(0, 8)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm">{bill.patientName}</span>
                                                        <span className="text-xs text-muted-foreground">{bill.patientMobile}</span>
                                                        {bill.editReason && (
                                                            <div className="mt-1 flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 w-fit">
                                                                <AlertCircle className="h-2.5 w-2.5" /> 
                                                                <span className="italic">"{bill.editReason}"</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1 max-w-[300px]">
                                                        {bill.items.slice(0, 2).map((item, idx) => (
                                                            <span key={idx} className="bg-primary/5 text-primary text-[10px] px-1.5 py-0.5 rounded-full border border-primary/10">
                                                                {item.name} {item.qty > 1 ? `x${item.qty}` : ''}
                                                            </span>
                                                        ))}
                                                        {bill.items.length > 2 && (
                                                            <span className="text-[10px] text-muted-foreground">+ {bill.items.length - 2} more</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="font-black text-sm">{bill.grandTotal.toLocaleString()} Rs</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={cn(
                                                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border",
                                                        (bill.paymentMethod === 'Cash' || bill.paymentMethod === 'Nill (Cash)') ? "bg-green-50 text-green-700 border-green-200" :
                                                        (bill.paymentMethod === 'Card' || bill.paymentMethod === 'Online' || bill.paymentMethod === 'Nill (Online)') ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                        "bg-amber-50 text-amber-700 border-amber-200"
                                                    )}>
                                                        {bill.paymentMethod}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={cn(
                                                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border text-center w-full inline-block",
                                                        bill.status === 'Paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                        "bg-rose-50 text-rose-700 border-rose-200"
                                                    )}>
                                                        {bill.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-center items-center gap-1">
                                                        {bill.status !== 'Paid' && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-8 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 font-semibold px-2"
                                                                onClick={() => handleMarkAsPaid(bill.id)}
                                                            >
                                                                Mark Paid
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => handleEditBill(bill)} title="Edit Bill">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500" onClick={() => handleDeleteBill(bill.id)} title="Delete Bill">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 hover:text-amber-600"
                                                            onClick={() => {
                                                                handlePrint(bill);
                                                            }}
                                                            title="Print Bill"
                                                        >
                                                            <Printer className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
