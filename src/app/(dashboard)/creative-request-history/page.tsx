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
} from '@/components/ui/dialog';
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

const DetailDialog = ({ open, onOpenChange, request }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    request: DesignRequest | null;
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

    // Admins/Designers see all requests; Social Media Managers see only their own
    const requestsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'designRequests'), orderBy('createdAt', 'desc'));
    }, [firestore, user]);

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
    }, [allRequests, user]);

    const filteredRequests = React.useMemo(() => {
        if (!allRequests || !user) return [];

        // Role-based visibility: Designers & Admins see all, SMM sees only their own
        let filtered = allRequests.filter(r =>
            user.role === 'Designer' || user.role === 'Admin'
                ? true
                : r.requesterId === user.id
        );

        if (statusFilter !== 'All') {
            filtered = filtered.filter(r => r.status === statusFilter);
        }

        const term = searchTerm.toLowerCase();
        if (term) {
            filtered = filtered.filter(r =>
                (r.title || '').toLowerCase().includes(term) ||
                (r.assetType || '').toLowerCase().includes(term) ||
                (r.description || '').toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [allRequests, statusFilter, searchTerm, user]);

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
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="grid gap-1">
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <Palette className="h-6 w-6 text-purple-600" /> Request Creative History
                            </CardTitle>
                            <CardDescription>
                                {user?.role === 'Designer' || user?.role === 'Admin'
                                    ? 'All creative requests across the team — sorted by most recent.'
                                    : 'All creative requests you have submitted — track status and designer submissions.'}
                            </CardDescription>
                        </div>
                        {/* Filter Tabs */}
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
                                        {counts[tab as keyof typeof counts] ?? 0}
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
                                    <TableHead>Title</TableHead>
                                    <TableHead>Asset Type</TableHead>
                                    <TableHead>Requested On</TableHead>
                                    <TableHead>Deadline</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Submission</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.map(r => (
                                    <TableRow
                                        key={r.id}
                                        className={cn(
                                            'group cursor-pointer',
                                            r.status === 'Approved' && 'bg-green-50/40 hover:bg-green-50/60',
                                            r.status === 'Rejected' && 'bg-red-50/30 hover:bg-red-50/50',
                                            r.status === 'Submitted' && 'bg-purple-50/30 hover:bg-purple-50/50',
                                        )}
                                        onClick={() => { setSelectedRequest(r); setIsDetailOpen(true); }}
                                    >
                                        <TableCell>
                                            <div className="font-semibold text-sm max-w-[200px] truncate" title={r.title}>{r.title}</div>
                                            {r.description && (
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={r.description}>
                                                    {r.description}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs font-medium">{r.assetType}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {format(parseISO(r.createdAt), 'dd MMM yyyy')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">
                                                {r.deadline
                                                    ? format(parseISO(r.deadline), 'dd MMM yyyy')
                                                    : <span className="text-muted-foreground/40">—</span>}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={r.status} />
                                        </TableCell>
                                        <TableCell>
                                            {r.submissionUrl ? (
                                                <a
                                                    href={r.submissionUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:underline"
                                                >
                                                    <ExternalLink className="h-3 w-3" /> View File
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground/40 text-xs">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => { setSelectedRequest(r); setIsDetailOpen(true); }}>
                                                        <Eye className="mr-2 h-4 w-4" /> View Details
                                                    </DropdownMenuItem>
                                                    {(user?.role === 'Admin' || r.requesterId === user?.id) && (
                                                        <DropdownMenuItem onClick={() => handleDelete(r.id)} className="text-red-600">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredRequests.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            {statusFilter === 'All'
                                                ? 'No creative requests yet. Use "Request Creative" from your dashboard to submit one.'
                                                : `No requests with status "${statusFilter}" found.`}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <DetailDialog
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                request={selectedRequest}
            />
        </div>
    );
}
