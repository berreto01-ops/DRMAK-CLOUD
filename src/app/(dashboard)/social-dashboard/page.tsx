'use client';
import * as React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import {
    Badge
} from "@/components/ui/badge";
import {
    Progress
} from "@/components/ui/progress";
import {
    Checkbox
} from "@/components/ui/checkbox";
import {
    Button
} from "@/components/ui/button";
import {
    useCollection,
    useFirestore,
    useMemoFirebase,
    useUser
} from '@/firebase';
import {
    collection,
    query,
    where,
    limit,
    doc,
    getDoc,
    setDoc,
    orderBy,
    or
} from 'firebase/firestore';
import {
    format,
    startOfDay
} from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
    ListTodo,
    Sparkles,
    Activity,
    Instagram,
    Video,
    Clock,
    ArrowUpRight,
    CalendarCheck,
    Share2,
    LineChart,
    Plus,
    Palette,
    ExternalLink,
    Users,
    FileText
} from 'lucide-react';
import type { DailyPosting, SocialReport, AdminTaskTemplate, DesignRequest, DesignerWork, User, SocialCost } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { useAnalyticsData } from '@/hooks/use-analytics-data';
import { Trash2, Settings, Save } from 'lucide-react';
import Link from 'next/link';
import { safeFormat } from '@/lib/safe-date';
import { Coins, PiggyBank, Target, Megaphone } from 'lucide-react';

