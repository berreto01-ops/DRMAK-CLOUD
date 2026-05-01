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
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp, CheckCircle2, ListTodo, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { DailyTask, DailyReport } from '@/lib/types';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { format, isToday } from 'date-fns';

export default function DailyProgressPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(collection(firestore, 'dailyTasks'), where('userId', '==', user.id), orderBy('dueDate', 'desc'));
    }, [firestore, user?.id]);

    const reportsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(collection(firestore, 'dailyReports'), where('userId', '==', user.id), orderBy('reportDate', 'desc'));
    }, [firestore, user?.id]);

    const { data: tasks, isLoading: tasksLoading, error: tasksError } = useCollection<DailyTask>(tasksQuery);
    const { data: latestReport, isLoading: reportsLoading, error: reportsError } = useCollection<DailyReport>(reportsQuery);

    const isLoading = isUserLoading || tasksLoading || reportsLoading;

    const lastErrorRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        const error = tasksError || reportsError;
        if (error && error.message !== lastErrorRef.current) {
            console.error("DailyProgress Error:", error);
            lastErrorRef.current = error.message;
            // Don't show toast for permission errors as they might be handled globally
            if ((error as any).code !== 'permission-denied') {
                toast({
                    variant: 'destructive',
                    title: 'Database Error',
                    description: error.message || 'An error occurred while fetching your data.',
                });
            }
        } else if (!error) {
            lastErrorRef.current = null;
        }
    }, [tasksError, reportsError, toast]);

    const dailyStats = React.useMemo(() => {
        if (!tasks) return { completed: 0, pending: 0, total: 0, progress: 0 };
        const todayTasks = tasks.filter(task => isToday(new Date(task.dueDate)));
        const completed = todayTasks.filter(task => task.status === 'Completed').length;
        const total = todayTasks.length;
        const progress = total > 0 ? (completed / total) * 100 : 0;
        return {
            completed,
            pending: total - completed,
            total,
            progress,
        };
    }, [tasks]);

    const sortedTasks = React.useMemo(() => {
        if (!tasks) return [];
        return tasks
            .filter(task => isToday(new Date(task.dueDate)))
            .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    }, [tasks]);

    const sortedLatestReport = React.useMemo(() => {
        if (!latestReport) return [];
        return latestReport.sort((a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());
    }, [latestReport]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-6 w-6" />
                        Your Daily Progress
                    </CardTitle>
                    <CardDescription>An overview of your tasks and reports for today, {format(new Date(), 'MMMM dd, yyyy')}.</CardDescription>
                </CardHeader>
            </Card>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dailyStats.completed} / {dailyStats.total}</div>
                        <p className="text-xs text-muted-foreground">You've completed {dailyStats.completed} tasks today.</p>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Task Completion Progress</CardTitle>
                        <ListTodo className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dailyStats.progress.toFixed(0)}%</div>
                        <Progress value={dailyStats.progress} className="mt-2" />
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Latest Daily Report
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {sortedLatestReport && sortedLatestReport.length > 0 ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">Submitted on: {format(new Date(sortedLatestReport[0].reportDate), 'PPpp')}</p>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold mb-2">Summary</h4>
                                    <p className="text-sm p-3 bg-muted rounded-md">{sortedLatestReport[0].summary}</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Plans for Next Day</h4>
                                    <p className="text-sm p-3 bg-muted rounded-md">{sortedLatestReport[0].plans}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">You haven't submitted any reports yet.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Today's Task List</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Task</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedTasks.map(task => (
                                <TableRow key={task.id}>
                                    <TableCell>
                                        <span className={`px-2 py-1 text-xs rounded-full ${task.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {task.status}
                                        </span>
                                    </TableCell>
                                    <TableCell>{task.task}</TableCell>
                                </TableRow>
                            ))}
                            {sortedTasks.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center h-24">No tasks scheduled for today.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
