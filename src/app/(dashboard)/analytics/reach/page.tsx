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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { TrendingUp, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { SocialReach } from '@/lib/types';

export default function ReachTrackerPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    const [platform, setPlatform] = React.useState('Instagram');
    const [reachInput, setReachInput] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const reachQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(collection(firestore, 'socialMetrics'), where('userId', '==', user.id), orderBy('date', 'desc'), limit(20));
    }, [firestore, user?.id]);

    const { data: reachMetrics } = useCollection<SocialReach>(reachQuery);

    const handleLogReach = async () => {
        if (!reachInput || isNaN(Number(reachInput))) {
            toast({ variant: "destructive", title: "Invalid", description: "Please enter a valid reach number." });
            return;
        }
        setIsSubmitting(true);
        try {
            const metric: Omit<SocialReach, 'id'> = {
                userId: user?.id || '',
                date: new Date().toISOString(),
                platform: platform as any,
                reach: Number(reachInput),
            };
            await addDocumentNonBlocking(collection(firestore, 'socialMetrics'), metric);
            toast({ title: "Reach Logged", description: "Data saved successfully." });
            setReachInput('');
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to log reach." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300">Reach Tracker</h1>
                <p className="text-muted-foreground">Monitor and analyze your social media performance metrics.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-indigo-700">
                        <TrendingUp className="h-5 w-5" />
                        Log Performance Metrics
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end border p-4 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/20">
                        <div className="space-y-2">
                            <Label>Platform</Label>
                            <Select value={platform} onValueChange={setPlatform}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Instagram">Instagram</SelectItem>
                                    <SelectItem value="Facebook">Facebook</SelectItem>
                                    <SelectItem value="TikTok">TikTok</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Reach Count</Label>
                            <Input type="number" value={reachInput} onChange={e => setReachInput(e.target.value)} placeholder="0" className="bg-background" />
                        </div>
                        <Button onClick={handleLogReach} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Submit Metrics"}
                        </Button>
                    </div>

                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Platform</TableHead>
                                    <TableHead className="text-right">Reach Count</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reachMetrics?.map(m => (
                                    <TableRow key={m.id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10">
                                        <TableCell>{format(new Date(m.date), 'MMM dd, yyyy HH:mm')}</TableCell>
                                        <TableCell className="font-medium text-indigo-600">{m.platform}</TableCell>
                                        <TableCell className="text-right font-mono font-bold leading-none">{m.reach.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                {(!reachMetrics || reachMetrics.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm italic">No records found. Start logging your performance above!</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
