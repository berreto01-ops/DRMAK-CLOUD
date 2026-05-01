'use client';
import * as React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, useUser } from '@/firebase';
import { query, collection, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
} from 'date-fns';
import { Loader2, CalendarCheck, Plus, Clock, ChevronLeft, ChevronRight, Instagram, Facebook, Share2, Video, Youtube, Trash2, Edit3, CheckCircle2, TrendingUp, Users, DollarSign, ArrowUpRight, BarChart3 } from 'lucide-react';
import type { ScheduledPost, SocialCost, SocialROAS } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { Coins, PiggyBank, Target, Megaphone, Save, Sparkles } from 'lucide-react';

const PLATFORM_CONFIG = {
    Instagram: { icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-100' },
    Facebook: { icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    TikTok: { icon: Video, color: 'text-slate-900', bg: 'bg-slate-50', border: 'border-slate-200' },
    WhatsApp: { icon: Share2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    YouTube: { icon: Youtube, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
    Other: { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-100' },
};

export default function ContentPlannerUpgrade() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    // Calendar & Query States
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    
    // Data Fetching
    const postsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;

        // Social Media Manager and Designer share the same unified calendar
        const isSocialStaff = user.role === 'Social Media Manager' || user.role === 'Designer' || user.role === 'Admin';

        if (isSocialStaff) {
            return query(collection(firestore, 'scheduledPosts'));
        }

        // Others (if any) only see their own posts
        return query(
            collection(firestore, 'scheduledPosts'),
            where('userId', '==', user.id)
        );
    }, [firestore, user?.id, user?.role]);

    const { data: rawPosts, isLoading } = useCollection<ScheduledPost>(postsQuery);

    // Sort client-side to avoid index requirement
    const posts = React.useMemo(() => {
        if (!rawPosts) return [];
        return [...rawPosts].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    }, [rawPosts]);

    // Form States
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingPost, setEditingPost] = React.useState<ScheduledPost | null>(null);
    const [title, setTitle] = React.useState('');
    const [platform, setPlatform] = React.useState('Instagram');
    const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
    const [time, setTime] = React.useState('12:00');
    const [description, setDescription] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleCreateOrUpdate = async () => {
        if (!title.trim() || !selectedDay || !firestore || !user) {
            toast({ variant: "destructive", title: "Wait", description: "Please enter a title and select a date." });
            return;
        }
        setIsSubmitting(true);
        try {
            const scheduledDatetime = new Date(selectedDay);
            const [hours, minutes] = time.split(':');
            scheduledDatetime.setHours(parseInt(hours), parseInt(minutes));

            const postData: Omit<ScheduledPost, 'id'> = {
                userId: user.id,
                title: title.trim(),
                platform: platform as any,
                scheduledAt: scheduledDatetime.toISOString(),
                status: editingPost ? editingPost.status : 'Scheduled',
                description: description.trim(),
            };

            if (editingPost) {
                await updateDoc(doc(firestore, 'scheduledPosts', editingPost.id), postData);
                toast({ title: "Updated", description: "Post details have been updated." });
            } else {
                await addDocumentNonBlocking(collection(firestore, 'scheduledPosts'), postData);
                toast({ title: "Scheduled", description: "Content added to your planner." });
            }
            
            closeDialog();
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save post." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePost = async (id: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'scheduledPosts', id));
            toast({ title: "Deleted", description: "Content removed from planner." });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete post." });
        }
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditingPost(null);
        setTitle('');
        setDescription('');
        setTime('12:00');
        setSelectedDay(null);
    };

    const openCreateDialog = (day: Date) => {
        setSelectedDay(day);
        setEditingPost(null);
        setTitle('');
        setPlatform('Instagram');
        setTime('12:00');
        setDescription('');
        setIsDialogOpen(true);
    };

    const openEditDialog = (e: React.MouseEvent, post: ScheduledPost) => {
        e.stopPropagation();
        setEditingPost(post);
        setSelectedDay(new Date(post.scheduledAt));
        setTitle(post.title);
        setPlatform(post.platform);
        setTime(format(new Date(post.scheduledAt), 'HH:mm'));
        setDescription(post.description || '');
        setIsDialogOpen(true);
    };

    // Calendar Helpers
    const days = React.useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const getPostsForDay = (day: Date) => posts.filter(p => isSameDay(new Date(p.scheduledAt), day));
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    // Social Costing State
    const [costMonth, setCostMonth] = React.useState(format(new Date(), 'MMMM'));
    const [costYear, setCostYear] = React.useState(new Date().getFullYear());
    const [adSpend, setAdSpend] = React.useState(0);
    const [boostingSpend, setBoostingSpend] = React.useState(0);
    const [prSpend, setPrSpend] = React.useState(0);
    const [otherSpend, setOtherSpend] = React.useState(0);
    const [costNotes, setCostNotes] = React.useState('');
    const [isSavingCost, setIsSavingCost] = React.useState(false);

    // Fetch Social Cost
    const costQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'socialCosts'), 
            where('month', '==', costMonth), 
            where('year', '==', Number(costYear))
        );
    }, [firestore, costMonth, costYear]);

    const { data: costData } = useCollection<SocialCost>(costQuery);

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
    }, [costData]);

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

            const { setDoc } = await import('firebase/firestore');
            await setDoc(doc(firestore, 'socialCosts', costId), newCost, { merge: true });
            toast({ title: 'Budget Updated', description: `Financials for ${costMonth} saved.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSavingCost(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
        );
    }

    const upcomingQueue = posts.filter(p => new Date(p.scheduledAt) >= new Date());

    return (
        <div className="space-y-6 p-1">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        <CalendarCheck className="h-10 w-10 text-teal-600" />
                        Content Planner
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Plan, schedule, and track your clinic's social media presence.</p>
                </div>
                <div className="bg-teal-50 border border-teal-100 rounded-2xl px-5 py-3 text-center">
                    <p className="text-2xl font-black text-teal-700">{upcomingQueue.length}</p>
                    <p className="text-[10px] uppercase font-black text-teal-400 tracking-widest">Planned Posts</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* CALENDAR PART */}
                <Card className="lg:col-span-2 border-slate-200 shadow-sm overflow-hidden bg-white">
                    <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 py-4">
                        <div className="space-y-0.5">
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">
                                Calendar Overview
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold text-slate-400">CLICK A DAY TO SCHEDULE CONTENT</CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 hover:bg-white hover:shadow-sm"><ChevronLeft className="h-4 w-4" /></Button>
                            <span className="text-sm font-black min-w-[110px] text-center text-slate-700">{format(currentMonth, 'MMMM yyyy')}</span>
                            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 hover:bg-white hover:shadow-sm"><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-7 gap-px bg-slate-200 border-b">
                            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                                <div key={day} className="bg-white p-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {day}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-slate-200">
                            {days.map((day, i) => {
                                const dayPosts = getPostsForDay(day);
                                const isCurrentMonth = isSameMonth(day, currentMonth);
                                const isToday = isSameDay(day, new Date());

                                return (
                                    <div
                                        key={i}
                                        onClick={() => openCreateDialog(day)}
                                        className={cn(
                                            "bg-white p-1.5 h-32 relative cursor-pointer group hover:bg-teal-50/60 transition-colors",
                                            !isCurrentMonth && "bg-slate-50/50 text-slate-300"
                                        )}
                                    >
                                        <span className={cn(
                                            "text-[11px] font-black",
                                            isToday ? "bg-teal-600 text-white rounded-full w-5 h-5 flex items-center justify-center" : "text-slate-400"
                                        )}>
                                            {format(day, 'd')}
                                        </span>

                                        <div className="mt-1 space-y-0.5 overflow-hidden max-h-[75%]">
                                            {dayPosts.slice(0, 3).map(p => {
                                                const config = PLATFORM_CONFIG[p.platform as keyof typeof PLATFORM_CONFIG] || PLATFORM_CONFIG.Other;
                                                const Icon = config.icon;
                                                return (
                                                    <div
                                                        key={p.id}
                                                        onClick={(e) => openEditDialog(e, p)}
                                                        className={cn(
                                                            "px-1 py-0.5 rounded text-[8px] font-bold leading-tight truncate border flex items-center gap-1",
                                                            config.bg, config.color, config.border
                                                        )}
                                                    >
                                                        <Icon className="h-2 w-2" />
                                                        {p.title}
                                                    </div>
                                                );
                                            })}
                                            {dayPosts.length > 3 && (
                                                <p className="text-[8px] font-black text-teal-400 pl-1">+{dayPosts.length - 3} more</p>
                                            )}
                                        </div>

                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Plus className="h-3 w-3 text-teal-400" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* SIDEBAR */}
                <div className="space-y-6">
                    <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <CardTitle className="text-xs font-black flex items-center gap-2 text-slate-800 uppercase tracking-widest">
                                <Clock className="h-4 w-4 text-teal-600" />
                                Upcoming Queue
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3">
                            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                                {upcomingQueue.length > 0 ? upcomingQueue.map(post => {
                                    const config = PLATFORM_CONFIG[post.platform as keyof typeof PLATFORM_CONFIG] || PLATFORM_CONFIG.Other;
                                    const Icon = config.icon;
                                    return (
                                        <div
                                            key={post.id}
                                            onClick={(e) => openEditDialog(e, post)}
                                            className="flex items-start justify-between p-3 border border-slate-100 rounded-2xl hover:border-teal-200 hover:bg-teal-50/20 transition-all cursor-pointer group"
                                        >
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <Icon className={cn("h-3 w-3", config.color)} />
                                                    <p className="font-black text-xs text-slate-800 truncate">{post.title}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                                                        {format(new Date(post.scheduledAt), 'MMM dd')} · {format(new Date(post.scheduledAt), 'hh:mm a')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeletePost(post.id);
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="text-center py-10 opacity-60">
                                        <CalendarCheck className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Nothing planned yet.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* LEGEND */}
                    <Card className="border-teal-100 bg-teal-50/30">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-[10px] font-black text-teal-700 uppercase tracking-widest">Platform Key</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 grid grid-cols-2 gap-2">
                            {Object.entries(PLATFORM_CONFIG).map(([name, cfg]) => {
                                const Icon = cfg.icon;
                                return (
                                    <div key={name} className="flex items-center gap-2">
                                        <div className={cn("p-1 rounded-md", cfg.bg)}>
                                            <Icon className={cn("h-3 w-3", cfg.color)} />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-600">{name}</span>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Social Costing Section - RIGHT BELOW THE PLANNER */}
            <Card className="border-none bg-white shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden border border-slate-100 mt-8">
                <CardHeader className="bg-slate-50/50 border-b py-5 px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <Coins className="h-6 w-6 text-amber-600" />
                            Monthly Social Costing & Ads
                        </CardTitle>
                        <CardDescription className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mt-1">Budget tracking for marketing activities</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        <Select value={costMonth} onValueChange={setCostMonth}>
                            <SelectTrigger className="w-32 h-10 rounded-xl font-bold border-slate-200 bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                                    <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={String(costYear)} onValueChange={val => setCostYear(Number(val))}>
                            <SelectTrigger className="w-24 h-10 rounded-xl font-bold border-slate-200 bg-white">
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
                            Update
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                <Megaphone className="h-3 w-3 text-indigo-500" /> Ads Spend
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
                                <Target className="h-3 w-3 text-emerald-500" /> Boosting
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
                                <Sparkles className="h-3 w-3 text-purple-500" /> PR / PR Gifts
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
                                <PiggyBank className="h-3 w-3 text-blue-500" /> Misc
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
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Notes</Label>
                            <Textarea 
                                placeholder="Campaign details..."
                                value={costNotes}
                                onChange={e => setCostNotes(e.target.value)}
                                className="rounded-2xl border-slate-200 min-h-[80px] font-medium resize-none"
                            />
                        </div>
                        <div className="bg-amber-50 rounded-[2rem] p-6 border border-amber-100 flex flex-col justify-center items-center text-center">
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Total Burn</p>
                            <p className="text-3xl font-black text-amber-900 tracking-tighter">
                                Rs {(Number(adSpend) + Number(boostingSpend) + Number(prSpend) + Number(otherSpend)).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ─── ROAS TRACKER SECTION ─────────────────────────────────────── */}
            <ROASTracker
                firestore={firestore}
                user={user}
                costMonth={costMonth}
                costYear={costYear}
                currentMonthSpend={Number(adSpend) + Number(boostingSpend) + Number(prSpend) + Number(otherSpend)}
            />

            {/* CREATE/EDIT DIALOG */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800 font-black text-xl">
                            {editingPost ? <Edit3 className="h-6 w-6 text-teal-600" /> : <Plus className="h-6 w-6 text-teal-600" />}
                            {editingPost ? 'Edit Post' : 'Schedule Content'}
                        </DialogTitle>
                        <DialogDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
                            {selectedDay ? format(selectedDay, 'MMMM dd, yyyy') : ''}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Post Title</Label>
                            <Input
                                placeholder="e.g., Weekend Skincare Tips Carousel"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="h-12 rounded-2xl border-slate-200 focus:ring-teal-500 font-bold"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Platform</Label>
                                <Select value={platform} onValueChange={setPlatform}>
                                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(PLATFORM_CONFIG).map(plt => (
                                            <SelectItem key={plt} value={plt} className="font-bold">{plt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Time</Label>
                                <Input
                                    type="time"
                                    value={time}
                                    onChange={e => setTime(e.target.value)}
                                    className="h-12 rounded-2xl border-slate-200 font-bold"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Description (Internal Notes)</Label>
                            <Textarea
                                placeholder="Drafting details, hashtags, or designer instructions..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="rounded-2xl border-slate-200 resize-none h-24 font-medium"
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex flex-row justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                            {editingPost && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-rose-500 hover:bg-rose-50 rounded-xl"
                                    onClick={() => {
                                        handleDeletePost(editingPost.id);
                                        closeDialog();
                                    }}
                                >
                                    <Trash2 className="h-5 w-5" />
                                </Button>
                            )}
                            <Button variant="ghost" onClick={closeDialog} className="rounded-2xl font-black text-slate-400 hover:text-slate-600">Cancel</Button>
                        </div>
                        <Button
                            onClick={handleCreateOrUpdate}
                            disabled={isSubmitting}
                            className="bg-teal-600 hover:bg-teal-700 text-white rounded-2xl px-8 font-black shadow-lg shadow-teal-100 transition-all active:scale-95"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : (editingPost ? 'Update Post' : 'Schedule Content')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── ROAS Tracker Component ──────────────────────────────────────────────────
function ROASTracker({ firestore, user, costMonth, costYear, currentMonthSpend }: {
    firestore: any;
    user: any;
    costMonth: string;
    costYear: number;
    currentMonthSpend: number;
}) {
    const { toast } = useToast();

    // ROAS form state
    const [leadsGenerated, setLeadsGenerated] = React.useState(0);
    const [leadsConverted, setLeadsConverted] = React.useState(0);
    const [revenueFromConversions, setRevenueFromConversions] = React.useState(0);
    const [manualSpend, setManualSpend] = React.useState(0);
    const [roasNotes, setRoasNotes] = React.useState('');
    const [isSavingRoas, setIsSavingRoas] = React.useState(false);

    // Fetch existing ROAS data for selected month
    const roasQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'socialROAS'),
            where('month', '==', costMonth),
            where('year', '==', Number(costYear))
        );
    }, [firestore, costMonth, costYear]);

    const { data: roasData } = useCollection<SocialROAS>(roasQuery);

    // Load existing data when month changes
    React.useEffect(() => {
        if (roasData && roasData.length > 0) {
            const r = roasData[0];
            setLeadsGenerated(r.leadsGenerated || 0);
            setLeadsConverted(r.leadsConverted || 0);
            setRevenueFromConversions(r.revenueFromConversions || 0);
            setManualSpend(r.totalAdSpend || 0);
            setRoasNotes(r.notes || '');
        } else {
            setLeadsGenerated(0);
            setLeadsConverted(0);
            setRevenueFromConversions(0);
            setManualSpend(0);
            setRoasNotes('');
        }
    }, [roasData]);

    // Auto-sync spend from Social Costing section
    React.useEffect(() => {
        if (currentMonthSpend > 0 && manualSpend === 0) {
            setManualSpend(currentMonthSpend);
        }
    }, [currentMonthSpend]);

    // Calculated metrics
    const totalSpend = Number(manualSpend) || 0;
    const leads = Number(leadsGenerated) || 0;
    const conversions = Number(leadsConverted) || 0;
    const revenue = Number(revenueFromConversions) || 0;

    const costPerLead = leads > 0 ? totalSpend / leads : 0;
    const costPerConversion = conversions > 0 ? totalSpend / conversions : 0;
    const conversionRate = leads > 0 ? (conversions / leads) * 100 : 0;
    const roas = totalSpend > 0 ? revenue / totalSpend : 0;
    const netProfit = revenue - totalSpend;

    const handleSaveROAS = async () => {
        if (!firestore || !user) return;
        setIsSavingRoas(true);
        try {
            const roasId = `${costMonth}_${costYear}`;
            const { setDoc } = await import('firebase/firestore');

            const roasRecord: SocialROAS = {
                id: roasId,
                month: costMonth,
                year: Number(costYear),
                totalAdSpend: totalSpend,
                leadsGenerated: leads,
                leadsConverted: conversions,
                revenueFromConversions: revenue,
                costPerLead,
                costPerConversion,
                conversionRate: Number(conversionRate.toFixed(1)),
                roas: Number(roas.toFixed(2)),
                notes: roasNotes,
                updatedAt: new Date().toISOString(),
                updatedBy: user.id,
            };

            await setDoc(doc(firestore, 'socialROAS', roasId), roasRecord, { merge: true });
            toast({ title: 'ROAS Report Saved', description: `Performance data for ${costMonth} ${costYear} has been recorded.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSavingRoas(false);
        }
    };

    return (
        <Card className="border-none bg-white shadow-xl shadow-violet-100/30 rounded-[2rem] overflow-hidden border border-violet-100/50 mt-8">
            <CardHeader className="bg-gradient-to-r from-violet-50/80 to-indigo-50/80 border-b py-5 px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl shadow-lg shadow-violet-200">
                            <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                        ROAS Tracker
                    </CardTitle>
                    <CardDescription className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mt-1">
                        Return on ad spend · Track leads, conversions & revenue
                    </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white border border-violet-200 rounded-xl px-4 py-2">
                        <span className="text-xs font-black text-violet-600">{costMonth} {costYear}</span>
                    </div>
                    <Button
                        onClick={handleSaveROAS}
                        disabled={isSavingRoas}
                        className="h-10 rounded-xl bg-violet-600 hover:bg-violet-700 font-bold px-6 shadow-lg shadow-violet-100"
                    >
                        {isSavingRoas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Report
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                {/* Input Fields Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    {/* Total Ad Spend */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Coins className="h-3 w-3 text-rose-500" /> Total Ad Spend
                        </Label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">Rs</span>
                            <Input
                                type="number"
                                value={manualSpend}
                                onChange={e => setManualSpend(Number(e.target.value))}
                                className="pl-10 h-12 rounded-2xl border-slate-200 font-black text-lg focus:ring-violet-500"
                            />
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold">Auto-synced from costing above</p>
                    </div>

                    {/* Leads Generated */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Users className="h-3 w-3 text-blue-500" /> Leads Generated
                        </Label>
                        <Input
                            type="number"
                            value={leadsGenerated}
                            onChange={e => setLeadsGenerated(Number(e.target.value))}
                            className="h-12 rounded-2xl border-slate-200 font-black text-lg focus:ring-violet-500"
                            placeholder="0"
                        />
                        <p className="text-[9px] text-slate-400 font-bold">Total inquiries from social media</p>
                    </div>

                    {/* Leads Converted */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Target className="h-3 w-3 text-emerald-500" /> Leads Converted
                        </Label>
                        <Input
                            type="number"
                            value={leadsConverted}
                            onChange={e => setLeadsConverted(Number(e.target.value))}
                            className="h-12 rounded-2xl border-slate-200 font-black text-lg focus:ring-violet-500"
                            placeholder="0"
                        />
                        <p className="text-[9px] text-slate-400 font-bold">Leads that became paying patients</p>
                    </div>

                    {/* Revenue from Conversions */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <DollarSign className="h-3 w-3 text-amber-500" /> Revenue Gained
                        </Label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">Rs</span>
                            <Input
                                type="number"
                                value={revenueFromConversions}
                                onChange={e => setRevenueFromConversions(Number(e.target.value))}
                                className="pl-10 h-12 rounded-2xl border-slate-200 font-black text-lg focus:ring-violet-500"
                            />
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold">Total billing from converted leads</p>
                    </div>
                </div>

                {/* Calculated KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    {/* ROAS */}
                    <div className={cn(
                        "rounded-[1.5rem] p-5 border text-center relative overflow-hidden",
                        roas >= 3 ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200" :
                        roas >= 1 ? "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200" :
                        "bg-gradient-to-br from-rose-50 to-red-50 border-rose-200"
                    )}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">ROAS</p>
                        <p className={cn(
                            "text-3xl font-black tracking-tighter",
                            roas >= 3 ? "text-emerald-700" : roas >= 1 ? "text-amber-700" : "text-rose-700"
                        )}>
                            {roas > 0 ? `${roas.toFixed(1)}x` : '—'}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 mt-1">
                            {roas >= 3 ? '🔥 Excellent' : roas >= 1 ? '✅ Profitable' : roas > 0 ? '⚠️ Below Target' : 'Enter data'}
                        </p>
                    </div>

                    {/* Cost Per Lead */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[1.5rem] p-5 border border-blue-100 text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Cost / Lead</p>
                        <p className="text-2xl font-black tracking-tighter text-slate-900">
                            {costPerLead > 0 ? `Rs ${Math.round(costPerLead).toLocaleString()}` : '—'}
                        </p>
                        <p className="text-[8px] font-bold text-blue-400 mt-1">Acquisition Cost</p>
                    </div>

                    {/* Cost Per Conversion */}
                    <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-[1.5rem] p-5 border border-purple-100 text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Cost / Sale</p>
                        <p className="text-2xl font-black tracking-tighter text-slate-900">
                            {costPerConversion > 0 ? `Rs ${Math.round(costPerConversion).toLocaleString()}` : '—'}
                        </p>
                        <p className="text-[8px] font-bold text-purple-400 mt-1">Per Conversion</p>
                    </div>

                    {/* Conversion Rate */}
                    <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-[1.5rem] p-5 border border-teal-100 text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Conv. Rate</p>
                        <p className="text-2xl font-black tracking-tighter text-slate-900">
                            {conversionRate > 0 ? `${conversionRate.toFixed(1)}%` : '—'}
                        </p>
                        <p className="text-[8px] font-bold text-teal-400 mt-1">Lead → Patient</p>
                    </div>

                    {/* Net Profit */}
                    <div className={cn(
                        "rounded-[1.5rem] p-5 border text-center",
                        netProfit >= 0 ? "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200" : "bg-gradient-to-br from-rose-50 to-red-50 border-rose-200"
                    )}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Net Profit</p>
                        <p className={cn(
                            "text-2xl font-black tracking-tighter",
                            netProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                        )}>
                            Rs {Math.abs(netProfit).toLocaleString()}
                        </p>
                        <p className={cn("text-[8px] font-bold mt-1", netProfit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {netProfit >= 0 ? '↑ Revenue > Spend' : '↓ Spend > Revenue'}
                        </p>
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Campaign Notes</Label>
                    <Textarea
                        placeholder="Which campaigns drove the most leads? What worked well this month..."
                        value={roasNotes}
                        onChange={e => setRoasNotes(e.target.value)}
                        className="rounded-2xl border-slate-200 min-h-[80px] font-medium resize-none"
                    />
                </div>

                {/* Visual Summary Bar */}
                {totalSpend > 0 && (
                    <div className="mt-6 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Spend vs Revenue</span>
                            <span className={cn(
                                "text-xs font-black px-3 py-1 rounded-full",
                                netProfit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            )}>
                                {netProfit >= 0 ? '+' : '-'}Rs {Math.abs(netProfit).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <div className="h-4 bg-slate-200 rounded-full overflow-hidden flex">
                                    <div
                                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-l-full transition-all duration-700"
                                        style={{ width: `${Math.min((totalSpend / Math.max(totalSpend, revenue)) * 100, 100)}%` }}
                                    />
                                </div>
                                <p className="text-[9px] font-bold text-violet-500 mt-1">Spend: Rs {totalSpend.toLocaleString()}</p>
                            </div>
                            <div className="flex-1">
                                <div className="h-4 bg-slate-200 rounded-full overflow-hidden flex">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-l-full transition-all duration-700"
                                        style={{ width: `${Math.min((revenue / Math.max(totalSpend, revenue)) * 100, 100)}%` }}
                                    />
                                </div>
                                <p className="text-[9px] font-bold text-emerald-500 mt-1">Revenue: Rs {revenue.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