export default function SocialDashboardPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const userId = user?.id;

    // Today's start-of-day boundary, computed once per mount so deps don't churn.
    const todayIso = React.useMemo(() => startOfDay(new Date()).toISOString(), []);

    // Data Fetching
    const postQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(collection(firestore, 'dailyPostings'), where('userId', '==', userId), where('postedAt', '>=', todayIso));
    }, [firestore, userId, todayIso]);

    const reportQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(collection(firestore, 'socialReports'), where('userId', '==', userId), where('reportDate', '>=', todayIso));
    }, [firestore, userId, todayIso]);

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(
            collection(firestore, 'adminTaskTemplates'),
            where('category', '==', 'Social Media'),
            limit(10)
        );
    }, [firestore, userId]);

    const designersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'Designer'));
    }, [firestore]);

    const { data: todayPosts, isLoading: postsLoading } = useCollection<DailyPosting>(postQuery);
    const { data: todayReports, isLoading: reportsLoading } = useCollection<SocialReport>(reportQuery);
    const { data: adminTasks, isLoading: tasksLoading } = useCollection<AdminTaskTemplate>(tasksQuery);
    const { data: allDesigners } = useCollection<User>(designersQuery);
    
    const designersList = React.useMemo(() => {
        return allDesigners?.filter(u => {
            const status = (u.status || '').trim().toLowerCase();
            return u.email !== 'admin1@skinsmith.com' && 
                (u.name || u.email) && 
                status !== 'deleted' &&
                u.isDeleted !== true &&
                u.active !== false;
        }) || [];
    }, [allDesigners]);

    // Design Requests Query
    const requestsQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(collection(firestore, 'designRequests'), where('requesterId', '==', userId), orderBy('createdAt', 'desc'), limit(10));
    }, [firestore, userId]);

    const { data: designRequests, isLoading: requestsLoading, error: requestsError } = useCollection<DesignRequest>(requestsQuery);
    const { summaryMetrics, isLoading: analyticsLoading, refresh: refreshAnalytics } = useAnalyticsData();

    const { toast } = useToast();

    // Error handling
    React.useEffect(() => {
        if (requestsError) {
            console.error("Design Requests Error:", requestsError);
            toast({
                variant: 'destructive',
                title: 'Column Missing / Index Error',
                description: 'The designer tasks list requires a Firestore index. Check console for link.',
            });
        }
    }, [requestsError, toast]);

    // Design Request Form State
    // Social Settings State
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [sheetLink, setSheetLink] = React.useState('');
    const [isSavingSettings, setIsSavingSettings] = React.useState(false);

    // Fetch Social Settings
    React.useEffect(() => {
        if (!firestore) return;
        const fetchSettings = async () => {
            const docRef = doc(firestore, 'settings', 'socialMedia');
            const snap = await getDoc(docRef);
            if (snap.exists() && snap.data().googleSheetLink) {
                setSheetLink(snap.data().googleSheetLink);
            }
        };
        fetchSettings();
    }, [firestore]);

    const handleSaveSocialSettings = async () => {
        if (!firestore) return;
        setIsSavingSettings(true);
        try {
            await setDoc(doc(firestore, 'settings', 'socialMedia'), { googleSheetLink: sheetLink }, { merge: true });
            toast({ title: 'Settings Saved', description: 'Social Media configuration updated.' });
            setIsSettingsOpen(false);
            // Refresh analytics in-place (no full page reload)
            refreshAnalytics();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const [isRequestModalOpen, setIsRequestModalOpen] = React.useState(false);
    const [selectedBrief, setSelectedBrief] = React.useState<DesignRequest | null>(null);
    const [requestTitle, setRequestTitle] = React.useState('');
    const [requestDesc, setRequestDesc] = React.useState('');
    const [requestType, setRequestType] = React.useState('Post Graphic');
    const [requestDeadline, setRequestDeadline] = React.useState('');
    const [assignedTo, setAssignedTo] = React.useState('');
    const [isRequesting, setIsRequesting] = React.useState(false);

    const handleRequestDesign = async () => {
        if (!requestTitle.trim() || !user || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a title.' });
            return;
        }

        setIsRequesting(true);
        try {
            const newRequest: Omit<DesignRequest, 'id'> = {
                requesterId: user.id,
                title: requestTitle,
                description: requestDesc,
                assetType: requestType as any,
                status: 'Pending',
                createdAt: new Date().toISOString(),
                deadline: requestDeadline || undefined,
                assignedTo: assignedTo || undefined
            };

            await addDocumentNonBlocking(collection(firestore, 'designRequests'), newRequest);
            toast({ title: 'Request Sent', description: 'The designer team has been notified.' });
            setIsRequestModalOpen(false);
            setRequestTitle('');
            setRequestDesc('');
            setAssignedTo('');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to send request.' });
        } finally {
            setIsRequesting(false);
        }
    };

    const handleDeleteRequest = async (requestId: string) => {
        if (!firestore) return;

        if (!confirm('Are you sure you want to delete this design request?')) return;

        try {
            const docRef = doc(firestore, 'designRequests', requestId);
            deleteDocumentNonBlocking(docRef);
            toast({
                title: 'Request Deleted',
                description: 'The creative request has been removed.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to delete the request.',
            });
        }
    };

    // Social Costing State
    const [costMonth, setCostMonth] = React.useState(format(new Date(), 'MMMM'));
    const [costYear, setCostYear] = React.useState(new Date().getFullYear());
    const [adSpend, setAdSpend] = React.useState(0);
    const [boostingSpend, setBoostingSpend] = React.useState(0);
    const [prSpend, setPrSpend] = React.useState(0);
    const [otherSpend, setOtherSpend] = React.useState(0);
    const [costNotes, setCostNotes] = React.useState('');
    const [isSavingCost, setIsSavingCost] = React.useState(false);

    // Fetch Social Cost for selected Month/Year
    const costQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'socialCosts'), 
            where('month', '==', costMonth), 
            where('year', '==', Number(costYear)),
            limit(1)
        );
    }, [firestore, costMonth, costYear]);

    const { data: costData } = useCollection<SocialCost>(costQuery);

    const costRecordId = costData && costData.length > 0 ? costData[0].id : null;
    React.useEffect(() => {
        if (costData && costData.length > 0) {
            const c = costData[0];
            setAdSpend(c.adSpend || 0);
            setBoostingSpend(c.boostingSpend || 0);
            setPrSpend(c.prSpend || 0);
            setOtherSpend(c.otherSpend || 0);
            setCostNotes(c.notes || '');
        } else {
            setAdSpend(0);
            setBoostingSpend(0);
            setPrSpend(0);
            setOtherSpend(0);
            setCostNotes('');
        }
        // Reload local form fields only when the underlying doc identity changes
        // (i.e. when month/year selection lands on a different cost record),
        // not on every onSnapshot tick.
    }, [costRecordId]);

    const handleSaveSocialCost = async () => {
        if (!firestore || !user) return;
        setIsSavingCost(true);
        try {
            const costId = `${costMonth}_${costYear}`;
            const total = Number(adSpend) + Number(boostingSpend) + Number(prSpend) + Number(otherSpend);
            
            const newCost: SocialCost = {
                id: costId,
                month: costMonth,
                year: Number(costYear),
                adSpend: Number(adSpend),
                boostingSpend: Number(boostingSpend),
                prSpend: Number(prSpend),
                otherSpend: Number(otherSpend),
                totalSpent: total,
                notes: costNotes,
                updatedAt: new Date().toISOString(),
                updatedBy: user.id
            };

            await setDoc(doc(firestore, 'socialCosts', costId), newCost, { merge: true });
            toast({ title: 'Budget Updated', description: `Financials for ${costMonth} ${costYear} saved successfully.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSavingCost(false);
        }
    };

    // Progress Logic
    const dailyGoals = { posts: 3, report: 1 };
    const postsDone = todayPosts?.length || 0;
    const reportsDone = todayReports?.length || 0;
    const totalGoal = dailyGoals.posts + dailyGoals.report;
    const currentDone = Math.min(postsDone, dailyGoals.posts) + Math.min(reportsDone, dailyGoals.report);
    const completionPercentage = (currentDone / totalGoal) * 100;

    if (isUserLoading || postsLoading || reportsLoading || tasksLoading || analyticsLoading) {
        return (
            <div className="flex h-[600px] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Social Media Hub</h1>
                    <p className="text-slate-500 font-medium">Monitoring your daily digital presence & task queue.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-purple-600 hover:bg-purple-700 font-bold border-none shadow-lg shadow-purple-200">
                                <Plus className="mr-2 h-4 w-4" />
                                Request Creative
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Palette className="h-5 w-5 text-purple-600" />
                                    New Design Request
                                </DialogTitle>
                                <DialogDescription>Brief the designer on what you need for your social campaign.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Asset Title</Label>
                                    <Input
                                        placeholder="e.g., Winter Sale Instagram Post"
                                        value={requestTitle}
                                        onChange={e => setRequestTitle(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-slate-500">Asset Type</Label>
                                        <Select value={requestType} onValueChange={setRequestType}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Post Graphic">Post Graphic</SelectItem>
                                                <SelectItem value="Story Design">Story Design</SelectItem>
                                                <SelectItem value="Youtube Thumbnail">Youtube Thumbnail</SelectItem>
                                                <SelectItem value="Reel Edit">Reel Edit</SelectItem>
                                                <SelectItem value="Banner">Banner</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-slate-500">Assign To</Label>
                                        <Select value={assignedTo} onValueChange={setAssignedTo}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Designer" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {designersList?.map(d => (
                                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                ))}
                                                {designersList?.length === 0 && <SelectItem value="none" disabled>No designers active</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Brief / Requirements</Label>
                                    <Textarea
                                        placeholder="Color codes, text to include, dimensions, etc."
                                        className="h-24"
                                        value={requestDesc}
                                        onChange={e => setRequestDesc(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Deadline (Optional)</Label>
                                    <Input type="date" value={requestDeadline} onChange={e => setRequestDeadline(e.target.value)} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsRequestModalOpen(false)}>Cancel</Button>
                                <Button
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                                    onClick={handleRequestDesign}
                                    disabled={isRequesting}
                                >
                                    {isRequesting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                    Send Brief to Designer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" className="border-slate-200 text-slate-600 font-bold" onClick={() => setIsSettingsOpen(true)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Button>

                    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-indigo-600" />
                                    Analytics Configuration
                                </DialogTitle>
                                <DialogDescription>Configure the data source for your social media dashboard.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Google Sheet Link (CSV Export)</Label>
                                    <Input
                                        placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                                        value={sheetLink}
                                        onChange={e => setSheetLink(e.target.value)}
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">
                                        Ensure the sheet is shared so the system can proxy the data.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                                <Button
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                    onClick={handleSaveSocialSettings}
                                    disabled={isSavingSettings}
                                >
                                    {isSavingSettings ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Save Configuration
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Button variant="outline" className="border-indigo-100 text-indigo-700 font-bold" asChild>
                        <Link href="/content-planner">
                            <CalendarCheck className="mr-2 h-4 w-4" />
                            Planner
                        </Link>
                    </Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 font-bold" asChild>
                        <Link href="/daily-posting">
                            <Share2 className="mr-2 h-4 w-4" />
                            New Post Log
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-indigo-100 shadow-sm rounded-2xl overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Share2 className="h-3 w-3 text-indigo-500" />
                            Total Reach
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-indigo-700">{summaryMetrics.totalReach.toLocaleString()}</div>
                        <p className={`text-[10px] font-bold mt-1 ${summaryMetrics.reachChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {summaryMetrics.reachChange >= 0 ? '↑' : '↓'} {Math.abs(summaryMetrics.reachChange)}% vs last month
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-purple-100 shadow-sm rounded-2xl overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Users className="h-3 w-3 text-purple-500" />
                            New Followers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-purple-700">+{summaryMetrics.newFollowers.toLocaleString()}</div>
                        <p className={`text-[10px] font-bold mt-1 ${summaryMetrics.followerChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {summaryMetrics.followerChange >= 0 ? '↑' : '↓'} {Math.abs(summaryMetrics.followerChange)}% growth
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-emerald-100 shadow-sm rounded-2xl overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="h-3 w-3 text-emerald-500" />
                            Engagement Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-700">{summaryMetrics.engagementRate}%</div>
                        <p className={`text-[10px] font-bold mt-1 ${summaryMetrics.engagementChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {summaryMetrics.engagementChange >= 0 ? '↑' : '↓'} {Math.abs(summaryMetrics.engagementChange)}% change
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Header with Progress */}
            <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100 dark:from-indigo-950 dark:to-blue-950 dark:border-indigo-900 shadow-sm border-2 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Share2 className="h-32 w-32 text-indigo-600 rotate-12" />
                </div>
                <CardHeader>
                    <div className="flex justify-between items-center relative z-10">
                        <div>
                            <CardTitle className="text-xl text-indigo-700 dark:text-indigo-300 font-black uppercase tracking-tight">Performance Target</CardTitle>
                            <CardDescription className="text-indigo-600/70 font-bold">Goal: {dailyGoals.posts} Posts & {dailyGoals.report} Day End Report</CardDescription>
                        </div>
                        <div className="text-right">
                            <span className="text-4xl font-black text-indigo-600">{Math.round(completionPercentage)}%</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="relative z-10">
                    <Progress value={completionPercentage} className="h-4 bg-white/50 dark:bg-indigo-900/50 mb-6 border border-indigo-100" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className={`h-3 w-3 rounded-full ${postsDone >= dailyGoals.posts ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                                <span className="text-sm font-bold text-slate-700">Platform Posts</span>
                            </div>
                            <span className="text-lg font-black text-indigo-700">{postsDone} / {dailyGoals.posts}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className={`h-3 w-3 rounded-full ${reportsDone >= dailyGoals.report ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                                <span className="text-sm font-bold text-slate-700">Day End Report</span>
                            </div>
                            <span className="text-lg font-black text-indigo-700">{reportsDone} / {dailyGoals.report}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Social Costing Section */}
            <Card className="border-none bg-white shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden border border-slate-100">
                <CardHeader className="bg-slate-50/50 border-b py-5 px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <Coins className="h-6 w-6 text-amber-600" />
                            Social Costing & Ads Budget
                        </CardTitle>
                        <CardDescription className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mt-1">Monthly breakdown of marketing expenditures</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        <Select value={costMonth} onValueChange={setCostMonth}>
                            <SelectTrigger className="w-32 h-10 rounded-xl font-bold border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                                    <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={String(costYear)} onValueChange={val => setCostYear(Number(val))}>
                            <SelectTrigger className="w-24 h-10 rounded-xl font-bold border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <SelectItem key={y} value={String(y)} className="font-bold">{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button 
                            onClick={handleSaveSocialCost} 
                            disabled={isSavingCost}
                            className="h-10 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold px-6 shadow-lg shadow-amber-100"
                        >
                            {isSavingCost ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Update Financials
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                <Megaphone className="h-3 w-3 text-indigo-500" /> Meta/Google Ads
                            </Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">Rs</span>
                                <Input 
                                    type="number" 
                                    value={adSpend} 
                                    onChange={e => setAdSpend(Number(e.target.value))}
                                    className="pl-10 h-12 rounded-2xl border-slate-200 font-black text-lg focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                <Target className="h-3 w-3 text-emerald-500" /> Boosting Costs
                            </Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">Rs</span>
                                <Input 
                                    type="number" 
                                    value={boostingSpend} 
                                    onChange={e => setBoostingSpend(Number(e.target.value))}
                                    className="pl-10 h-12 rounded-2xl border-slate-200 font-black text-lg focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                <Sparkles className="h-3 w-3 text-purple-500" /> PR & Influencers
                            </Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">Rs</span>
                                <Input 
                                    type="number" 
                                    value={prSpend} 
                                    onChange={e => setPrSpend(Number(e.target.value))}
                                    className="pl-10 h-12 rounded-2xl border-slate-200 font-black text-lg focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                <PiggyBank className="h-3 w-3 text-blue-500" /> Misc / Software
                            </Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">Rs</span>
                                <Input 
                                    type="number" 
                                    value={otherSpend} 
                                    onChange={e => setOtherSpend(Number(e.target.value))}
                                    className="pl-10 h-12 rounded-2xl border-slate-200 font-black text-lg focus:ring-amber-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-100">
                        <div className="md:col-span-2 space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Expense Justification / Notes</Label>
                            <Textarea 
                                placeholder="Details about specific campaigns, PR gifts, or software subscriptions..."
                                value={costNotes}
                                onChange={e => setCostNotes(e.target.value)}
                                className="rounded-2xl border-slate-200 min-h-[100px] font-medium resize-none"
                            />
                        </div>
                        <div className="bg-amber-50 rounded-[2rem] p-6 border border-amber-100 flex flex-col justify-center items-center text-center">
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-2">Total Monthly Burn</p>
                            <p className="text-4xl font-black text-amber-900 tracking-tighter">
                                Rs {(Number(adSpend) + Number(boostingSpend) + Number(prSpend) + Number(otherSpend)).toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold text-amber-700/60 mt-2 italic">Automatically syncing with Admin P&L</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Design Requests Tracking */}
                <Card className="lg:col-span-2 shadow-sm border-slate-200">
                    <CardHeader className="border-b bg-slate-50/50 py-4">
                        <CardTitle className="flex items-center gap-2 text-purple-800 text-base font-black uppercase tracking-tight">
                            <Palette className="h-5 w-5 text-purple-600" />
                            Requested Creatives
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/30">
                                    <TableHead className="font-bold text-slate-500 py-4 h-11">Asset</TableHead>
                                    <TableHead className="font-bold text-slate-500 h-11">Assigned To</TableHead>
                                    <TableHead className="font-bold text-slate-500 h-11">Status</TableHead>
                                    <TableHead className="font-bold text-slate-500 h-11 text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {designRequests?.map(req => (
                                    <TableRow key={req.id} className="hover:bg-slate-50/50">
                                        <TableCell>
                                            <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{req.title}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-[9px] font-black border-indigo-100 text-indigo-600 uppercase h-4 px-1.5">
                                                    {req.assetType}
                                                </Badge>
                                                {req.deadline && (
                                                    <span className="text-[10px] text-purple-600 font-black flex items-center gap-1 uppercase tracking-tighter">
                                                        <Clock className="h-2.5 w-2.5" />
                                                        Due: {format(new Date(req.deadline), 'MMM dd')}
                                                    </span>
                                                )}
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-6 text-[10px] font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 p-0"
                                                    onClick={() => setSelectedBrief(req)}
                                                >
                                                    VIEW BRIEF
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600 border border-indigo-100 uppercase">
                                                    {designersList?.find(d => d.id === req.assignedTo)?.name?.[0] || 'D'}
                                                </div>
                                                <span className="text-xs font-bold text-slate-600">
                                                    {designersList?.find(d => d.id === req.assignedTo)?.name || 'Design Team'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`
                                                ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                    req.status === 'Submitted' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                                                        'bg-slate-100 text-slate-600'} border-none font-bold text-[10px] h-5
                                            `}>
                                                {req.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {req.submissionUrl ? (
                                                    <Button size="sm" variant="outline" className="h-7 text-[10px] font-black border-blue-200 text-blue-700 hover:bg-blue-50" asChild>
                                                        <a href={req.submissionUrl} target="_blank" rel="noopener noreferrer">
                                                            VIEW ASSET
                                                        </a>
                                                    </Button>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-300 italic">Designing...</span>
                                                )}
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                    onClick={() => handleDeleteRequest(req.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {designRequests?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-slate-400 text-xs italic">
                                            No design requests yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Admin Tasks */}
                <Card className="lg:col-span-2 shadow-sm border-slate-200">
                    <CardHeader className="border-b bg-slate-50/50 py-4">
                        <CardTitle className="flex items-center gap-2 text-indigo-800 text-base font-black">
                            <ListTodo className="h-5 w-5 text-indigo-600" />
                            ASSIGNED BRIEFINGS
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            {adminTasks?.map(t => (
                                <div key={t.id} className="flex items-center justify-between p-4 border-2 rounded-2xl hover:bg-indigo-50/50 transition-all group border-slate-50">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1">
                                            <Checkbox id={`task-${t.id}`} className="h-5 w-5 border-slate-300 data-[state=checked]:bg-indigo-600 rounded-md" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 leading-snug">{t.content}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <p className="text-[10px] text-zinc-500 flex items-center gap-1 font-bold bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                                                    <Clock className="h-3 w-3" />
                                                    Due Soon
                                                </p>
                                                <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">{safeFormat(t.createdAt, 'MMM dd')}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="border-indigo-100 text-indigo-600 font-black text-[10px] h-8 px-4 rounded-lg bg-indigo-50/50" asChild>
                                        <Link href="/daily-tasks">REVIEW</Link>
                                    </Button>
                                </div>
                            ))}
                            {adminTasks?.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <ListTodo className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <p className="text-sm text-slate-500 font-bold">No briefings assigned. You're efficient!</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Status Column */}
                <div className="space-y-6">
                    <Card className="shadow-sm border-slate-200 overflow-hidden rounded-2xl">
                        <CardHeader className="bg-slate-50/50 border-b py-4">
                            <CardTitle className="text-xs font-black flex items-center gap-2 text-slate-800 uppercase tracking-widest">
                                <Activity className="h-4 w-4 text-emerald-500" />
                                Recent Output
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {todayPosts?.slice(0, 4).map(post => (
                                    <div key={post.id} className="p-4 flex items-center gap-4 hover:bg-indigo-50/20 transition-colors">
                                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 border border-slate-200 group-hover:bg-white transition-colors">
                                            {post.platform === 'Instagram' ? <Instagram className="h-5 w-5 text-pink-600" /> : <Video className="h-5 w-5 text-indigo-600" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{post.description}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{post.platform}</p>
                                                <span className="text-slate-300">•</span>
                                                <p className="text-[10px] text-slate-500 font-bold">{safeFormat(post.postedAt, 'h:mm a')}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {todayPosts?.length === 0 && (
                                    <div className="p-12 text-center bg-slate-50/30">
                                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3 text-slate-300">
                                            <Activity className="h-6 w-6" />
                                        </div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Awaiting Logs</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <div className="p-4 bg-slate-50/50 border-t">
                            <Button variant="ghost" className="w-full text-[10px] font-black uppercase text-indigo-600 tracking-widest hover:bg-indigo-50" asChild>
                                <Link href="/daily-posting" className="flex items-center justify-center gap-2">
                                    View Full History
                                    <ArrowUpRight className="h-3 w-3" />
                                </Link>
                            </Button>
                        </div>
                    </Card>

                    <Card className="shadow-sm border-slate-200 overflow-hidden rounded-2xl">
                        <CardHeader className="bg-slate-50/50 border-b py-4">
                            <CardTitle className="text-xs font-black flex items-center gap-2 text-slate-800 uppercase tracking-widest">
                                <FileText className="h-4 w-4 text-indigo-500" />
                                Recent Reports
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {todayReports?.slice(0, 3).map(report => (
                                    <div key={report.id} className="p-4 hover:bg-indigo-50/20 transition-colors">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                            {safeFormat(report.reportDate, 'MMM dd, yyyy')}
                                        </p>
                                        <p className="text-xs font-bold text-slate-800 line-clamp-2">{report.summary}</p>
                                    </div>
                                ))}
                                {todayReports?.length === 0 && (
                                    <div className="p-12 text-center bg-slate-50/30">
                                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3 text-slate-300">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No reports yet</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <div className="p-4 bg-slate-50/50 border-t">
                            <Button variant="ghost" className="w-full text-[10px] font-black uppercase text-indigo-600 tracking-widest hover:bg-indigo-50" asChild>
                                <Link href="/social-reporting" className="flex items-center justify-center gap-2">
                                    Manage Reports
                                    <ArrowUpRight className="h-3 w-3" />
                                </Link>
                            </Button>
                        </div>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-xl border-none rounded-2xl relative overflow-hidden group">
                        <div className="absolute -bottom-6 -right-6 h-32 w-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
                        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
                            <div className="h-14 w-14 bg-white/20 rounded-2xl backdrop-blur-md flex items-center justify-center mb-6 border border-white/30 rotate-3 group-hover:rotate-0 transition-transform">
                                <LineChart className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="text-xl font-black mb-2 tracking-tight">Reach Insights</h3>
                            <p className="text-sm text-indigo-100/80 mb-8 max-w-[200px] leading-relaxed font-bold">Check how your content is performing across platforms.</p>
                            <Button className="w-full bg-white text-indigo-700 hover:bg-slate-50 font-black text-xs h-12 rounded-xl shadow-lg border-none" variant="secondary" asChild>
                                <Link href="/analytics/reach" className="flex items-center justify-center gap-2">
                                    OPEN ANALYTICS
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* View Brief Dialog */}
            <Dialog open={!!selectedBrief} onOpenChange={open => !open && setSelectedBrief(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Palette className="h-5 w-5 text-indigo-600" />
                            Creative Brief: {selectedBrief?.title}
                        </DialogTitle>
                        <DialogDescription className="font-bold text-indigo-500 uppercase tracking-widest text-[10px]">
                            {selectedBrief?.assetType}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Requirements & Description</Label>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                                    {selectedBrief?.description || 'No description provided.'}
                                </p>
                            </div>
                        </div>
                        {selectedBrief?.deadline && (
                            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                <div className="flex items-center gap-3">
                                    <Clock className="h-5 w-5 text-purple-600" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-purple-400 leading-none">Submission Deadline</p>
                                        <p className="text-sm font-black text-purple-700 mt-1">
                                            {format(new Date(selectedBrief.deadline), 'EEEE, MMMM dd, yyyy')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl" onClick={() => setSelectedBrief(null)}>
                            Close Brief
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
