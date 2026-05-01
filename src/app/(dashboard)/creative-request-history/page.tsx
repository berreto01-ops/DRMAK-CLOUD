'use client';
import * as React from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
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
    Loader2,
    Clock,
    Palette,
    ExternalLink,
    Trash2,
    Eye,
    CheckCircle2,
    XCircle,
    AlertCircle,
    PlayCircle,
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    useCollection,
    useFirestore,
    useMemoFirebase,
    useUser,
    deleteDocumentNonBlocking,
} from '@/firebase';
import type { DesignRequest } from '@/lib/types';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSearch } from '@/context/SearchProvider';

// ─── Status Badge Helper ────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: DesignRequest['status'] }) => {
    const config: Record<DesignRequest['status'], { label: string; className: string; icon: React.ReactNode }> = {
        'Pending':    { label: 'Pending',     className: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock className="h-3 w-3" /> },
        'In Progress':{ label: 'In Progress', className: 'bg-blue-100 text-blue-700 border-blue-200',       icon: <PlayCircle className="h-3 w-3" /> },
        'Submitted':  { label: 'Submitted',   className: 'bg-purple-100 text-purple-700 border-purple-200', icon: <AlertCircle className="h-3 w-3" /> },
        'Approved':   { label: 'Approved',    className: 'bg-green-100 text-green-700 border-green-200',    icon: <CheckCircle2 className="h-3 w-3" /> },
        'Rejected':   { label: 'Rejected',    className: 'bg-red-100 text-red-700 border-red-200',          icon: <XCircle className="h-3 w-3" /> },
    };
    const c = config[status] || config['Pending'];
    return (
        <Badge className={cn('inline-flex items-center gap-1 font-semibold border', c.className)}>
            {c.icon} {c.label}
        </Badge>
    );
};

// ─── Detail Dialog ──────────────────────────────────────────────────────────

