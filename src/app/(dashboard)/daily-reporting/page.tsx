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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Send, Save, PieChart, Activity, UserPlus, Video, PlusCircle, Trash2 } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import type { DailyReport, DailyPosting, Lead } from '@/lib/types';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function DailyReportingPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();

    const [summary, setSummary] = React.useState('');
    const [plans, setPlans] = React.useState('');
    const [completingTasks, setCompletingTasks] = React.useState('');
    const [showTasks, setShowTasks] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [editingReport, setEditingReport] = React.useState<DailyReport | null>(null);

    // Fetch past reports
    const reportsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(collection(firestore, 'dailyReports'), where('userId', '==', user.id), orderBy('reportDate', 'desc'));
    }, [firestore, user?.id]);

    const { data: reports, isLoading: reportsLoading, error, forceRerender } = useCollection<DailyReport>(reportsQuery);

    // Fetch Today's Postings for summary glance
    const todayPostingsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return query(
            collection(firestore, 'dailyPostings'),
            where('userId', '==', user.id),
            where('postedAt', '>=', start.toISOString())
        );
    }, [firestore, user?.id]);
    const { data: todayPostings } = useCollection<DailyPosting>(todayPostingsQuery);

    // Fetch Today's Lead Activity
    const todayLeadsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return query(
            collection(firestore, 'leads'),
            where('assignedTo', '==', user.id),
            where('createdAt', '>=', start.toISOString())
        );
    }, [firestore, user?.id]);
    const { data: todayLeads } = useCollection<Lead>(todayLeadsQuery);

    const lastErrorRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (error && error.message !== lastErrorRef.current) {
            console.error("DailyReporting Error:", error);
            lastErrorRef.current = error.message;
            if ((error as any).code !== 'permission-denied') {
                toast({
                    variant: 'destructive',
                    title: 'Database Error',
                    description: error.message || 'An error occurred while fetching your reports.',
                });
            }
        } else if (!error) {
            lastErrorRef.current = null;
        }
    }, [error, toast]);
    const handleReportSubmit = async () => {
        if (!firestore || !user) {
            toast({ variant: "destructive", title: "Error", description: "Authentication error." });
            return;
        }
        if (!summary.trim() || !plans.trim()) {
            toast({ variant: "destructive", title: "Missing Information", description: "Please fill out both summary and plans." });
            return;
        }

        setIsSubmitting(true);
        const report = {
            userId: user.id,
            reportDate: new Date().toISOString(),
            summary,
            plans,
            completingTasks: showTasks ? completingTasks : '',
        };

        try {
            if (editingReport) {
                const { id, ...rest } = report as any;
                await updateDoc(doc(firestore, 'dailyReports', editingReport.id), report);
                toast({ title: "Report Updated", description: "Changes have been saved." });
            } else {
                await addDocumentNonBlocking(collection(firestore, 'dailyReports'), report);
                toast({ title: "Report Submitted", description: "Your daily report has been saved." });
            }
            setSummary('');
            setPlans('');
            setCompletingTasks('');
            setShowTasks(false);
            setEditingReport(null);
        } catch (error) {
            console.error("Failed to submit report:", error);
            toast({ variant: "destructive", title: "Submission Failed", description: "Could not save your report." });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleDeleteReport = async (reportId: string) => {
        if (!firestore) return;
        if (!window.confirm('Are you sure you want to delete this report?')) return;

        try {
            await deleteDocumentNonBlocking(doc(firestore, 'dailyReports', reportId));
            toast({ title: "Report Deleted", description: "The daily report has been removed." });
            if (forceRerender) forceRerender();
        } catch (error) {
            toast({ variant: "destructive", title: "Delete Failed", description: "Could not remove the report." });
        }
    }

    const startEditing = (report: DailyReport) => {
        setEditingReport(report);
        setSummary(report.summary);
        setPlans(report.plans);
        setCompletingTasks(report.completingTasks || '');
        setShowTasks(!!report.completingTasks);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const cancelEditing = () => {
        setEditingReport(null);
        setSummary('');
        setPlans('');
        setCompletingTasks('');
        setShowTasks(false);
    }

    return (
        <div className="space-y-6">
            {/* Today's Activity Glance */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50 dark:bg-blue-900/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-blue-600" />
                            New Leads Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{todayLeads?.length || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Leads assigned to you</p>
                    </CardContent>
                </Card>
                <Card className="bg-purple-50 dark:bg-purple-900/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Video className="h-4 w-4 text-purple-600" />
                            Social Postings
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{todayPostings?.length || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Updates logged today</p>
                    </CardContent>
                </Card>
                <Card className="bg-green-50 dark:bg-green-900/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Activity className="h-4 w-4 text-green-600" />
                            Efficiency
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">100%</div>
                        <p className="text-xs text-muted-foreground mt-1">Report pending submission</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-6 w-6" />
                        {editingReport ? 'Edit Daily Report' : 'Day End Report'}
                    </CardTitle>
                    <CardDescription>
                        {editingReport ? `Editing report from ${format(new Date(editingReport.reportDate), 'MMM dd, yyyy')}` : 'Consolidate your daily activities and set objectives for tomorrow.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="summary">Today's Summary</Label>
                            <Textarea
                                id="summary"
                                placeholder="Key achievements? Major lead conversions? Successful postings?"
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={6}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="plans">Plans for Tomorrow</Label>
                            <Textarea
                                id="plans"
                                placeholder="Major targets? Follow-up calls? Content creation plans?"
                                value={plans}
                                onChange={(e) => setPlans(e.target.value)}
                                rows={6}
                            />
                        </div>
                    </div>

                    {!showTasks ? (
                        <Button variant="outline" className="w-full" onClick={() => setShowTasks(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Write your today's completing tasks
                        </Button>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="tasks">Today's Completing Tasks</Label>
                            <Textarea
                                id="tasks"
                                placeholder="What tasks did you complete today?"
                                value={completingTasks}
                                onChange={(e) => setCompletingTasks(e.target.value)}
                                rows={4}
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        {editingReport && (
                            <Button variant="ghost" onClick={cancelEditing}>
                                Cancel Edit
                            </Button>
                        )}
                        <Button onClick={handleReportSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingReport ? <Save className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />)}
                            {editingReport ? 'Update Report' : 'Submit End Day Report'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Reporting History</CardTitle>
                    <CardDescription>A track record of your past performance.</CardDescription>
                </CardHeader>
                <CardContent>
                    {reportsLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Summary</TableHead>
                                    <TableHead>Plans</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reports?.map(report => (
                                    <TableRow key={report.id}>
                                        <TableCell className="font-medium whitespace-nowrap">{format(new Date(report.reportDate), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell><p className="line-clamp-2 text-sm">{report.summary}</p></TableCell>
                                        <TableCell><p className="line-clamp-2 text-sm">{report.plans}</p></TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => startEditing(report)} className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-700">
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report.id)} className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {reports?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                            No reports found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
