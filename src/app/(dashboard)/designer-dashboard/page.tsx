'use client';
import * as React from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    LayoutDashboard,
    Sparkles,
    Briefcase,
    Clock,
    CheckCircle2,
    Plus,
    Loader2,
    PenTool,
    ExternalLink,
    Palette,
    Share2,
    Activity,
    Trash2,
    Circle,
    ListTodo as ListIcon,
    CalendarCheck
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { DesignerWork, AdminTaskTemplate, DesignRequest, DailyReport, DailyTask } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function DesignerDashboardPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const userId = user?.id;
    const { toast } = useToast();

    // Form State
    const [assetType, setAssetType] = React.useState('Post Graphic');
    const [title, setTitle] = React.useState('');
    const [assetLink, setAssetLink] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Productivity Config
    const dailyGoal = 3;

    // Queries
    const workQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(
            collection(firestore, 'designerWork'),
            where('userId', '==', userId),
            orderBy('date', 'desc'),
            limit(10)
        );
    }, [firestore, userId]);

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'adminTasks'),
            where('category', '==', 'Designer'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
    }, [firestore]);

    const inboundRequestsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'designRequests'),
            where('status', 'in', ['Pending', 'In Progress', 'Submitted']),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
    }, [firestore]);

    const reportsQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(
            collection(firestore, 'dailyReports'),
            where('userId', '==', userId),
            orderBy('reportDate', 'desc'),
            limit(5)
        );
    }, [firestore, userId]);

    const dailyTasksQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(collection(firestore, 'dailyTasks'), where('userId', '==', userId), orderBy('dueDate', 'desc'), limit(10));
    }, [firestore, userId]);

    const { data: recentWork, isLoading: workLoading } = useCollection<DesignerWork>(workQuery);
    const { data: adminTasks, isLoading: tasksLoading } = useCollection<AdminTaskTemplate>(tasksQuery);
    const { data: inboundRequests, isLoading: requestsLoading } = useCollection<DesignRequest>(inboundRequestsQuery);
    const { data: recentReports } = useCollection<DailyReport>(reportsQuery);
    const { data: dailyTasks } = useCollection<DailyTask>(dailyTasksQuery);

    // Productivity Calculation for Daily Tasks
    const totalDailyTasks = dailyTasks?.length || 0;
    const completedDailyTasks = dailyTasks?.filter(t => t.status === 'Completed').length || 0;
    const taskProgressPercentage = totalDailyTasks > 0 ? Math.round((completedDailyTasks / totalDailyTasks) * 100) : 0;

    // Calculate Today's Progress
    const todayStr = React.useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
    const designsToday = recentWork?.filter(w => w.date === todayStr).length || 0;
    const progressPercentage = Math.min((designsToday / dailyGoal) * 100, 100);

    const [submissionUrl, setSubmissionUrl] = React.useState('');
    const [selectedRequestId, setSelectedRequestId] = React.useState<string | null>(null);
    const [isSubmittingAsset, setIsSubmittingAsset] = React.useState(false);

    const [summary, setSummary] = React.useState('');
    const [plans, setPlans] = React.useState('');
    const [isReporting, setIsReporting] = React.useState(false);
    const [editingReport, setEditingReport] = React.useState<DailyReport | null>(null);
    const [viewingBrief, setViewingBrief] = React.useState<DesignRequest | null>(null);

    const handleLogWork = async () => {
        if (!title.trim() || !user || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a title.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const newWork: Omit<DesignerWork, 'id'> = {
                userId: user.id,
                date: todayStr,
                assetType: assetType as any,
                title,
                link: assetLink,
                status: 'Sent for Review'
            };

            await addDocumentNonBlocking(collection(firestore, 'designerWork'), newWork);
            toast({ title: 'Success', description: 'Creative output logged!' });
            setTitle('');
            setAssetLink('');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to log work.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitRequest = async () => {
        if (!submissionUrl || !selectedRequestId || !firestore) return;

        setIsSubmittingAsset(true);
        try {
            await updateDoc(doc(firestore, 'designRequests', selectedRequestId), {
                status: 'Submitted',
                submissionUrl: submissionUrl
            });
            toast({ title: 'Submitted', description: 'Design submitted to requester!' });
            setSubmissionUrl('');
            setSelectedRequestId(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit.' });
        } finally {
            setIsSubmittingAsset(false);
        }
    };

    // Consolidate Reporting & Daily Tasks Logic
    // State for Daily Tasks
    const [newDailyTask, setNewDailyTask] = React.useState('');
    const [isAddingTask, setIsAddingTask] = React.useState(false);

    const handleAddDailyTask = async () => {
        if (!newDailyTask.trim() || !user || !firestore) return;
        setIsAddingTask(true);
        try {
            const task: Omit<DailyTask, 'id'> = {
                userId: user.id,
                task: newDailyTask,
                status: 'Pending',
                dueDate: new Date().toISOString(),
            };
            await addDocumentNonBlocking(collection(firestore, 'dailyTasks'), task);
            toast({ title: 'Task Added', description: 'Your to-do has been saved.' });
            setNewDailyTask('');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to add task.' });
        } finally {
            setIsAddingTask(false);
        }
    };

    const handleToggleTask = async (task: DailyTask) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'dailyTasks', task.id), {
                status: task.status === 'Completed' ? 'Pending' : 'Completed'
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update task.' });
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'dailyTasks', taskId));
            toast({ title: 'Deleted', description: 'Task removed.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete task.' });
        }
    };

    const handleDailyReport = async () => {
        if (!summary.trim() || !user || !firestore) return;

        setIsReporting(true);
        try {
            const report = {
                userId: user.id,
                reportDate: editingReport ? editingReport.reportDate : new Date().toISOString(),
                summary,
                plans,
            };
            
            if (editingReport) {
                await updateDoc(doc(firestore, 'dailyReports', editingReport.id), report);
                toast({ title: 'Updated', description: 'Daily report updated.' });
            } else {
                await addDocumentNonBlocking(collection(firestore, 'dailyReports'), report);
                toast({ title: 'Reported', description: 'Daily report submitted.' });
            }
            setSummary('');
            setPlans('');
            setEditingReport(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to report.' });
        } finally {
            setIsReporting(false);
        }
    };

    const startEditingReport = (report: DailyReport) => {
        setEditingReport(report);
        setSummary(report.summary);
        setPlans(report.plans);
        // Scroll to the reporting form
        const form = document.getElementById('designer-reporting-form');
        form?.scrollIntoView({ behavior: 'smooth' });
    };

    const cancelEditReport = () => {
        setEditingReport(null);
        setSummary('');
        setPlans('');
    };

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        <Palette className="h-10 w-10 text-purple-600" />
                        Creative Hub
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Design, iterate, and deliver excellence.</p>
                    <div className="flex items-center gap-3 mt-4">
                        <Button variant="outline" className="border-purple-100 text-purple-700 font-black h-10 px-6 rounded-xl hover:bg-purple-50" asChild>
                            <Link href="/content-planner">
                                <CalendarCheck className="mr-2 h-4 w-4" />
                                Shared Planner
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-6 bg-white p-4 rounded-3xl shadow-sm border border-slate-100 pr-8">
                    <div className="relative flex items-center justify-center">
                        <svg width="80" height="80" className="transform -rotate-90">
                            <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="none" className="text-slate-100" />
                            <circle
                                cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="none"
                                strokeDasharray={2 * Math.PI * 32}
                                strokeDashoffset={2 * Math.PI * 32 - (taskProgressPercentage / 100) * (2 * Math.PI * 32)}
                                className="text-purple-600 transition-all duration-1000"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-lg font-black text-slate-900 leading-none">{taskProgressPercentage}%</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Tasks</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900 leading-none">{completedDailyTasks} / {totalDailyTasks}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Daily Tasks Progress</p>
                        <div className="flex gap-1 mt-2">
                            {[...Array(totalDailyTasks)].map((_, i) => (
                                <div key={i} className={`h-1 w-3 rounded-full ${i < completedDailyTasks ? 'bg-purple-600' : 'bg-slate-100'}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Content: Logger & Recent Work */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Log New Output */}
                    <Card className="shadow-lg border-none bg-gradient-to-br from-white to-purple-50/30 overflow-hidden">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-500" />
                                Log New Asset
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Asset Category</Label>
                                    <Select value={assetType} onValueChange={setAssetType}>
                                        <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 focus:ring-purple-500">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Post Graphic">Post Graphic</SelectItem>
                                            <SelectItem value="Story Design">Story Design</SelectItem>
                                            <SelectItem value="Youtube Thumbnail">Youtube Thumbnail</SelectItem>
                                            <SelectItem value="Banner">Banner</SelectItem>
                                            <SelectItem value="Reel Edit">Reel Edit</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Project Title</Label>
                                    <Input
                                        className="h-11 rounded-xl bg-white border-slate-200 focus:ring-purple-500"
                                        placeholder="e.g., Summer Campaign Ad"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Deliverable Link (Optional)</Label>
                                    <Input
                                        className="h-11 rounded-xl bg-white border-slate-200 focus:ring-purple-500"
                                        placeholder="Figma, Canva, or Drive link"
                                        value={assetLink}
                                        onChange={e => setAssetLink(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button
                                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-200 transition-all active:scale-[0.98]"
                                onClick={handleLogWork}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Log Creative Output"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Project Board */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b">
                            <CardTitle className="text-lg font-bold">Project Timeline</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-500 py-4 h-11">Asset Name</TableHead>
                                        <TableHead className="font-bold text-slate-500 h-11">Category</TableHead>
                                        <TableHead className="font-bold text-slate-500 h-11 text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentWork?.map(w => (
                                        <TableRow key={w.id} className="hover:bg-slate-50/50">
                                            <TableCell className="font-bold text-slate-800">{w.title}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-none">
                                                    {w.assetType}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {w.link && (
                                                    <a href={w.link} target="_blank" rel="noopener noreferrer">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600">
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                    </a>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Daily To-Do List */}
                    <Card className="shadow-lg border-none bg-white overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b py-4">
                            <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <ListIcon className="h-5 w-5 text-purple-600" />
                                Daily To-Do List
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="p-4 bg-slate-50/30 border-b flex gap-2">
                                <Input
                                    placeholder="Add a quick task..."
                                    className="bg-white border-slate-200 h-10 rounded-xl"
                                    value={newDailyTask}
                                    onChange={e => setNewDailyTask(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddDailyTask()}
                                />
                                <Button size="icon" className="bg-purple-600 hover:bg-purple-700 shrink-0 h-10 w-10 rounded-xl" onClick={handleAddDailyTask}>
                                    <Plus className="h-5 w-5" />
                                </Button>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                                {dailyTasks?.map(task => (
                                    <div key={task.id} className="p-4 flex items-center justify-between group hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                checked={task.status === 'Completed'}
                                                onCheckedChange={() => handleToggleTask(task)}
                                                className="h-5 w-5 border-slate-300 data-[state=checked]:bg-purple-600 rounded-md"
                                            />
                                            <span className={`text-sm font-bold ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                {task.task}
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                            onClick={() => handleDeleteTask(task.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {dailyTasks?.length === 0 && (
                                    <div className="p-12 text-center">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No tasks yet.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Design Requests from SMM */}
                    <Card className="shadow-lg border-none bg-blue-50/30 overflow-hidden">
                        <CardHeader className="border-b bg-blue-50/50">
                            <CardTitle className="text-xl font-black text-blue-800 flex items-center gap-2">
                                <Share2 className="h-5 w-5" />
                                Design Requests (SMM)
                            </CardTitle>
                            <CardDescription className="text-blue-700 font-medium">Pending requests from the Social Media team.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-bold text-blue-900/40 py-4 h-11">Asset / Brief</TableHead>
                                        <TableHead className="font-bold text-blue-900/40 h-11 text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inboundRequests?.map(req => (
                                        <TableRow key={req.id} className="hover:bg-blue-100/30 border-blue-100">
                                            <TableCell>
                                                <p className="font-black text-blue-900 leading-tight mb-1">{req.title}</p>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[9px] h-4 font-black border-blue-200 text-blue-700 uppercase px-1.5">
                                                        {req.assetType}
                                                    </Badge>
                                                    {req.deadline && (
                                                        <span className="text-[9px] font-black text-red-600 flex items-center gap-1 uppercase tracking-widest bg-white/80 w-fit px-1.5 py-0.5 rounded border border-red-100">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            Due: {format(new Date(req.deadline), 'MMM dd')}
                                                        </span>
                                                    )}
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-6 text-[10px] font-black text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-0"
                                                        onClick={() => setViewingBrief(req)}
                                                    >
                                                        VIEW BRIEF
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {req.status === 'Submitted' ? (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-black px-3 py-1">
                                                            ✓ SUBMITTED
                                                        </Badge>
                                                        {req.submissionUrl && (
                                                            <a href={req.submissionUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1">
                                                                View Submission <ExternalLink className="h-2 w-2" />
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Dialog open={selectedRequestId === req.id} onOpenChange={(open) => !open && setSelectedRequestId(null)}>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="default"
                                                                size="sm"
                                                                className="bg-blue-600 hover:bg-blue-700 text-white font-black h-8 px-4 rounded-lg"
                                                                onClick={() => setSelectedRequestId(req.id)}
                                                            >
                                                                SUBMIT
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Submit Design</DialogTitle>
                                                                <DialogDescription>Paste the link to your completed design for {req.title}.</DialogDescription>
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
                                                                <Button variant="outline" onClick={() => setSelectedRequestId(null)}>Cancel</Button>
                                                                <Button
                                                                    className="bg-blue-600 hover:bg-blue-700"
                                                                    onClick={handleSubmitRequest}
                                                                    disabled={isSubmittingAsset}
                                                                >
                                                                    {isSubmittingAsset ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Fulfill Request"}
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {inboundRequests?.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-24 text-center text-blue-400 text-xs italic">
                                                No pending requests.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar: Creative Briefs & Reporting */}
                <div className="space-y-8 h-fit sticky top-6">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <PenTool className="h-5 w-5 text-indigo-500" />
                                Creative Briefs
                            </CardTitle>
                            <CardDescription>Administrative tasks.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                {adminTasks?.map(task => (
                                    <div key={task.id} className="p-4 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 transition-all">
                                        <div className="flex gap-3">
                                            <Checkbox className="mt-1" />
                                            <p className="text-sm font-medium text-slate-800 leading-tight">{task.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg border-none bg-indigo-900 text-white" id="designer-reporting-form">
                        <CardHeader>
                            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                                <Activity className="h-5 w-5 text-indigo-400" />
                                {editingReport ? 'Edit Daily Report' : 'Daily Reporting'}
                            </CardTitle>
                            <CardDescription className="text-indigo-200 font-medium">
                                {editingReport ? 'Modifying your existing report.' : 'Log your progress and blockers.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-indigo-300">Summary of Work</Label>
                                <Textarea
                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-24"
                                    placeholder="What did you achieve today?"
                                    value={summary}
                                    onChange={e => setSummary(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-indigo-300">Next Day Plans</Label>
                                <Textarea
                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                                    placeholder="What's next on your list?"
                                    value={plans}
                                    onChange={e => setPlans(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                {editingReport && (
                                    <Button variant="ghost" className="flex-1 text-white hover:bg-white/10" onClick={cancelEditReport}>
                                        Cancel
                                    </Button>
                                )}
                                <Button
                                    className={cn("w-full bg-white text-indigo-900 hover:bg-slate-100 font-black h-11", editingReport && "flex-[2]")}
                                    onClick={handleDailyReport}
                                    disabled={isReporting}
                                >
                                    {isReporting ? <Loader2 className="animate-spin h-4 w-4" /> : (editingReport ? 'Update Report' : 'Submit Day Report')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Report History */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b">
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">Reporting History</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {recentReports?.map(report => (
                                    <div key={report.id} className="p-4 hover:bg-slate-50/30 transition-colors group">
                                        <div className="flex justify-between items-start">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                {format(new Date(report.reportDate), 'MMM dd, yyyy')}
                                            </p>
                                            <Button variant="ghost" size="sm" className="h-6 text-[10px] font-black p-0 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600" onClick={() => startEditingReport(report)}>
                                                EDIT
                                            </Button>
                                        </div>
                                        <p className="text-xs font-medium text-slate-700 line-clamp-2 mb-1">{report.summary}</p>
                                        <p className="text-[10px] text-slate-400 italic line-clamp-1">Plans: {report.plans}</p>
                                    </div>
                                ))}
                                {recentReports?.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-xs italic">No reports yet.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Brief Detail Dialog */}
            <Dialog open={!!viewingBrief} onOpenChange={open => !open && setViewingBrief(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <Palette className="h-6 w-6 text-blue-600" />
                            {viewingBrief?.title}
                        </DialogTitle>
                        <DialogDescription className="text-blue-600 font-bold uppercase tracking-[0.2em] text-[10px] pt-1">
                            {viewingBrief?.assetType} • Requested Creative
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-6 space-y-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Activity className="h-3 w-3" />
                                Project Brief & Requirements
                            </Label>
                            <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50 shadow-inner max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-200">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-semibold italic">
                                    "{viewingBrief?.description || 'No specific description provided.'}"
                                </p>
                            </div>
                        </div>

                        {viewingBrief?.deadline && (
                            <div className="flex items-center justify-between p-5 bg-gradient-to-r from-red-50 to-orange-50 rounded-3xl border border-red-100 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-white rounded-2xl flex items-center justify-center border border-red-100 shadow-sm">
                                        <Clock className="h-5 w-5 text-red-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-red-400 tracking-wider">Priority Deadline</p>
                                        <p className="text-base font-black text-red-600">
                                            {format(new Date(viewingBrief.deadline), 'EEEE, MMMM dd, yyyy')}
                                        </p>
                                    </div>
                                </div>
                                <Badge className="bg-red-600 text-white border-none font-black text-[10px] px-3 h-6">URGENT</Badge>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="sm:justify-start">
                        <Button 
                            className="bg-slate-900 hover:bg-slate-800 text-white font-black px-8 h-12 rounded-2xl w-full sm:w-auto" 
                            onClick={() => setViewingBrief(null)}
                        >
                            CLOSE BRIEF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
