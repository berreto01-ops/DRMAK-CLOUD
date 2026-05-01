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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, PlusCircle, Trash2, ListTodo, CheckCircle2, Circle } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useDoc } from '@/firebase';
import type { DailyTask } from '@/lib/types';
import { collection, query, where, doc, orderBy, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';


export default function DailyTasksPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();

    const [newTask, setNewTask] = React.useState('');
    const [editingTask, setEditingTask] = React.useState<DailyTask | null>(null);
    const [remarksState, setRemarksState] = React.useState<Record<string, string>>({});

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(collection(firestore, 'dailyTasks'), where('userId', '==', user.id), orderBy('dueDate', 'desc'));
    }, [firestore, user?.id]);

    const { data: tasks, isLoading, error, forceRerender } = useCollection<DailyTask>(tasksQuery);

    const lastErrorRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (error && error.message !== lastErrorRef.current) {
            console.error("DailyTasks Error:", error);
            lastErrorRef.current = error.message;
            if ((error as any).code !== 'permission-denied') {
                toast({
                    variant: 'destructive',
                    title: 'Database Error',
                    description: error.message || 'An error occurred while fetching your tasks.',
                });
            }
        } else if (!error) {
            lastErrorRef.current = null;
        }
    }, [error, toast]);

    const sortedTasks = React.useMemo(() => {
        if (!tasks) return [];
        return [...tasks].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    }, [tasks]);

    const handleAddTask = async () => {
        if (!firestore || !user) {
            toast({ variant: "destructive", title: "Error", description: "Authentication error." });
            return;
        }
        if (!newTask.trim()) {
            toast({ variant: "destructive", title: "Missing Task", description: "Please enter a task description." });
            return;
        }

        try {
            if (editingTask) {
                const taskRef = doc(firestore, 'dailyTasks', editingTask.id);
                await updateDocumentNonBlocking(taskRef, { task: newTask });
                toast({ title: "Task Updated", description: "Changes have been saved." });
            } else {
                const task: Omit<DailyTask, 'id'> = {
                    userId: user.id,
                    task: newTask,
                    status: 'Pending',
                    dueDate: new Date().toISOString(),
                };
                await addDocumentNonBlocking(collection(firestore, 'dailyTasks'), task);
                toast({ title: "Task Added", description: "Your new task has been saved." });
            }
            setNewTask('');
            setEditingTask(null);
            forceRerender();
        } catch (error) {
            console.error("Failed to save task:", error);
            toast({ variant: "destructive", title: "Save Failed", description: "Could not save your task." });
        }
    };

    const startEditing = (task: DailyTask) => {
        setEditingTask(task);
        setNewTask(task.task);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEditing = () => {
        setEditingTask(null);
        setNewTask('');
    };

    const handleTaskStatusChange = (task: DailyTask, isCompleted: boolean) => {
        if (!firestore) return;
        const taskRef = doc(firestore, 'dailyTasks', task.id);
        updateDocumentNonBlocking(taskRef, { status: isCompleted ? 'Completed' : 'Pending' });
    };

    // ADMIN TEMPLATES LOGIC - Filter by assigned user
    const templateQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        // Show templates assigned to this user OR assigned to "all"
        return query(
            collection(firestore, 'adminTaskTemplates'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, user?.id]);
    const { data: templates } = useCollection<any>(templateQuery);

    const todayStr = React.useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
    const completionRef = useMemoFirebase(
        () => (firestore && user?.id ? doc(firestore, 'dailyTaskCompletions', `${user.id}_${todayStr}`) : null),
        [firestore, user?.id, todayStr]
    );
    const { data: completionData } = useDoc<any>(completionRef);
    const completedTemplateIds: string[] = completionData?.completedTemplateIds || [];

    const toggleTemplateTask = async (templateId: string, checked: boolean) => {
        if (!firestore || !user) return;
        const ref = doc(firestore, 'dailyTaskCompletions', `${user.id}_${todayStr}`);
        
        const currentIds = new Set(completionData?.completedTemplateIds || []);
        const currentRemarks = completionData?.remarksMap || {};
        
        if (checked) {
            currentIds.add(templateId);
            if (remarksState[templateId]) {
                currentRemarks[templateId] = remarksState[templateId];
            }
        } else {
            currentIds.delete(templateId);
            delete currentRemarks[templateId];
        }

        await setDoc(ref, {
            userId: user.id,
            userName: user.name,
            date: todayStr,
            completedTemplateIds: Array.from(currentIds),
            remarksMap: currentRemarks,
            updatedAt: new Date().getTime()
        }, { merge: true });
    };

    const handleDeleteTask = (taskId: string) => {
        if (!firestore) return;
        const taskRef = doc(firestore, 'dailyTasks', taskId);
        deleteDocumentNonBlocking(taskRef);
    }

    return (
        <div className="space-y-6">
            {/* Admin Assigned Tasks */}
            <Card className="bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ListTodo className="h-6 w-6 text-indigo-500" />
                        Assigned Daily Tasks
                    </CardTitle>
                    <CardDescription>Recurring tasks assigned by management.</CardDescription>
                </CardHeader>
                <CardContent>
                    {templates && templates.length > 0 ? (
                        <div className="space-y-6">
                            {Array.from(new Set(templates.filter((t: any) => t.assignedTo === 'all' || t.assignedTo === user?.id).map((t: any) => t.category))).map((category: any) => (
                                <div key={category} className="space-y-3">
                                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{category}</h3>
                                    <Accordion type="multiple" className="space-y-2">
                                        {templates.filter((t: any) => t.category === category && (t.assignedTo === 'all' || t.assignedTo === user?.id)).map((t: any) => {
                                            const isCompleted = completedTemplateIds.includes(t.id);
                                            return (
                                                <AccordionItem
                                                    key={t.id}
                                                    value={t.id}
                                                    className={`border rounded-lg overflow-hidden transition-all ${isCompleted
                                                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800'
                                                            : 'bg-background border-border hover:border-primary/50'
                                                        }`}
                                                >
                                                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                                        <div className="flex items-center gap-3 flex-1">
                                                            {isCompleted ? (
                                                                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                                            ) : (
                                                                <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                            )}
                                                            <span className={`text-left font-medium ${isCompleted ? 'text-emerald-700 dark:text-emerald-300 line-through' : 'text-foreground'}`}>
                                                                {t.content}
                                                            </span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="px-4 pb-4 pt-2">
                                                        <div className="space-y-4 pl-8">
                                                            {!isCompleted && (
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Remarks / Progress</label>
                                                                    <textarea
                                                                        className="w-full min-h-[80px] p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                                        placeholder="What have you done for this task? Add your remarks here..."
                                                                        value={remarksState[t.id] || ''}
                                                                        onChange={(e) => setRemarksState(prev => ({ ...prev, [t.id]: e.target.value }))}
                                                                    />
                                                                </div>
                                                            )}
                                                            
                                                            {isCompleted && completionData?.remarksMap?.[t.id] && (
                                                                <div className="p-3 rounded-xl bg-emerald-100/30 border border-emerald-100">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Your Submission</p>
                                                                    <p className="text-sm text-emerald-800 italic">"{completionData.remarksMap[t.id]}"</p>
                                                                </div>
                                                            )}

                                                            <p className="text-xs text-muted-foreground">
                                                                {isCompleted
                                                                    ? '✓ Task completed for today'
                                                                    : 'Explain your work above and click mark as complete.'}
                                                            </p>
                                                            
                                                            <Button
                                                                size="sm"
                                                                variant={isCompleted ? "outline" : "default"}
                                                                onClick={() => toggleTemplateTask(t.id, !isCompleted)}
                                                                className={isCompleted ? "gap-2" : "gap-2 bg-emerald-600 hover:bg-emerald-700 h-10 px-6 rounded-xl font-bold"}
                                                            >
                                                                {isCompleted ? (
                                                                    <>
                                                                        <Circle className="h-4 w-4" />
                                                                        Mark as Incomplete
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                        Submit & Mark Complete
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            );
                                        })}
                                    </Accordion>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">No assigned tasks found.</div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ListTodo className="h-6 w-6" />
                        Daily Tasks
                    </CardTitle>
                    <CardDescription>Manage your daily to-do list.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder={editingTask ? "Update task description..." : "Add a new task..."}
                            value={newTask}
                            onChange={(e) => setNewTask(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                            className={editingTask ? "border-indigo-400 bg-indigo-50/30 ring-1 ring-indigo-400/20" : ""}
                        />
                        {editingTask && (
                            <Button variant="ghost" onClick={cancelEditing} className="text-slate-500">Cancel</Button>
                        )}
                        <Button onClick={handleAddTask} className={editingTask ? "bg-indigo-600 hover:bg-indigo-700" : ""}>
                            {editingTask ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            {editingTask ? "Update Task" : "Add Task"}
                        </Button>
                    </div>

                    <div className="border rounded-md">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-48">
                                <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                        ) : sortedTasks && sortedTasks.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">Status</TableHead>
                                        <TableHead>Task</TableHead>
                                        <TableHead className="w-32">Date</TableHead>
                                        <TableHead className="w-12 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedTasks.map(task => (
                                        <TableRow key={task.id} className={task.status === 'Completed' ? 'bg-muted/50' : ''}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={task.status === 'Completed'}
                                                    onCheckedChange={(checked) => handleTaskStatusChange(task, !!checked)}
                                                    aria-label={`Mark task ${task.status === 'Completed' ? 'incomplete' : 'complete'}`}
                                                />
                                            </TableCell>
                                            <TableCell className={`font-medium ${task.status === 'Completed' ? 'text-muted-foreground line-through' : ''}`}>
                                                {task.task}
                                            </TableCell>
                                            <TableCell>{format(new Date(task.dueDate), 'MMM dd, HH:mm')}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => startEditing(task)}>
                                                        <Pencil className="h-4 w-4 text-indigo-600" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">
                                You have no tasks yet. Add one above to get started!
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
