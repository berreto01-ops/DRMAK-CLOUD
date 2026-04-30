'use client';
import * as React from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    MoreHorizontal,
    Search,
    Loader2,
    CalendarDays,
    CheckCircle2,
    XCircle,
    Clock,
    Trash2,
    Edit,
    Filter,
    ArrowUpDown,
    Download
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    useCollection,
    useFirestore,
    useMemoFirebase,
    updateDocumentNonBlocking,
    deleteDocumentNonBlocking,
    useUser
} from '@/firebase';
import type { FollowUp } from '@/lib/types';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSearch } from '@/context/SearchProvider';

// ─── Edit Follow-up Dialog ──────────────────────────────────────────────────

const EditFollowUpDialog = ({ open, onOpenChange, followUp, onSave }: { 
    open: boolean; 
    onOpenChange: (v: boolean) => void; 
    followUp: FollowUp | null;
    onSave: (id: string, data: Partial<FollowUp>) => Promise<void>;
}) => {
    const [date, setDate] = React.useState('');
    const [reason, setReason] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [outcome, setOutcome] = React.useState('');
    const [remarks, setRemarks] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (open && followUp) {
            setDate(followUp.followUpDate.split('T')[0]);
            setReason(followUp.reason || '');
            setNotes(followUp.notes || '');
            setOutcome(followUp.callOutcome || '');
            setRemarks(followUp.remarks || '');
        }
    }, [open, followUp]);

    if (!followUp) return null;

    const handleSave = async () => {
        setSaving(true);
        await onSave(followUp.id, {
            followUpDate: new Date(date).toISOString(),
            reason,
            notes,
            callOutcome: outcome,
            remarks
        });
        setSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Follow-up</DialogTitle>
                    <DialogDescription>Modify follow-up details for {followUp.patientName}.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid gap-2">
                        <Label>Follow-up Date</Label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Reason</Label>
                        <Input value={reason} onChange={e => setReason(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                    </div>
                    {followUp.status === 'Completed' && (
                        <>
                            <div className="grid gap-2">
                                <Label>Call Outcome</Label>
                                <Textarea value={outcome} onChange={e => setOutcome(e.target.value)} rows={2} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Internal Remarks</Label>
                                <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FollowUpHistoryPage() {
    const { toast } = useToast();
    const { searchTerm } = useSearch();
    const firestore = useFirestore();
    const { user } = useUser();
    const [selectedFollowUp, setSelectedFollowUp] = React.useState<FollowUp | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [statusFilter, setStatusFilter] = React.useState<'All' | 'Pending' | 'Completed' | 'Cancelled'>('All');

    const followUpsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'followUps'), orderBy('followUpDate', 'desc'));
    }, [firestore]);

    const { data: allFollowUps, isLoading, forceRerender } = useCollection<FollowUp>(followUpsQuery);

    // Counts for tab badges
    const counts = React.useMemo(() => {
        if (!allFollowUps) return { All: 0, Pending: 0, Completed: 0, Cancelled: 0 };
        return {
            All: allFollowUps.length,
            Pending: allFollowUps.filter(fu => fu.status === 'Pending').length,
            Completed: allFollowUps.filter(fu => fu.status === 'Completed').length,
            Cancelled: allFollowUps.filter(fu => fu.status === 'Cancelled').length,
        };
    }, [allFollowUps]);

    const filteredFollowUps = React.useMemo(() => {
        if (!allFollowUps) return [];
        let filtered = [...allFollowUps];

        if (statusFilter !== 'All') {
            filtered = filtered.filter(fu => fu.status === statusFilter);
        }

        const term = searchTerm.toLowerCase();
        if (term) {
            filtered = filtered.filter(fu =>
                (fu.patientName || '').toLowerCase().includes(term) ||
                (fu.patientMobile || '').includes(term) ||
                (fu.reason || '').toLowerCase().includes(term) ||
                (fu.calledBy || '').toLowerCase().includes(term)
            );
        }

        // Sort: Completed records always first (by completedAt desc), then pending by followUpDate
        filtered.sort((a, b) => {
            if (a.status === 'Completed' && b.status !== 'Completed') return -1;
            if (a.status !== 'Completed' && b.status === 'Completed') return 1;
            if (a.status === 'Completed' && b.status === 'Completed') {
                const aTime = (a as any).completedAt || a.followUpDate;
                const bTime = (b as any).completedAt || b.followUpDate;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
            }
            return new Date(b.followUpDate).getTime() - new Date(a.followUpDate).getTime();
        });

        return filtered;
    }, [allFollowUps, searchTerm, statusFilter]);

    const handleUpdate = async (id: string, data: Partial<FollowUp>) => {
        if (!firestore) return;
        await updateDocumentNonBlocking(doc(firestore, 'followUps', id), data);
        toast({ title: 'Follow-up Updated' });
        forceRerender();
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        if (!confirm('Are you sure you want to delete this follow-up record?')) return;
        await deleteDocumentNonBlocking(doc(firestore, 'followUps', id));
        toast({ title: 'Follow-up Deleted', variant: 'destructive' });
        forceRerender();
    };

    const getStatusBadge = (fu: FollowUp) => {
        const date = parseISO(fu.followUpDate);
        if (fu.status === 'Completed') return <Badge className="bg-green-100 text-green-700 border-green-200 font-semibold">✓ Completed</Badge>;
        if (fu.status === 'Cancelled') return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
        if (isPast(date) && !isToday(date)) return <Badge className="bg-red-100 text-red-700 border-red-200">Overdue</Badge>;
        if (isToday(date)) return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Today</Badge>;
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Scheduled</Badge>;
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const tabOptions: Array<'All' | 'Completed' | 'Pending' | 'Cancelled'> = ['All', 'Completed', 'Pending', 'Cancelled'];
    const tabColors: Record<string, string> = {
        All: 'bg-slate-700 text-white border-slate-700',
        Completed: 'bg-green-600 text-white border-green-600',
        Pending: 'bg-orange-500 text-white border-orange-500',
        Cancelled: 'bg-gray-500 text-white border-gray-500',
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="grid gap-1">
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <CalendarDays className="h-6 w-6 text-primary" /> Follow-up History
                            </CardTitle>
                            <CardDescription>Completed calls appear at the top. Use tabs to filter by status.</CardDescription>
                        </div>
                        {/* Visible Quick-Filter Tabs */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {tabOptions.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setStatusFilter(tab)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                        statusFilter === tab
                                            ? tabColors[tab]
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                    }`}
                                >
                                    {tab}
                                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${
                                        statusFilter === tab ? 'bg-white/30' : 'bg-slate-100'
                                    }`}>
                                        {counts[tab]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Patient</TableHead>
                                    <TableHead>Follow-up Date</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Call Outcome</TableHead>
                                    <TableHead>Handled By</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredFollowUps.map((fu) => (
                                    <TableRow key={fu.id} className={cn("group", fu.status === 'Completed' && "bg-green-50/40 hover:bg-green-50/60")}>
                                        <TableCell>
                                            <div className="font-medium">{fu.patientName}</div>
                                            <div className="text-xs text-muted-foreground">{fu.patientMobile}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-3 w-3 text-muted-foreground" />
                                                {format(parseISO(fu.followUpDate), 'dd MMM yyyy')}
                                            </div>
                                            {fu.status === 'Completed' && (fu as any).completedAt && (
                                                <div className="text-[10px] text-green-600 mt-0.5">
                                                    Done: {format(parseISO((fu as any).completedAt), 'dd MMM, h:mm a')}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[200px] truncate" title={fu.reason}>
                                                {fu.reason || 'General'}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(fu)}</TableCell>
                                        <TableCell>
                                            <div className="max-w-[250px] text-xs italic text-muted-foreground line-clamp-2">
                                                {fu.callOutcome || <span className="text-slate-300">—</span>}
                                            </div>
                                            {fu.remarks && (
                                                <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]" title={fu.remarks}>
                                                    📝 {fu.remarks}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {fu.calledBy ? (
                                                <div className="grid gap-0.5">
                                                    <span className="text-sm font-medium">{fu.calledBy}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">{fu.calledByRole}</span>
                                                </div>
                                            ) : <span className="text-slate-300">—</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    {(user?.role === 'Operations Manager' || user?.role === 'Admin') && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => {
                                                                setSelectedFollowUp(fu);
                                                                setIsEditDialogOpen(true);
                                                            }}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit Record
                                                            </DropdownMenuItem>
                                                            {fu.status === 'Pending' && (
                                                                <DropdownMenuItem onClick={() => handleUpdate(fu.id, { status: 'Cancelled' })}>
                                                                    <XCircle className="mr-2 h-4 w-4 text-red-500" /> Cancel
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem onClick={() => handleDelete(fu.id)} className="text-red-600">
                                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {(user?.role !== 'Operations Manager' && user?.role !== 'Admin') && (
                                                        <DropdownMenuItem disabled>
                                                            No actions available
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredFollowUps.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            {statusFilter === 'Completed'
                                                ? 'No completed follow-ups yet. Mark follow-ups as done to see them here.'
                                                : 'No follow-up records found matching your filters.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <EditFollowUpDialog 
                open={isEditDialogOpen} 
                onOpenChange={setIsEditDialogOpen} 
                followUp={selectedFollowUp} 
                onSave={handleUpdate} 
            />
        </div>
    );
}
