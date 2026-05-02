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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Shield, ListTodo, CheckCircle2, Clock, Calendar, User, MessageSquare, Eye } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import type { DailyTask } from '@/lib/types';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function AdminTasksPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const [viewingTask, setViewingTask] = React.useState<any>(null);

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        // Fetch tasks assigned to this user that are 'Admin Assigned'
        return query(
            collection(firestore, 'dailyTasks'), 
            where('userId', '==', user.id),
            where('type', '==', 'Admin Assigned'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, user?.id]);

    const { data: tasks, isLoading, error } = useCollection<any>(tasksQuery);

    const handleTaskStatusChange = async (task: any, isCompleted: boolean) => {
        if (!firestore) return;
        try {
            const taskRef = doc(firestore, 'dailyTasks', task.id);
            await updateDocumentNonBlocking(taskRef, { 
                status: isCompleted ? 'Completed' : 'Pending',
                completedAt: isCompleted ? Date.now() : null
            });
            toast({
                title: isCompleted ? 'Task Completed!' : 'Task Reopened',
                description: isCompleted ? 'Great job on completing the admin task.' : 'Task status has been updated.',
            });
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update task status.',
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[2.5rem] border border-indigo-50 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em] mb-2">
                        <Shield className="h-4 w-4" /> Priority Directives
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900">Admin Tasks</h1>
                    <p className="text-slate-500 font-medium italic">Tasks assigned directly to you by the administrative team.</p>
                </div>
                <div className="flex items-center gap-6 pr-4">
                    <div className="text-right">
                        <div className="text-2xl font-black text-indigo-600">
                            {tasks?.filter((t:any) => t.status !== 'Completed').length || 0}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending Tasks</div>
                    </div>
                    <div className="h-12 w-px bg-slate-100" />
                    <div className="text-right">
                        <div className="text-2xl font-black text-emerald-500">
                            {tasks?.filter((t:any) => t.status === 'Completed').length || 0}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completed</div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6">
                {tasks && tasks.length > 0 ? (
                    tasks.map((task: any) => (
                        <Card key={task.id} className={cn(
                            "group border-none shadow-sm transition-all duration-300 rounded-[2rem] overflow-hidden",
                            task.status === 'Completed' ? "bg-emerald-50/30 opacity-80" : "bg-white hover:shadow-xl hover:shadow-indigo-100/50 hover:scale-[1.01]"
                        )}>
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row items-stretch">
                                    {/* Status Column */}
                                    <div className={cn(
                                        "w-full md:w-24 flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-50 transition-colors",
                                        task.status === 'Completed' ? "bg-emerald-50 text-emerald-500" : "bg-slate-50 text-slate-300"
                                    )}>
                                        <ListTodo className="h-8 w-8 opacity-20" />
                                    </div>

                                    {/* Main Content */}
                                    <div className="flex-1 p-8 space-y-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-none font-black text-[9px] uppercase tracking-tighter h-5 px-2">
                                                        High Priority
                                                    </Badge>
                                                    <Badge variant="outline" className="bg-slate-100 text-slate-500 border-none font-black text-[9px] uppercase tracking-tighter h-5 px-2">
                                                        Assigned by: {task.assignedByName || 'Admin'}
                                                    </Badge>
                                                </div>
                                                <h3 className={cn(
                                                    "text-xl font-black tracking-tight leading-tight",
                                                    task.status === 'Completed' ? "text-slate-400 line-through" : "text-slate-900"
                                                )}>
                                                    {task.title || task.task}
                                                </h3>
                                                
                                                <div className="flex items-center gap-3 mt-4">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="rounded-xl border-slate-200 font-black text-[10px] uppercase tracking-widest h-9 px-4 hover:bg-slate-50"
                                                        onClick={() => setViewingTask(task)}
                                                    >
                                                        <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant={task.status === 'Completed' ? "outline" : "default"}
                                                        onClick={() => handleTaskStatusChange(task, task.status !== 'Completed')}
                                                        className={cn(
                                                            "rounded-xl font-black text-[10px] uppercase tracking-widest h-9 px-4 shadow-sm",
                                                            task.status === 'Completed' 
                                                                ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50" 
                                                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        )}
                                                    >
                                                        {task.status === 'Completed' ? (
                                                            <><Clock className="h-3.5 w-3.5 mr-2" /> Mark as Incomplete</>
                                                        ) : (
                                                            <><CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Mark as Completed</>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "p-3 rounded-2xl shrink-0",
                                                task.status === 'Completed' ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"
                                            )}>
                                                {task.status === 'Completed' ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                    <Calendar className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assigned Date</p>
                                                    <p className="text-xs font-bold text-slate-700">{format(new Date(task.createdAt || Date.now()), 'PPP')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assigned By</p>
                                                    <p className="text-xs font-bold text-slate-700">{task.assignedByName || 'Management'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                    <ListTodo className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current Status</p>
                                                    <p className={cn(
                                                        "text-xs font-black uppercase tracking-widest",
                                                        task.status === 'Completed' ? "text-emerald-500" : "text-amber-500"
                                                    )}>{task.status}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {task.remarks && (
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-3">
                                                <MessageSquare className="h-5 w-5 text-slate-300 shrink-0 mt-1" />
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Instructions / Notes</p>
                                                    <p className="text-sm text-slate-600 font-bold leading-relaxed italic italic">"{task.remarks}"</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-indigo-100 shadow-sm">
                        <div className="bg-indigo-50 p-6 rounded-full w-fit mx-auto mb-6">
                            <Shield className="h-12 w-12 text-indigo-200" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">No Active Admin Directives</h3>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">You are all caught up with management tasks</p>
                    </div>
                )}
            </div>

            {/* Task Detail Dialog */}
            <Dialog open={!!viewingTask} onOpenChange={(open) => !open && setViewingTask(null)}>
                <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 max-w-xl overflow-hidden">
                    <DialogHeader className="p-8 bg-slate-900 text-white">
                        <div className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-[0.2em] mb-2">
                            <Shield className="h-4 w-4" /> Task Details
                        </div>
                        <DialogTitle className="text-3xl font-black tracking-tight leading-tight">
                            {viewingTask?.title || viewingTask?.task}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">
                            Assigned by {viewingTask?.assignedByName || 'Management'} on {viewingTask?.createdAt ? format(new Date(viewingTask.createdAt), 'PPP') : 'N/A'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-8 space-y-8">
                        <div className="space-y-4">
                            <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> Administrator Instructions
                            </h4>
                            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 min-h-[120px]">
                                <p className="text-slate-600 font-bold leading-relaxed italic text-lg">
                                    {viewingTask?.remarks ? `"${viewingTask.remarks}"` : "No specific instructions provided. Please proceed with standard protocols."}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
                            <Button 
                                onClick={() => {
                                    handleTaskStatusChange(viewingTask, viewingTask.status !== 'Completed');
                                    setViewingTask(null);
                                }}
                                className={cn(
                                    "flex-1 h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg",
                                    viewingTask?.status === 'Completed' 
                                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-none" 
                                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"
                                )}
                            >
                                {viewingTask?.status === 'Completed' ? 'Mark as Incomplete' : 'Complete Task Now'}
                            </Button>
                            <Button 
                                variant="ghost" 
                                onClick={() => setViewingTask(null)}
                                className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-slate-400"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
