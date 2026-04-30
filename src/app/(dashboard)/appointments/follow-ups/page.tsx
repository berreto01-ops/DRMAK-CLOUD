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
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    Printer,
    Edit,
    CheckCircle,
    Loader2,
    Bell,
    PlusCircle,
    Calendar as CalendarIcon,
    Search,
    XCircle,
    CheckCircle2,
    CalendarRange,
    Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    addDocumentNonBlocking,
    updateDocumentNonBlocking,
    deleteDocumentNonBlocking,
    useUser
} from '@/firebase';
import type { FollowUp, Patient } from '@/lib/types';
import { collection, doc, query, orderBy, where, addDoc } from 'firebase/firestore';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useSearch } from '@/context/SearchProvider';
import { format, startOfWeek, addDays, eachDayOfInterval, startOfHour, addHours, isSameDay, isSameHour, isPast, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { DatePicker } from '@/components/DatePicker';

// ─── Add Follow-up Dialog ───────────────────────────────────────────────────

const AddFollowUpDialog = ({ open, onOpenChange, onFollowUpAdded }: { open: boolean, onOpenChange: (open: boolean) => void, onFollowUpAdded: () => void }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [patientId, setPatientId] = React.useState<string>('');
    const [patientSearch, setPatientSearch] = React.useState<string>('');
    const [isPatientOpen, setIsPatientOpen] = React.useState(false);
    const [date, setDate] = React.useState<Date | undefined>(new Date());
    const [reason, setReason] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const patientsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'patients') : null, [firestore]);
    const { data: patients } = useCollection<Patient>(patientsQuery);

    const filteredPatients = React.useMemo(() => {
        if (!patients) return [];
        const term = (patientSearch || '').toLowerCase().trim();
        if (!term) return patients.slice(0, 200);

        return patients.filter(p => {
            const name = (p.name || '').toLowerCase();
            const phone = (p.mobileNumber || '').toLowerCase();
            return name.includes(term) || phone.includes(term);
        }).slice(0, 200);
    }, [patients, patientSearch]);

    const selectedPatientData = React.useMemo(() => {
        return patients?.find(p => p.id === patientId);
    }, [patients, patientId]);

    const handleSubmit = async () => {
        if (!firestore) return;
        
        if (!date || !patientId) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please select a patient and a follow-up date.',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const newFollowUp: Omit<FollowUp, 'id'> = {
                patientId,
                patientName: selectedPatientData?.name || 'Unknown',
                patientMobile: selectedPatientData?.mobileNumber || '',
                followUpDate: date.toISOString(),
                reason: reason.trim() || 'General Follow-up',
                notes: notes.trim(),
                status: 'Pending',
                createdAt: new Date().toISOString(),
            };

            await addDoc(collection(firestore, 'followUps'), newFollowUp);
            
            toast({
                title: 'Successfully Scheduled',
                description: `Follow-up for ${selectedPatientData?.name} set for ${format(date, 'PPP')}.`,
            });
            
            // Success cleanup
            onFollowUpAdded();
            onOpenChange(false);
            setPatientId('');
            setReason('');
            setNotes('');
            setDate(new Date());
        } catch (error: any) {
            console.error("Error scheduling follow-up:", error);
            toast({
                variant: 'destructive',
                title: 'Scheduling Failed',
                description: error.message || 'An error occurred while saving. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Schedule New Follow-up</DialogTitle>
                    <DialogDescription>
                        Set a follow-up reminder for a patient.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Patient</Label>
                        <div className="relative">
                            <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal"
                                onClick={() => setIsPatientOpen(!isPatientOpen)}
                            >
                                <span className="truncate">
                                    {selectedPatientData ? (
                                        `${selectedPatientData.name} - ${selectedPatientData.mobileNumber}`
                                    ) : (
                                        <span className="text-muted-foreground">Select a patient...</span>
                                    )}
                                </span>
                                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>

                            {isPatientOpen && (
                                <div className="absolute top-full left-0 z-[100] w-full mt-2 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
                                    <div className="flex flex-col h-[300px]">
                                        <div className="p-2 border-b flex items-center gap-2">
                                            <Input
                                                placeholder="Search name or mobile..."
                                                value={patientSearch}
                                                onChange={(e) => setPatientSearch(e.target.value)}
                                                autoFocus
                                            />
                                            <Button size="icon" variant="ghost" onClick={() => setIsPatientOpen(false)}>
                                              <XCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-1">
                                            {filteredPatients.map(p => (
                                                <Button
                                                    key={p.id}
                                                    variant="ghost"
                                                    className="w-full justify-start h-auto py-2 px-3 flex flex-col items-start gap-0.5"
                                                    onClick={() => {
                                                        setPatientId(p.id);
                                                        setIsPatientOpen(false);
                                                    }}
                                                >
                                                    <span className="text-sm font-semibold">{p.name}</span>
                                                    <span className="text-xs text-muted-foreground">{p.mobileNumber}</span>
                                                </Button>
                                            ))}
                                            {filteredPatients.length === 0 && (
                                                <div className="p-4 text-center text-sm text-muted-foreground">
                                                    No patients found.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Follow-up Date</Label>
                        <div className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl">
                            {date ? format(date, 'PPP') : 'No date selected'}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs h-7"
                                onClick={() => setDate(new Date())}>Today</Button>
                            <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs h-7"
                                onClick={() => setDate(addDays(new Date(), 1))}>Tomorrow</Button>
                            <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs h-7"
                                onClick={() => setDate(addDays(new Date(), 7))}>+1 Week</Button>
                            <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs h-7"
                                onClick={() => setDate(addDays(new Date(), 30))}>+1 Month</Button>
                        </div>
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(d) => { if (d) setDate(d); }}
                            className="rounded-xl border shadow-sm"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Reason</Label>
                        <Input
                            placeholder="e.g., Post-laser check, Vaccine dose 2..."
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea
                            placeholder="Additional details..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className={cn(
                            "w-full h-12 rounded-xl font-bold transition-all shadow-lg",
                            (!patientId || !date) ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
                        )}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving Details...
                            </>
                        ) : 'Confirm & Schedule Follow-up'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Complete Follow-up Dialog ────────────────────────────────────────────────

const CompleteFollowUpDialog = ({ open, onOpenChange, followUp, onComplete, currentUser }: { 
    open: boolean; 
    onOpenChange: (v: boolean) => void; 
    followUp: FollowUp | null;
    onComplete: (id: string, outcome: string, caller: string, remarks: string) => Promise<void>;
    currentUser: any;
}) => {
    const [outcome, setOutcome] = React.useState('');
    const [callerName, setCallerName] = React.useState('');
    const [remarks, setRemarks] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setOutcome('');
            setRemarks('');
            setCallerName(currentUser?.name || '');
        }
    }, [open, currentUser]);

    if (!followUp) return null;

    const handleSave = async () => {
        setSaving(true);
        await onComplete(followUp.id, outcome, callerName, remarks);
        setSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Complete Follow-up</DialogTitle>
                    <DialogDescription>Details of the follow-up call for <strong>{followUp.patientName}</strong>.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Who Called?</Label>
                            <Input value={callerName} onChange={e => setCallerName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Role</Label>
                            <Input value={currentUser?.role || ''} disabled className="bg-muted" />
                        </div>
                    </div>
                    
                    <div className="space-y-1.5">
                        <Label>Call Outcome / Patient's Reply <span className="text-red-500">*</span></Label>
                        <Textarea 
                            placeholder="Enter what the patient said..." 
                            value={outcome} 
                            onChange={e => setOutcome(e.target.value)} 
                            rows={3} 
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Internal Remarks (Optional)</Label>
                        <Textarea 
                            placeholder="Add any internal notes about this call..." 
                            value={remarks} 
                            onChange={e => setRemarks(e.target.value)} 
                            rows={2} 
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || !outcome.trim() || !callerName.trim()} className="bg-green-600 hover:bg-green-700 text-white">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Mark as Completed
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Follow-up Calendar View ────────────────────────────────────────────────

const FollowUpCalendarView = ({ followUps, week, onSlotClick }: { followUps: FollowUp[], week: Date[], onSlotClick: (date: Date) => void }) => {
    const timeSlots = Array.from({ length: 11 }, (_, i) => addHours(startOfHour(new Date().setHours(8, 0, 0, 0)), i));

    const renderFollowUpBox = (fu: FollowUp) => {
        const fuDate = new Date(fu.followUpDate);
        const dayIndex = week.findIndex(day => isSameDay(day, fuDate));
        if (dayIndex === -1) return null;

        // For follow-ups, we don't have a specific time in the model, 
        // default to placing them at the top or distributing them if multiple.
        // Let's place them in a stack at the top.
        const top = 0; // Stack at the very top for now since we don't have time
        const left = dayIndex * (100 / 7);

        return (
            <div
                key={fu.id}
                className={`absolute p-2 rounded-lg shadow-md border-l-4 transition-all duration-300 z-10 ${fu.status === 'Completed'
                    ? 'bg-muted border-green-500 opacity-60'
                    : isPast(new Date(fu.followUpDate)) && !isToday(new Date(fu.followUpDate))
                        ? 'bg-red-50 border-red-500 dark:bg-red-950/20'
                        : 'bg-orange-50 border-orange-500 dark:bg-orange-950/20'
                    }`}
                style={{ top: `${top}px`, left: `calc(${left}% + 4px)`, width: 'calc(100% / 7 - 8px)', minHeight: '60px' }}
            >
                <p className="text-xs font-bold truncate pr-6">{fu.patientName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{fu.reason || 'No reason specified'}</p>
                {fu.status === 'Pending' && (
                    <div className="flex gap-1 mt-1 justify-end">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 cursor-pointer" />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="relative grid grid-cols-[auto_1fr]">
            <div className="grid grid-rows-1">
                <div className="h-[600px] pr-2 text-right text-sm text-muted-foreground font-medium py-2">All Day</div>
            </div>

            <div className="grid grid-cols-7 border-l">
                {week.map(day => (
                    <div
                        key={day.toISOString()}
                        className="border-r h-[600px] hover:bg-muted/30 transition-colors relative"
                        onClick={() => onSlotClick(day)}
                    >
                    </div>
                ))}
                {followUps.map(fu => renderFollowUpBox(fu))}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FollowUpCalendarPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { searchTerm } = useSearch();
    const firestore = useFirestore();
    const { user } = useUser();

    const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
    const [isAdding, setIsAdding] = React.useState(false);
    const [isCompleting, setIsCompleting] = React.useState(false);
    const [selectedFollowUp, setSelectedFollowUp] = React.useState<FollowUp | null>(null);
    const [selectedSlot, setSelectedSlot] = React.useState<Date | undefined>();
    const [viewMode, setViewMode] = React.useState<'week' | 'month'>('week');

    const followUpsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Simplified query to avoid index requirements during initial setup
        return collection(firestore, 'followUps');
    }, [firestore]);

    const { data: allFollowUps, isLoading, forceRerender } = useCollection<FollowUp>(followUpsQuery);

    const week = React.useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end: addDays(start, 6) });
    }, [currentDate]);

    const filteredFollowUps = React.useMemo(() => {
        if (!allFollowUps) return [];
        let filtered = allFollowUps;

        const term = searchTerm.toLowerCase();
        if (term) {
            filtered = filtered.filter(fu =>
                fu.patientName.toLowerCase().includes(term) ||
                fu.patientMobile.includes(term) ||
                (fu.reason || '').toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [allFollowUps, searchTerm]);

    const weekFollowUps = React.useMemo(() => {
        const start = week[0];
        const end = addDays(week[6], 1); // End of week
        return filteredFollowUps.filter(fu => {
            const date = new Date(fu.followUpDate);
            return date >= start && date < end;
        });
    }, [filteredFollowUps, week]);

    const handleUpdateStatus = async (fuId: string, status: FollowUp['status'], outcome?: string, caller?: string, remarks?: string) => {
        if (!firestore) return;
        const updateData: any = { status };
        if (outcome) {
            updateData.callOutcome = outcome;
            updateData.remarks = remarks || '';
            updateData.calledBy = caller || (user?.name || '');
            if (user) {
                updateData.calledByRole = user.role;
            }
        }
        if (status === 'Completed') {
            updateData.completedAt = new Date().toISOString();
        }
        
        await updateDocumentNonBlocking(doc(firestore, 'followUps', fuId), updateData);
        toast({ title: 'Status Updated', description: outcome ? 'The call outcome has been saved.' : `Follow-up is now ${status}.` });
        forceRerender();
    };

    const handleDelete = async (fuId: string) => {
        if (!firestore) return;
        await deleteDocumentNonBlocking(doc(firestore, 'followUps', fuId));
        toast({ title: 'Follow-up Removed', variant: 'destructive' });
        forceRerender();
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col h-full gap-6">
            <Card className="flex-shrink-0">
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="grid gap-1">
                                <h1 className="text-2xl font-bold flex items-center gap-2">
                                    <CalendarRange className="h-6 w-6 text-primary" /> Follow-up Calendar
                                </h1>
                                <Badge variant="outline" className="w-fit">Patient Reminders & Retention</Badge>
                            </div>
                            <DatePicker date={currentDate} onDateChange={(d) => setCurrentDate(d || new Date())} />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center rounded-md border p-1">
                                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(prev => addDays(prev, -7))}><ChevronLeft /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(prev => addDays(prev, 7))}><ChevronRight /></Button>
                                <Button variant="ghost" onClick={() => setCurrentDate(new Date())}>Today</Button>
                            </div>
                            <Button className="gap-2" onClick={() => setIsAdding(true)}>
                                <PlusCircle className="h-4 w-4" /> Schedule Follow-up
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid lg:grid-cols-4 gap-6 flex-grow">
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <div className="grid grid-cols-7 text-center border-b pb-4">
                            {week.map(day => (
                                <div key={day.toISOString()} className={`p-2 ${isSameDay(day, currentDate) ? 'bg-primary/10 rounded-md' : ''}`}>
                                    <p className="text-xs uppercase font-bold text-muted-foreground">{format(day, 'EEE')}</p>
                                    <p className="text-lg font-semibold">{format(day, 'dd')}</p>
                                </div>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent className="h-[600px] overflow-auto pt-0">
                        <FollowUpCalendarView
                            followUps={weekFollowUps}
                            week={week}
                            onSlotClick={(date) => {
                                setSelectedSlot(date);
                                setIsAdding(true);
                            }}
                        />
                    </CardContent>
                </Card>

                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-lg">Weekly List</CardTitle>
                        <CardDescription>{weekFollowUps.length} follow-ups scheduled</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-auto space-y-4">
                        {weekFollowUps.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No follow-ups this week</p>
                            </div>
                        ) : (
                            weekFollowUps.map(fu => (
                                <div key={fu.id} className="p-3 rounded-lg border bg-card text-sm space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div className="grid gap-0.5">
                                            <p className="font-bold">{fu.patientName}</p>
                                            <p className="text-xs text-muted-foreground">{format(new Date(fu.followUpDate), 'EEE, dd MMM')}</p>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="ghost" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                {(user?.role === 'Operations Manager' || user?.role === 'Admin') && (
                                                    <DropdownMenuItem onClick={() => {
                                                        setSelectedFollowUp(fu);
                                                        setIsCompleting(true);
                                                    }}>
                                                        <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Mark Completed
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(fu.id, 'Cancelled')}>
                                                    <XCircle className="mr-2 h-4 w-4 text-red-600" /> Cancel
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => router.push(`/patients/details?id=${fu.patientId}`)}>
                                                    <Search className="mr-2 h-4 w-4" /> View Patient
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(fu.id)} className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <p className="text-xs italic bg-muted/50 p-2 rounded">{fu.reason || 'Regular Check-up'}</p>
                                    {fu.callOutcome && (
                                        <div className="p-2.5 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-100 dark:border-green-900">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-[9px] font-bold text-green-700 dark:text-green-400 uppercase">Call Outcome</p>
                                                {fu.calledBy && (
                                                    <span className="text-[9px] text-green-600 font-medium">{fu.calledBy}</span>
                                                )}
                                            </div>
                                            <p className="text-xs italic text-green-800 dark:text-green-300">"{fu.callOutcome}"</p>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <Badge
                                            variant={fu.status === 'Completed' ? 'outline' : 'secondary'}
                                            className={fu.status === 'Completed' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                                        >
                                            {fu.status}
                                        </Badge>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => router.push(`tel:${fu.patientMobile}`)}>
                                            Call
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            <AddFollowUpDialog
                open={isAdding}
                onOpenChange={setIsAdding}
                onFollowUpAdded={forceRerender}
            />

            <CompleteFollowUpDialog 
                open={isCompleting}
                onOpenChange={setIsCompleting}
                followUp={selectedFollowUp}
                onComplete={async (id, outcome, caller, remarks) => {
                    await handleUpdateStatus(id, 'Completed', outcome, caller, remarks);
                }}
                currentUser={user}
            />
        </div>
    );
}