const DetailDialog = ({ open, onOpenChange, request, user, onOpenSubmit }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    request: DesignRequest | null;
    user: any;
    onOpenSubmit: (id: string, url: string) => void;
}) => {
    if (!request) return null;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-purple-600" /> {request.title}
                    </DialogTitle>
                    <DialogDescription>
                        Creative request details and current status.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-2">
                    <div className="flex items-center justify-between">
                        <StatusBadge status={request.status} />
                        <span className="text-xs text-muted-foreground">
                            Requested: {format(parseISO(request.createdAt), 'dd MMM yyyy, h:mm a')}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Asset Type</p>
                            <p className="font-semibold">{request.assetType}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Deadline</p>
                            <p className="font-semibold">
                                {request.deadline
                                    ? format(parseISO(request.deadline), 'dd MMM yyyy')
                                    : <span className="text-muted-foreground">Not set</span>}
                            </p>
                        </div>
                    </div>
                    {request.description && (
                        <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Brief / Requirements</p>
                            <p className="text-sm whitespace-pre-wrap">{request.description}</p>
                        </div>
                    )}
                    {request.submissionUrl && (
                        <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                            <p className="text-[10px] font-bold uppercase text-green-700 mb-2">Designer Submission</p>
                            <a
                                href={request.submissionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-green-700 font-semibold hover:underline"
                            >
                                <ExternalLink className="h-3.5 w-3.5" /> View Submitted File
                            </a>
                        </div>
                    )}
                </div>
                {(user?.role === 'Designer' || user?.role === 'Admin') && request.status !== 'Approved' && (
                    <DialogFooter>
                        <Button
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={() => {
                                onOpenSubmit(request.id, request.submissionUrl || '');
                                onOpenChange(false);
                            }}
                        >
                            <Palette className="mr-2 h-4 w-4" /> Submit Design
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CreativeRequestHistoryPage() {
    const { toast } = useToast();
    const { searchTerm } = useSearch();
    const firestore = useFirestore();
    const { user } = useUser();
    const [selectedRequest, setSelectedRequest] = React.useState<DesignRequest | null>(null);
    const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    const [statusFilter, setStatusFilter] = React.useState<'All' | DesignRequest['status']>('All');

    // Submission State for Designers
    const [submissionUrl, setSubmissionUrl] = React.useState('');
    const [isSubmittingAsset, setIsSubmittingAsset] = React.useState(false);
    const [submitRequestId, setSubmitRequestId] = React.useState<string | null>(null);

    const handleSubmitRequest = async () => {
        if (!submissionUrl || !submitRequestId || !firestore) return;

        setIsSubmittingAsset(true);
        try {
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(firestore, 'designRequests', submitRequestId), {
                status: 'Submitted',
                submissionUrl: submissionUrl,
                updatedAt: new Date().toISOString(),
            });
            toast({ title: 'Submitted', description: 'Design submitted to requester!' });
            setSubmissionUrl('');
            setSubmitRequestId(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit.' });
        } finally {
            setIsSubmittingAsset(false);
        }
    };

    // Admins/Designers see all requests; Social Media Managers see only their own
    const requestsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(collection(firestore, 'designRequests'), orderBy('createdAt', 'desc'));
    }, [firestore, user?.id]);

    const { data: allRequests, isLoading } = useCollection<DesignRequest>(requestsQuery);

    // Counts for tabs
    const counts = React.useMemo(() => {
        if (!allRequests) return { All: 0, Pending: 0, 'In Progress': 0, Submitted: 0, Approved: 0, Rejected: 0 };
        const base = allRequests.filter(r =>
            user?.role === 'Designer' || user?.role === 'Admin'
                ? true
                : r.requesterId === user?.id
        );
        return {
            All: base.length,
            Pending: base.filter(r => r.status === 'Pending').length,
            'In Progress': base.filter(r => r.status === 'In Progress').length,
            Submitted: base.filter(r => r.status === 'Submitted').length,
            Approved: base.filter(r => r.status === 'Approved').length,
            Rejected: base.filter(r => r.status === 'Rejected').length,
        };
    }, [allRequests, user?.id, user?.role]);

    const filteredRequests = React.useMemo(() => {
        if (!allRequests || !user?.id) return [];

        // Role-based visibility: Designers & Admins see all, SMM sees only their own
        let filtered = allRequests.filter(r =>
            user.role === 'Designer' || user.role === 'Admin'
                ? true
                : r.requesterId === user.id
        );

        if (statusFilter !== 'All') {
            filtered = filtered.filter(r => r.status === statusFilter);
        }

        const term = (searchTerm || '').toLowerCase();
        if (term) {
            filtered = filtered.filter(r =>
                (r.title || '').toLowerCase().includes(term) ||
                (r.assetType || '').toLowerCase().includes(term) ||
                (r.description || '').toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [allRequests, statusFilter, searchTerm, user?.id, user?.role]);

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        if (!confirm('Delete this creative request permanently?')) return;
        await deleteDocumentNonBlocking(doc(firestore, 'designRequests', id));
        toast({ title: 'Request Deleted', variant: 'destructive' });
    };

    const tabOptions: Array<'All' | DesignRequest['status']> = ['All', 'Pending', 'In Progress', 'Submitted', 'Approved', 'Rejected'];
    const tabColors: Record<string, string> = {
        All:         'bg-slate-700 text-white border-slate-700',
        Pending:     'bg-yellow-500 text-white border-yellow-500',
        'In Progress': 'bg-blue-600 text-white border-blue-600',
        Submitted:   'bg-purple-600 text-white border-purple-600',
        Approved:    'bg-green-600 text-white border-green-600',
        Rejected:    'bg-red-600 text-white border-red-600',
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
                            <Palette className="h-10 w-10 text-purple-600" />
                            Requested Creatives
                        </h1>
                        <p className="text-slate-500 font-medium">
                            {user?.role === 'Designer' || user?.role === 'Admin'
                                ? 'Reviewing all creative requests across the team.'
                                : 'Tracking your submitted creative requests and status.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                        {tabOptions.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setStatusFilter(tab)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all duration-200",
                                    statusFilter === tab
                                        ? tabColors[tab] + " shadow-md"
                                        : "bg-transparent text-slate-500 hover:bg-slate-50"
                                )}
                            >
                                {tab}
                                <span className={cn(
                                    "flex items-center justify-center w-5 h-5 rounded-lg text-[10px]",
                                    statusFilter === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                )}>
                                    {counts[tab as keyof typeof counts] ?? 0}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRequests.map(r => (
                    <Card 
                        key={r.id} 
                        className={cn(
                            "group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-slate-200/60 flex flex-col",
                            r.status === 'Approved' && "bg-gradient-to-br from-white to-green-50/30 border-green-100",
                            r.status === 'Rejected' && "bg-gradient-to-br from-white to-red-50/30 border-red-100",
                            r.status === 'Submitted' && "bg-gradient-to-br from-white to-purple-50/30 border-purple-100"
                        )}
                    >
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-2">
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none text-[10px] uppercase font-black tracking-widest px-2 py-0.5">
                                    {r.assetType}
                                </Badge>
                                <StatusBadge status={r.status} />
                            </div>
                            <CardTitle className="text-xl font-black leading-tight mt-4 line-clamp-2 min-h-[3.5rem] text-slate-800">
                                {r.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 flex-grow space-y-4">
                            <p className="text-sm text-slate-500 font-medium line-clamp-3 min-h-[3rem]">
                                {r.description || "No specific requirements provided for this asset."}
                            </p>
                            
                            <div className="space-y-2.5 pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                                    <span className="text-slate-400 flex items-center gap-1.5">
                                        <Clock className="h-3 w-3" /> Requested
                                    </span>
                                    <span className="text-slate-600">{format(parseISO(r.createdAt), 'dd MMM yyyy')}</span>
                                </div>
                                {r.deadline && (
                                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                                        <span className="text-slate-400 flex items-center gap-1.5">
                                            <AlertCircle className="h-3 w-3 text-red-500" /> Deadline
                                        </span>
                                        <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">{format(parseISO(r.deadline), 'dd MMM yyyy')}</span>
                                    </div>
                                )}
                            </div>

                            {r.submissionUrl && (
                                <div className="pt-2">
                                    <a 
                                        href={r.submissionUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-purple-600 text-white rounded-2xl text-[10px] font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" /> VIEW SUBMISSION
                                    </a>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="bg-slate-50/50 p-4 flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 font-black text-[10px] h-9 rounded-xl border-slate-200 hover:bg-white"
                                onClick={() => { setSelectedRequest(r); setIsDetailOpen(true); }}
                            >
                                <Eye className="mr-1.5 h-3.5 w-3.5" /> DETAILS
                            </Button>
                            
                            {(user?.role === 'Designer' || user?.role === 'Admin') && r.status !== 'Approved' && (
                                <Button 
                                    size="sm" 
                                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] h-9 rounded-xl shadow-lg shadow-slate-200"
                                    onClick={() => { setSubmitRequestId(r.id); setSubmissionUrl(r.submissionUrl || ''); }}
                                >
                                    <Palette className="mr-1.5 h-3.5 w-3.5" /> SUBMIT
                                </Button>
                            )}

                            {(user?.role === 'Admin' || r.requesterId === user?.id) && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                                    onClick={() => handleDelete(r.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                ))}
                {filteredRequests.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="h-16 w-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                            <Palette className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-black text-slate-900">No requests found</h3>
                        <p className="text-slate-500 font-medium text-sm mt-1">
                            {statusFilter === 'All' 
                                ? "There are no creative requests in the system yet." 
                                : `No requests found with status "${statusFilter}"`}
                        </p>
                    </div>
                )}
            </div>

            {/* Submission Dialog for Designers */}
            <Dialog open={!!submitRequestId} onOpenChange={(open) => !open && setSubmitRequestId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Submit Design</DialogTitle>
                        <DialogDescription>Paste the link to your completed design.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Submission URL (Canva, Drive, Link)</Label>
                            <Input
                                placeholder="Paste link here..."
                                value={submissionUrl}
                                onChange={e => setSubmissionUrl(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSubmitRequestId(null)}>Cancel</Button>
                        <Button
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={handleSubmitRequest}
                            disabled={isSubmittingAsset}
                        >
                            {isSubmittingAsset ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Fulfill Request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DetailDialog
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                request={selectedRequest}
                user={user}
                onOpenSubmit={(id, url) => {
                    setSubmitRequestId(id);
                    setSubmissionUrl(url);
                }}
            />
        </div>
    );
}
