'use client';
import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, PlusCircle, Loader2, Upload, Trash2, Filter, FileText, Settings, Eye } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import type { Lead, User } from '@/lib/types';
import { collection, doc, getDoc, setDoc, query, where, getFirestore } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useSearch } from '@/context/SearchProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/firebase/auth/use-user';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { useSheetLeads } from '@/hooks/use-sheet-leads';



const ImportLeadsDialog = ({ open, onOpenChange, onLeadsImported, sheetUrl }: { open: boolean, onOpenChange: (open: boolean) => void, onLeadsImported: () => void, sheetUrl?: string }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const { user } = useUser();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const processLeads = async (text: string, sourcePrefix: string) => {
    if (!firestore || !user) return;
    const rows = text.split('\n').slice(1); // Skip header
    const leadsCollection = collection(firestore, 'leads');
    let count = 0;

    for (const row of rows) {
      const [name, email, phone] = row.split(',');
      if (name && name.trim()) {
        const newLead: Omit<Lead, 'id'> = {
          name: name.trim(),
          email: email?.trim() || '',
          phone: phone?.trim() || '',
          status: 'New Lead',
          source: sourcePrefix,
          assignedTo: user.id,
          createdAt: new Date().toISOString(),
        };
        await addDocumentNonBlocking(leadsCollection, newLead);
        count++;
      }
    }
    toast({ title: 'Import Successful', description: `${count} leads have been imported.` });
    onLeadsImported();
  };

  const handleImportFromFile = () => {
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        await processLeads(text, `CSV: ${file.name}`);
      }
      setIsImporting(false);
      onOpenChange(false);
    };
    reader.readAsText(file);
  };

  const handleImportFromLink = async () => {
    if (!sheetUrl) return;
    setIsImporting(true);
    try {
      // Use server-side proxy to avoid CORS issues
      const proxyUrl = `/api/sheet-proxy?url=${encodeURIComponent(sheetUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to fetch sheet data");
      const text = await response.text();
      await processLeads(text, "Google Sheet Link");
      setIsImporting(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({ variant: 'destructive', title: 'Import Failed', description: "Make sure the sheet is public/readable." });
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>
            Import leads from a local CSV file or directly from your configured Google Sheet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Local CSV File</Label>
            <div className="flex gap-2">
              <Input type="file" accept=".csv" onChange={handleFileChange} className="flex-1" />
              <Button onClick={handleImportFromFile} disabled={!file || isImporting}>
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
          </div>

          <div className="space-y-2">
            <Label>From Google Sheet Link</Label>
            <Button variant="outline" className="w-full gap-2" onClick={handleImportFromLink} disabled={!sheetUrl || isImporting}>
              <Upload className="h-4 w-4" />
              Sync from Online Sheet
            </Button>
            {!sheetUrl && <p className="text-xs text-red-500">Please configure your sheet link first.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
const ConfigureSheetDialog = ({ open, onOpenChange, currentUrl, onSave }: { open: boolean, onOpenChange: (open: boolean) => void, currentUrl: string, onSave: (url: string) => void }) => {
  const [url, setUrl] = React.useState(currentUrl);

  React.useEffect(() => {
    setUrl(currentUrl);
  }, [currentUrl, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Google Sheet</DialogTitle>
          <DialogDescription>
            Enter the URL of your Google Sheet. Make sure the sheet is shared so the system can access it (export to CSV).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="sheetUrl">Google Sheet URL</Label>
          <Input id="sheetUrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit" />
        </div>
        <DialogFooter>
          <Button onClick={() => onSave(url)}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
const LiveSheetPreview = ({
  sheetUrl,
  onlineLeads,
  existingLeads = [],
  onStatusChange,
  users
}: {
  sheetUrl: string,
  onlineLeads: Lead[],
  existingLeads?: Lead[],
  onStatusChange: (lead: Lead, status: string) => void,
  users: User[]
}) => {
  const [data, setData] = React.useState<string[][]>([]);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchData = async () => {
      if (!sheetUrl) return;
      setLoading(true);
      try {
        // Use server-side proxy to avoid CORS issues
        const proxyUrl = `/api/sheet-proxy?url=${encodeURIComponent(sheetUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Failed to fetch sheet data");
        const text = await response.text();

        const rows = text.split('\n').map(row => {
          const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
          const cells = [];
          let match;
          while ((match = regex.exec(row)) !== null) {
            cells.push(match[1] ? match[1].replace(/""/g, '"') : match[2]);
          }
          return cells.map(cell => cell?.trim() || '');
        });

        setData(rows.filter(r => r.some(cell => cell !== '')));
      } catch (error) {
        console.error("Preview error:", error);
        toast({ variant: 'destructive', title: 'Preview Failed', description: "Ensure the sheet is public/readable." });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sheetUrl, toast]);

  if (loading) return (
    <div className="flex justify-center items-center h-48">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );

  if (data.length === 0) return <div className="p-8 text-center text-muted-foreground">No data found in the configured sheet.</div>;

  const headers = data[0];
  const body = data.slice(1);

  // Helper to find matching existing lead
  const findExistingLead = (onlineLead: Lead) => {
    return existingLeads.find(l =>
      (l.email && onlineLead.email && l.email.toLowerCase() === onlineLead.email.toLowerCase()) ||
      (l.phone && onlineLead.phone && l.phone === onlineLead.phone)
    );
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap font-bold text-primary bg-muted/50 w-[150px]">App Status</TableHead>
            {headers.map((h, i) => (
              <TableHead key={i} className="whitespace-nowrap font-bold text-primary">{h}</TableHead>
            ))}
            <TableHead className="whitespace-nowrap font-bold text-primary w-[150px]">Assigned To</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {body.map((row, rowIndex) => {
            // Correlate with onlineLeads (assuming same order)
            const onlineLead = onlineLeads[rowIndex];
            const existingLead = onlineLead ? findExistingLead(onlineLead) : null;

            // Use existing lead status or 'New Lead'
            const currentStatus = existingLead ? existingLead.status : 'New Lead';
            const leadToUpdate = existingLead || onlineLead;

            // If we don't have a valid lead object (e.g. row mismatch), disable action?
            // But usually they match.

            return (
              <TableRow key={rowIndex}>
                <TableCell>
                  {leadToUpdate ? (
                    <Select onValueChange={(val) => onStatusChange(leadToUpdate, val)} value={currentStatus}>
                      <SelectTrigger className={`h-8 w-[130px] ${currentStatus === 'New Lead' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        currentStatus === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          currentStatus === 'Dead' ? 'bg-red-50 text-red-700 border-red-200' :
                            currentStatus === 'Converted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New Lead">New Lead</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Dead">Dead</SelectItem>
                        <SelectItem value="Previous">Previous</SelectItem>
                        <SelectItem value="Converted">Converted</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : <Badge variant="outline">Invalid Row</Badge>}
                </TableCell>
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex} className="whitespace-nowrap">{cell}</TableCell>
                ))}
                <TableCell>
                  <Select
                    onValueChange={async (val) => {
                      if (leadToUpdate) {
                        if ((leadToUpdate as any).isOnlineOnly) {
                          // Automatically import to Firestore when assigned
                          const newLead: Omit<Lead, 'id'> = {
                            name: leadToUpdate.name,
                            email: leadToUpdate.email,
                            phone: leadToUpdate.phone,
                            product: leadToUpdate.product || '',
                            status: leadToUpdate.status,
                            source: 'Google Sheet (Imported)',
                            assignedTo: val,
                            createdAt: new Date().toISOString(),
                          };
                          await addDocumentNonBlocking(collection(getFirestore(), 'leads'), newLead);

                          // Update local object to reflect it's no longer just online-only (visually)
                          // Though re-render will likely handle this if we trigger one.
                          toast({ title: "Lead Imported & Assigned", description: `Lead assigned to selected user.` });
                          // Force a re-fetch of leads if possible, or let the real-time listener handle it
                        } else {
                          const docRef = doc(getFirestore(), 'leads', leadToUpdate.id);
                          updateDocumentNonBlocking(docRef, { assignedTo: val });
                          toast({ title: "Reassigned", description: "Lead assigned successfully." });
                        }
                      }
                    }}
                    value={leadToUpdate?.assignedTo || ''}
                  >
                    <SelectTrigger className="h-8 w-[130px]">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {users.filter((u: User) => u.role === 'Sales').map((u: User) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};



export default function LeadsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { searchTerm } = useSearch();

  const leadsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    const baseQuery = collection(firestore, 'leads');
    if (user.role === 'Sales') {
      return query(baseQuery, where('assignedTo', '==', user.id));
    }
    return baseQuery;
  }, [firestore, user?.id, user?.role]);

  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);

  const { data: leads, isLoading: leadsLoading, forceRerender } = useCollection<Lead>(leadsQuery);
  const { data: rawUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);
  const users = React.useMemo(() => {
    return rawUsers?.filter(u => {
        const status = (u.status || '').trim().toLowerCase();
        return u.email !== 'admin1@skinsmith.com' && 
            (u.name || u.email) && 
            status !== 'deleted' &&
            u.isDeleted !== true &&
            u.active !== false;
    }) || [];
  }, [rawUsers]);

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [selectedLead, setSelectedLead] = React.useState<Lead | undefined>(undefined);
  const [leadToDelete, setLeadToDelete] = React.useState<Lead | null>(null);
  const [sheetUrl, setSheetUrl] = React.useState<string>('');

  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  // Use the new hook
  const { leads: onlineLeads, isLoading: isSheetLoading } = useSheetLeads(sheetUrl, statusFilter === 'all' || statusFilter === 'online');
  const [isCleaningUp, setIsCleaningUp] = React.useState(false);

  // Fetch settings
  // Fetch settings
  const userAssignedSheet = (user as any)?.assignedSheet;
  React.useEffect(() => {
    if (!firestore || !user?.id) return;

    // 1. Priority: User's assigned sheet
    if (userAssignedSheet) {
      setSheetUrl(userAssignedSheet);
      return;
    }

    // 2. Fallback: Global settings
    const fetchSettings = async () => {
      const settingsRef = doc(firestore, 'settings', 'sales');
      const snap = await getDoc(settingsRef);
      if (snap.exists() && snap.data().googleSheetUrl) {
        setSheetUrl(snap.data().googleSheetUrl);
      }
    };
    fetchSettings();
  }, [firestore, user?.id, userAssignedSheet]);

  // Fetch Sheet Data removed - handled by hook

  const isLoading = leadsLoading || usersLoading;

  const filteredLeads = React.useMemo(() => {
    let result = leads ? [...leads] : [];

    // Merge online leads if in 'all' view
    if (statusFilter === 'all' && onlineLeads.length > 0) {
      // Filter out online leads that are already in Firestore (by name/email/phone match)
      const existingEmails = new Set(result.map(l => l.email.toLowerCase()).filter(e => e));
      const existingPhones = new Set(result.map(l => l.phone).filter(p => p));

      const uniqueOnline = onlineLeads.filter(ol =>
        !existingEmails.has(ol.email.toLowerCase()) &&
        !existingPhones.has(ol.phone)
      );

      result = [...result, ...uniqueOnline];
    }

    // Status Filter
    if (statusFilter !== 'all' && statusFilter !== 'online') {
      result = result.filter(l => l.status === statusFilter);
    }

    // Search Filter
    const term = searchTerm.toLowerCase();
    if (term) {
      result = result.filter(l =>
        (l.name || '').toLowerCase().includes(term) ||
        (l.email || '').toLowerCase().includes(term) ||
        (l.status || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [leads, searchTerm, statusFilter, onlineLeads]);

  const usersMap = React.useMemo(() => {
    if (!users) return new Map();
    return new Map(users.map(u => [u.id, u.name]));
  }, [users]);

  const handleAdd = () => {
    setSelectedLead(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setIsFormOpen(true);
  };

  const handleStatusChange = async (lead: Lead, newStatus: string) => {
    if (!firestore || !user) return;

    if ((lead as any).isOnlineOnly) {
      const newLead: Omit<Lead, 'id'> = {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        product: lead.product || '',
        status: newStatus as Lead['status'],
        source: 'Google Sheet (Imported)',
        assignedTo: lead.assignedTo || user?.id || '',
        createdAt: new Date().toISOString(),
      };
      await addDocumentNonBlocking(collection(firestore, 'leads'), newLead);
      toast({ title: "Lead Imported", description: `Saved ${lead.name} to database with status ${newStatus}.` });
      forceRerender();
    } else {
      // Update existing
      const docRef = doc(firestore, 'leads', lead.id);
      updateDocumentNonBlocking(docRef, { status: newStatus });
      toast({ title: "Status Updated", description: `Updated status to ${newStatus}.` });
    }
  };

  const handleDelete = () => {
    if (!firestore || !leadToDelete) return;
    const docRef = doc(firestore, 'leads', leadToDelete.id);
    deleteDocumentNonBlocking(docRef);
    toast({
      variant: 'destructive',
      title: 'Lead Deleted',
      description: "The lead record has been removed."
    });
    setLeadToDelete(null);
  }

  const handleClearAll = async () => {
    if (!firestore || !leads || leads.length === 0) return;
    setIsCleaningUp(true);
    try {
      for (const lead of leads) {
        const docRef = doc(firestore, 'leads', lead.id);
        deleteDocumentNonBlocking(docRef);
      }
      toast({ title: "Cleanup Complete", description: `Queued deletion for ${leads.length} leads.` });
    } catch (e) {
      toast({ variant: 'destructive', title: "Cleanup Failed", description: "An error occurred during cleanup." });
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                Manage your sales leads and track their progress.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(sheetUrl, '_blank')}>
                <FileText className="h-4 w-4" />
                View Google Sheet
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setIsConfigOpen(true)}>
                <Settings className="h-4 w-4" />
                Configure
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setIsImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Import from Sheet
              </Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={handleClearAll} disabled={isCleaningUp || !leads?.length}>
                {isCleaningUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Clear All Leads
              </Button>
              <Button size="sm" className="gap-1" onClick={handleAdd}>
                <PlusCircle className="h-4 w-4" />
                Add Lead
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <Tabs defaultValue="all" onValueChange={setStatusFilter}>
              <TabsList className="grid grid-cols-7 w-full max-w-3xl">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="New Lead">New</TabsTrigger>
                <TabsTrigger value="In Progress">In Progress</TabsTrigger>
                <TabsTrigger value="Dead">Dead</TabsTrigger>
                <TabsTrigger value="Previous">Previous</TabsTrigger>
                <TabsTrigger value="Converted">Converted</TabsTrigger>
                <TabsTrigger value="online" className="gap-1">
                  <Eye className="h-3 w-3" />
                  Online Sheet
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {statusFilter === 'online' ? (
            <LiveSheetPreview
              sheetUrl={sheetUrl}
              onlineLeads={onlineLeads}
              existingLeads={leads || []}
              onStatusChange={handleStatusChange}
              users={users || []}
            />
          ) : isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Lead Contact</TableHead>
                  <TableHead>Product/Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads?.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      {lead.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{lead.email}</span>
                        <span className="text-xs text-muted-foreground">{lead.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{lead.product || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <Select onValueChange={(val) => handleStatusChange(lead, val)} value={lead.status}>
                        <SelectTrigger className={`h-8 w-[130px] ${lead.status === 'New Lead' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          lead.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            lead.status === 'Dead' ? 'bg-red-50 text-red-700 border-red-200' :
                              lead.status === 'Converted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New Lead">New Lead</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Dead">Dead</SelectItem>
                          <SelectItem value="Previous">Previous</SelectItem>
                          <SelectItem value="Converted">Converted</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {lead.source}
                        {(lead as any).isOnlineOnly && <Badge variant="secondary" className="text-[10px] px-1 h-4">Online</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{usersMap.get(lead.assignedTo) || 'Unassigned'}</TableCell>
                    <TableCell>{new Date(lead.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEdit(lead)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setLeadToDelete(lead)}
                            className="text-red-600"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <LeadFormDialog 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        lead={selectedLead} 
        users={users || []} 
        onSuccess={forceRerender}
        defaultAssignedTo={user?.role === 'Sales' ? user.id : undefined}
      />
      <ImportLeadsDialog open={isImportOpen} onOpenChange={setIsImportOpen} onLeadsImported={forceRerender} sheetUrl={sheetUrl} />
      <ConfigureSheetDialog
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
        currentUrl={sheetUrl}
        onSave={async (url) => {
          if (firestore) {
            await setDoc(doc(firestore, 'settings', 'sales'), { googleSheetUrl: url }, { merge: true });
            setSheetUrl(url);
            toast({ title: "Settings Saved", description: "Google Sheet URL has been updated." });
            setIsConfigOpen(false);
          }
        }}
      />

      <AlertDialog open={!!leadToDelete} onOpenChange={(open) => !open && setLeadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the lead record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
