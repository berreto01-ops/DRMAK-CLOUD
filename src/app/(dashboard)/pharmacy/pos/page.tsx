'use client';
import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Search, Trash2, Info, MessageSquare, Phone, Pencil, Printer, Save } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import type { Patient, PharmacyItem, Supplier } from '@/lib/types';
import { collection, doc, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

type InvoiceItem = PharmacyItem & {
    saleQuantity: number;
    saleDiscount: number;
};

export default function POSPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
    const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([]);
    const [patientSearch, setPatientSearch] = React.useState('');
    const [itemSearch, setItemSearch] = React.useState('');
    
    const patientsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'patients') : null, [firestore]);
    const itemsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'pharmacyItems') : null, [firestore]);
    
    const { data: patients } = useCollection<Patient>(patientsQuery);
    const { data: pharmacyItems } = useCollection<PharmacyItem>(itemsQuery);

    const filteredPatients = React.useMemo(() => {
        if (!patientSearch) return [];
        return patients?.filter(p => 
            (p.name || '').toLowerCase().includes(patientSearch.toLowerCase()) || 
            (p.mobileNumber || '').includes(patientSearch)
        ) || [];
    }, [patients, patientSearch]);

    const filteredItems = React.useMemo(() => {
        if (!itemSearch) return [];
        return (pharmacyItems?.filter(i => (i.productName || (i as any).name || '').toLowerCase().includes(itemSearch.toLowerCase())) || [])
            .sort((a, b) => (a.productName || '').trim().localeCompare((b.productName || '').trim(), undefined, { sensitivity: 'base' }));
    }, [pharmacyItems, itemSearch]);
    
    const handleSelectPatient = (patient: Patient) => {
        setSelectedPatient(patient);
        setPatientSearch('');
    }
    
    const handleSelectItem = (item: PharmacyItem) => {
        if (invoiceItems.find(i => i.id === item.id)) {
            toast({ variant: "destructive", title: "Item already added" });
            return;
        }
        setInvoiceItems(prev => [...prev, { ...item, saleQuantity: 1, saleDiscount: 0 }]);
        setItemSearch('');
    }
    
    const handleQuantityChange = (itemId: string, quantity: number) => {
        setInvoiceItems(prev => prev.map(item => item.id === itemId ? {...item, saleQuantity: Math.max(1, quantity)} : item));
    }

    const handleDiscountChange = (itemId: string, discount: number) => {
        setInvoiceItems(prev => prev.map(item => item.id === itemId ? {...item, saleDiscount: Math.max(0, discount)} : item));
    }
    
    const handleRemoveItem = (itemId: string) => {
        setInvoiceItems(prev => prev.filter(item => item.id !== itemId));
    }
    
    const summary = React.useMemo(() => {
        const subTotal = invoiceItems.reduce((acc, item) => acc + (item.sellingPrice * item.saleQuantity), 0);
        const totalDiscount = invoiceItems.reduce((acc, item) => acc + item.saleDiscount, 0);
        const grandTotal = subTotal - totalDiscount;
        return { subTotal, totalDiscount, grandTotal };
    }, [invoiceItems]);

    const updateInventoryStock = async (items: InvoiceItem[]) => {
        if (!firestore) return;
        try {
            await runTransaction(firestore, async (transaction) => {
                const adjustments: Record<string, Record<string, number>> = {};
                
                items.forEach(item => {
                    if (item.supplierId) {
                        if (!adjustments[item.supplierId]) adjustments[item.supplierId] = {};
                        adjustments[item.supplierId][item.id] = (adjustments[item.supplierId][item.id] || 0) + item.saleQuantity;
                    }
                });

                // 1. COLLECT ALL READS FIRST
                const supplierDataMap: Record<string, Supplier> = {};
                const pharmacyItemDocs: Record<string, any> = {};

                for (const supplierId of Object.keys(adjustments)) {
                    const supplierDocRef = doc(firestore, 'suppliers', supplierId);
                    const supplierDoc = await transaction.get(supplierDocRef);
                    if (supplierDoc.exists()) {
                        supplierDataMap[supplierId] = supplierDoc.data() as Supplier;
                    }

                    for (const productId of Object.keys(adjustments[supplierId])) {
                        const pItemRef = doc(firestore, 'pharmacyItems', productId);
                        const pItemDoc = await transaction.get(pItemRef);
                        if (pItemDoc.exists()) {
                            pharmacyItemDocs[productId] = pItemDoc.data();
                        }
                    }
                }

                // 2. PERFORM ALL WRITES
                for (const supplierId of Object.keys(supplierDataMap)) {
                    const supplierDocRef = doc(firestore, 'suppliers', supplierId);
                    const products = supplierDataMap[supplierId].products || [];
                    const supplierAdjustments = adjustments[supplierId];

                    const updatedProducts = products.map(p => {
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
            console.error('Error updating inventory stock:', error);
            throw error;
        }
    };

    const handleSaveInvoice = async (shouldPrint: boolean = false) => {
        if (!firestore) return;
        if (!selectedPatient) {
            toast({ variant: 'destructive', title: 'Patient required', description: 'Please select a patient before saving.' });
            return;
        }
        if (invoiceItems.length === 0) {
            toast({ variant: 'destructive', title: 'No items', description: 'Please add items to the invoice.' });
            return;
        }

        try {
            // 1. Deduct Stock
            await updateInventoryStock(invoiceItems);

            // 2. Prepare Billing Record
            const billData = {
                patientId: selectedPatient.id,
                patientName: selectedPatient.name,
                patientMobile: selectedPatient.mobileNumber,
                items: invoiceItems.map(item => ({
                    id: `${item.supplierId}_${item.id}`,
                    name: item.productName,
                    type: 'pharmacy',
                    price: item.sellingPrice,
                    qty: item.saleQuantity,
                    supplierId: item.supplierId,
                    productId: item.id
                })),
                subTotal: summary.subTotal,
                discountAmount: summary.totalDiscount,
                grandTotal: summary.grandTotal,
                paymentMethod: 'Cash', // Default for POS
                timestamp: new Date().toISOString(),
                status: 'Paid'
            };

            // 3. Save to Firestore
            await addDocumentNonBlocking(collection(firestore, 'billingRecords'), billData);

            toast({ title: 'Invoice Saved', description: 'Inventory updated and transaction recorded.' });
            
            if (shouldPrint) {
                // Mock printing for now or reuse print logic if available
                window.print();
            }

            // 4. Reset
            setInvoiceItems([]);
            setSelectedPatient(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error saving invoice', description: 'Inventory update failed.' });
        }
    };


  return (
    <div className="space-y-4 p-4 bg-muted/20 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Create Invoice</h1>
        <div className="flex gap-2">
            <Button variant="outline">+ Add Stock</Button>
            <Button variant="outline">+ Invoice Return</Button>
            <Button variant="outline">+ Copy Last Invoice</Button>
            <Button variant="destructive">+ Missed Sale</Button>
        </div>
      </div>
      
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-9 space-y-4">
            <Card>
                <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="space-y-2 relative">
                            <Label htmlFor="patient-search">Patient</Label>
                             <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input id="patient-search" placeholder="Search by Name, MR# or Phone" className="pl-8" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
                             </div>
                             {patientSearch && filteredPatients.length > 0 && (
                                <Card className="absolute z-10 w-full mt-1">
                                    <CardContent className="p-2 max-h-60 overflow-y-auto">
                                        {filteredPatients.map(p => (
                                            <div key={p.id} onClick={() => handleSelectPatient(p)} className="p-2 hover:bg-muted rounded-md cursor-pointer text-sm">
                                                <p className="font-semibold">{p.name}</p>
                                                <p className="text-xs text-muted-foreground">{p.mobileNumber}</p>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedPatient && (
                                <div className="p-2 border rounded-md bg-secondary w-full">
                                    <p className="font-semibold">{selectedPatient.name}</p>
                                    <p className="text-xs text-muted-foreground">{selectedPatient.mobileNumber}</p>
                                </div>
                            )}
                            <Button><PlusCircle className="h-4 w-4"/></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                 <CardContent className="p-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="item-search">Item</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input id="item-search" placeholder="Search by Item Name..." className="pl-8" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
                        </div>
                        {itemSearch && filteredItems.length > 0 && (
                            <Card className="absolute z-10 w-full mt-1">
                                <CardContent className="p-2 max-h-60 overflow-y-auto">
                                     {filteredItems.map(item => (
                                        <div key={item.id} onClick={() => handleSelectItem(item)} className="p-2 hover:bg-muted rounded-md cursor-pointer text-sm">
                                            <p className="font-semibold">{item.productName}</p>
                                            <p className="text-xs text-muted-foreground">In Stock: {item.quantity}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                    <div className="mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-48">Item</TableHead>
                                    <TableHead>Manufacturer</TableHead>
                                    <TableHead>Batch</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                    <TableHead className="w-24">Quantity</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="w-24">Discount</TableHead>
                                    <TableHead className="text-right">Net Amount</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoiceItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">No items added.</TableCell>
                                    </TableRow>
                                ) : (
                                    invoiceItems.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.productName}</TableCell>
                                            <TableCell>{item.manufacturer || 'N/A'}</TableCell>
                                            <TableCell><Input defaultValue="B123" className="h-8"/></TableCell>
                                            <TableCell className="text-right">Rs{item.sellingPrice.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Input type="number" value={item.saleQuantity} onChange={e => handleQuantityChange(item.id, +e.target.value)} className="h-8"/>
                                            </TableCell>
                                            <TableCell className="text-right">Rs{(item.sellingPrice * item.saleQuantity).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Input type="number" value={item.saleDiscount} onChange={e => handleDiscountChange(item.id, +e.target.value)} className="h-8"/>
                                            </TableCell>
                                            <TableCell className="text-right">Rs{((item.sellingPrice * item.saleQuantity) - item.saleDiscount).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
                 <Card>
                    <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                           <Checkbox id="repeat"/>
                           <Label htmlFor="repeat">Repeat</Label>
                        </div>
                        <div>
                            <Label htmlFor="invoice-note">Invoice Note</Label>
                            <Textarea id="invoice-note" placeholder="Add any notes for this invoice..." />
                        </div>
                    </CardContent>
                 </Card>
            </div>
        </div>
        
        <div className="col-span-12 lg:col-span-3 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between"><span>Profit/Loss</span> <span>Rs0.00</span></div>
                    <div className="flex justify-between"><span>Sub - Total</span> <span>Rs{summary.subTotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Discount(-)</span> <span>Rs{summary.totalDiscount.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total</span> <span>Rs{summary.grandTotal.toFixed(2)}</span></div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input type="text" value={format(new Date(), 'dd/MM/yyyy hh:mm a')} readOnly/>
                        <Select defaultValue="cash">
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="card">Card Payment</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="payment-amount">Payment Rs.</Label>
                        <Input id="payment-amount" placeholder="Enter amount received"/>
                    </div>
                    <Button className="w-full">+ Add Payment</Button>

                     <div className="space-y-2 text-sm pt-2">
                        <div className="flex justify-between text-destructive"><span>Due Rs.</span> <span>{summary.grandTotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Advance Rs.</span> <span>0.00</span></div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center space-x-2">
                <Checkbox id="send-notification" />
                <Label htmlFor="send-notification" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Send Payment Notification
                </Label>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="w-full" onClick={() => handleSaveInvoice(false)}>Save</Button>
                <Button className="w-full" onClick={() => handleSaveInvoice(true)}>Save & Print Invoice</Button>
            </div>
        </div>
      </div>
      <div className="fixed bottom-8 right-8 flex flex-col gap-2">
            <Button size="icon" className="rounded-full h-12 w-12"><MessageSquare className="h-6 w-6" /></Button>
            <Button size="icon" className="rounded-full h-12 w-12"><Pencil className="h-6 w-6" /></Button>
            <Button size="icon" className="rounded-full h-12 w-12"><Phone className="h-6 w-6" /></Button>
        </div>
    </div>
  );
}
