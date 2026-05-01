'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListTodo, CheckCircle2, ArrowRight } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import Link from 'next/link';

export function DailyTasksWidget() {
    const firestore = useFirestore();
    const { user } = useUser();
    const userId = user?.id;

    // Fetch task templates
    const templateQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(
            collection(firestore, 'adminTaskTemplates'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, userId]);
    const { data: templates } = useCollection<any>(templateQuery);

    // Fetch today's completions — todayStr stable per render of this widget;
    // memoize so a remount doesn't churn refs unnecessarily.
    const todayStr = React.useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
    const completionRef = useMemoFirebase(
        () => (firestore && userId ? doc(firestore, 'dailyTaskCompletions', `${userId}_${todayStr}`) : null),
        [firestore, userId, todayStr]
    );
    const { data: completionData } = useDoc<any>(completionRef);
    const completedTemplateIds: string[] = completionData?.completedTemplateIds || [];

    // Filter tasks assigned to user
    const userTasks = React.useMemo(() => {
        if (!templates || !userId) return [];
        return templates.filter((t: any) => t.assignedTo === 'all' || t.assignedTo === userId);
    }, [templates, userId]);

    const totalTasks = userTasks.length;
    const completedTasks = completedTemplateIds.length;
    const remainingTasks = totalTasks - completedTasks;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // SVG Circle Progress
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ListTodo className="h-5 w-5" />
                    Daily Tasks Progress
                </CardTitle>
                <CardDescription>Your task completion for today</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold">{remainingTasks}</span>
                                <span className="text-sm text-muted-foreground">tasks remaining</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span className="text-muted-foreground">
                                    {completedTasks} of {totalTasks} completed
                                </span>
                            </div>
                        </div>
                        <Link href="/daily-tasks">
                            <Button variant="outline" size="sm" className="mt-4 gap-1">
                                View All Tasks
                                <ArrowRight className="h-3 w-3" />
                            </Button>
                        </Link>
                    </div>
                    <div className="relative flex items-center justify-center">
                        <svg width="120" height="120" className="transform -rotate-90">
                            {/* Background circle */}
                            <circle
                                cx="60"
                                cy="60"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="none"
                                className="text-muted/20"
                            />
                            {/* Progress circle */}
                            <circle
                                cx="60"
                                cy="60"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                className="text-emerald-600 transition-all duration-500"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-bold">{progressPercentage}%</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
