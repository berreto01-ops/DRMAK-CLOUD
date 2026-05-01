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
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, useUser } from '@/firebase';
import { query, collection, where, deleteDoc, doc } from 'firebase/firestore';
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
import { Loader2, CalendarDays, Plus, ChevronLeft, ChevronRight, Palette, Trash2, CheckCircle2, Clock, ListTodo } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DesignerTask {
    id: string;
    userId: string;
    title: string;
    description?: string;
    date: string; // ISO date string (yyyy-MM-dd)
    priority: 'Low' | 'Medium' | 'High';
    status: 'Pending' | 'In Progress' | 'Done';
    createdAt: string;
}

const PRIORITY_COLORS = {
    Low: 'bg-slate-100 text-slate-700 border-slate-200',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200',
    High: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PRIORITY_DOT = {
    Low: 'bg-slate-400',
    Medium: 'bg-amber-500',
    High: 'bg-rose-500',
};

export default function DesignerPlannerPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [priority, setPriority] = React.useState<'Low' | 'Medium' | 'High'>('Medium');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Fetch tasks ONLY for this designer user — no orderBy to avoid composite index requirement
    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(
            collection(firestore, 'designerCalendarTasks'),
            where('userId', '==', user.id)
        );
    }, [firestore, user?.id]);

    const { data: rawTasks, isLoading } = useCollection<DesignerTask>(tasksQuery);

    // Sort client-side to avoid needing a Firestore composite index
    const tasks = React.useMemo(() => {
        if (!rawTasks) return [];
        return [...rawTasks].sort((a, b) => a.date.localeCompare(b.date));
    }, [rawTasks]);

    const days = React.useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const getTasksForDay = (day: Date) => {
        if (!tasks) return [];
        return tasks.filter(t => t.date === format(day, 'yyyy-MM-dd'));
    };

    const selectedDayTasks = React.useMemo(() => {
        if (!selectedDay || !tasks) return [];
        return tasks.filter(t => t.date === format(selectedDay, 'yyyy-MM-dd'));
    }, [selectedDay, tasks]);

    const upcomingTasks = React.useMemo(() => {
        if (!tasks) return [];
        const today = format(new Date(), 'yyyy-MM-dd');
        return tasks.filter(t => t.date >= today && t.status !== 'Done').slice(0, 6);
    }, [tasks]);

    const handleDayClick = (day: Date) => {
        setSelectedDay(day);
        setTitle('');
        setDescription('');
        setPriority('Medium');
        setIsDialogOpen(true);
    };

    const handleSaveTask = async () => {
        if (!title.trim() || !selectedDay || !user || !firestore) {
            toast({ variant: 'destructive', title: 'Required', description: 'Please enter a task title.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const newTask: Omit<DesignerTask, 'id'> = {
                userId: user.id,
                title: title.trim(),
                description: description.trim(),
                date: format(selectedDay, 'yyyy-MM-dd'),
                priority,
                status: 'Pending',
                createdAt: new Date().toISOString(),
            };
            await addDocumentNonBlocking(collection(firestore, 'designerCalendarTasks'), newTask);
            toast({ title: 'Task Saved!', description: `Added to ${format(selectedDay, 'MMM dd, yyyy')}.` });
            setIsDialogOpen(false);
            setTitle('');
            setDescription('');
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save task.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'designerCalendarTasks', taskId));
            toast({ title: 'Deleted', description: 'Task removed from calendar.' });
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete task.' });
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-1">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        <Palette className="h-8 w-8 text-purple-600" />
                        My Planner
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Click any date to add tasks and track your creative work.</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-2xl px-5 py-3 text-center">
                    <p className="text-2xl font-black text-purple-700">{upcomingTasks.length}</p>
                    <p className="text-[10px] uppercase font-black text-purple-400 tracking-widest">Upcoming</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Calendar */}
                <Card className="lg:col-span-2 border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 py-4">
                        <div className="space-y-0.5">
                            <CardTitle className="flex items-center gap-2 text-purple-800">
                                <CalendarDays className="h-5 w-5" />
                                Calendar
                            </CardTitle>
                            <CardDescription>Click a date to add a task.</CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="h-8 w-8">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-bold min-w-[110px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="h-8 w-8">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Weekday headers */}
                        <div className="grid grid-cols-7 gap-px bg-slate-200 border-b">
                            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                                <div key={day} className="bg-white p-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    {day}
                                </div>
                            ))}
                        </div>
                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-px bg-slate-200">
                            {days.map((day, i) => {
                                const dayTasks = getTasksForDay(day);
                                const isCurrentMonth = isSameMonth(day, currentMonth);
                                const isToday = isSameDay(day, new Date());

                                return (
                                    <div
                                        key={i}
                                        onClick={() => handleDayClick(day)}
                                        className={cn(
                                            'bg-white p-1.5 h-28 relative cursor-pointer group hover:bg-purple-50/60 transition-colors',
                                            !isCurrentMonth && 'bg-slate-50/50 text-slate-300'
                                        )}
                                    >
                                        <span className={cn(
                                            'text-[11px] font-black leading-none',
                                            isToday
                                                ? 'bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center'
                                                : isCurrentMonth ? 'text-slate-600' : 'text-slate-300'
                                        )}>
                                            {format(day, 'd')}
                                        </span>

                                        {/* Tasks preview */}
                                        <div className="mt-1 space-y-0.5 overflow-hidden max-h-[68%]">
                                            {dayTasks.slice(0, 3).map(t => (
                                                <div key={t.id} className={cn(
                                                    'px-1 py-0.5 rounded text-[8px] font-bold leading-tight truncate border flex items-center gap-0.5',
                                                    PRIORITY_COLORS[t.priority]
                                                )}>
                                                    <div className={cn('w-1 h-1 rounded-full shrink-0', PRIORITY_DOT[t.priority])} />
                                                    {t.title}
                                                </div>
                                            ))}
                                            {dayTasks.length > 3 && (
                                                <p className="text-[8px] font-black text-purple-400 pl-1">+{dayTasks.length - 3} more</p>
                                            )}
                                        </div>

                                        {/* Hover add icon */}
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Plus className="h-3 w-3 text-purple-400" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Sidebar: Upcoming Tasks */}
                <div className="space-y-4">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-800">
                                <ListTodo className="h-4 w-4 text-purple-600" />
                                Upcoming Tasks
                            </CardTitle>
                            <CardDescription className="text-[11px]">Your next pending items.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-3">
                            <div className="space-y-2">
                                {upcomingTasks.length > 0 ? upcomingTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className="flex items-start justify-between p-3 border border-slate-100 rounded-xl hover:border-purple-200 transition-colors bg-slate-50/30 group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-xs text-slate-800 truncate">{task.title}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] text-slate-400 font-medium flex items-center gap-0.5">
                                                    <Clock className="h-2.5 w-2.5" />
                                                    {format(new Date(task.date), 'MMM dd')}
                                                </span>
                                                <Badge className={cn('text-[8px] h-4 px-1.5 font-bold border', PRIORITY_COLORS[task.priority])}>
                                                    {task.priority}
                                                </Badge>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                            onClick={() => handleDeleteTask(task.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )) : (
                                    <div className="text-center py-10">
                                        <div className="mx-auto w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mb-2">
                                            <CheckCircle2 className="h-5 w-5 text-purple-300" />
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium">No upcoming tasks.</p>
                                        <p className="text-[10px] text-slate-300 mt-0.5">Click a date to add one!</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Legend */}
                    <Card className="border-purple-100 bg-purple-50/30">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-black text-purple-700">Priority Legend</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-2">
                            {(['High', 'Medium', 'Low'] as const).map(p => (
                                <div key={p} className="flex items-center gap-2">
                                    <div className={cn('w-2 h-2 rounded-full', PRIORITY_DOT[p])} />
                                    <span className="text-xs font-bold text-slate-600">{p} Priority</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Add Task Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800">
                            <CalendarDays className="h-5 w-5 text-purple-600" />
                            Add Task — {selectedDay ? format(selectedDay, 'MMMM dd, yyyy') : ''}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">Task Title *</Label>
                            <Input
                                placeholder="e.g., Design Instagram carousel..."
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="h-11 rounded-xl border-slate-200"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleSaveTask()}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">Priority</Label>
                            <Select value={priority} onValueChange={v => setPriority(v as any)}>
                                <SelectTrigger className="h-11 rounded-xl border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="High">🔴 High</SelectItem>
                                    <SelectItem value="Medium">🟡 Medium</SelectItem>
                                    <SelectItem value="Low">⚪ Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">Notes (optional)</Label>
                            <Textarea
                                placeholder="Any additional details..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="rounded-xl border-slate-200 resize-none h-20"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveTask}
                            disabled={isSubmitting}
                            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Task'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
