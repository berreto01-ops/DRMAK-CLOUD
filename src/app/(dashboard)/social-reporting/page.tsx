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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, Send, Save, Edit3, TrendingUp, DollarSign } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import type { SocialReport, SocialCost, SocialROAS } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { collection, query, where, orderBy, updateDoc, doc, setDoc } from 'firebase/firestore';

export default function SocialReportingPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    // -- Activity Report State --
    const [summary, setSummary] = React.useState('');
    const [metrics, setMetrics] = React.useState('');
    const [plans, setPlans] = React.useState('');
    const [isSubmittingReport, setIsSubmittingReport] = React.useState(false);
    const [editingReport, setEditingReport] = React.useState<SocialReport | null>(null);

    // -- ROAS State --
    const [roasMonth, setRoasMonth] = React.useState(format(new Date(), 'MMMM'));
    const [roasYear, setRoasYear] = React.useState(new Date().getFullYear().toString());
    const [adSpend, setAdSpend] = React.useState('');
    const [boostingSpend, setBoostingSpend] = React.useState('');
    const [prSpend, setPrSpend] = React.useState('');
    const [otherSpend, setOtherSpend] = React.useState('');
    const [leadsGenerated, setLeadsGenerated] = React.useState('');
    const [leadsConverted, setLeadsConverted] = React.useState('');
    const [revenueFromConversions, setRevenueFromConversions] = React.useState('');
    const [isSubmittingRoas, setIsSubmittingRoas] = React.useState(false);

    // Filter reports by user
    const reportsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        return query(collection(firestore, 'socialReports'), where('userId', '==', user.id), orderBy('reportDate', 'desc'));
    }, [firestore, user]);

    const { data: reports, isLoading } = useCollection<SocialReport>(reportsQuery);

    const handleReportSubmit = async () => {
        if (!firestore || !user) {
            toast({ variant: "destructive", title: "Error", description: "Authentication error." });
            return;
        }
        if (!summary.trim() || !plans.trim() || !metrics.trim()) {
            toast({ variant: "destructive", title: "Missing Information", description: "Please fill out all report fields." });
            return;
        }

        setIsSubmittingReport(true);
        const reportData = {
            userId: user.id,
            reportDate: editingReport ? editingReport.reportDate : new Date().toISOString(),
            summary: summary.trim(),
            metrics: metrics.trim(),
            plans: plans.trim(),
        };

        try {
            if (editingReport) {
                await updateDoc(doc(firestore, 'socialReports', editingReport.id), reportData);
                toast({ title: "Report Updated", description: "Changes saved successfully." });
            } else {
                await addDocumentNonBlocking(collection(firestore, 'socialReports'), reportData);
                toast({ title: "Report Submitted", description: "Your social media report has been saved." });
            }
            
            setSummary('');
            setMetrics('');
            setPlans('');
            setEditingReport(null);
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save report." });
        } finally {
            setIsSubmittingReport(false);
        }
    }

    const startEditing = (report: SocialReport) => {
        setEditingReport(report);
        setSummary(report.summary);
        setMetrics(report.metrics);
        setPlans(report.plans);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const cancelEditing = () => {
        setEditingReport(null);
        setSummary('');
        setMetrics('');
        setPlans('');
    }

    const handleRoasSubmit = async () => {
        if (!firestore || !user) {
            toast({ variant: "destructive", title: "Error", description: "Authentication error." });
            return;
        }

        setIsSubmittingRoas(true);
        
        const monthKey = `${roasMonth}_${roasYear}`;
        const totalAd = Number(adSpend) || 0;
        const totalBoost = Number(boostingSpend) || 0;
        const totalPr = Number(prSpend) || 0;
        const totalOther = Number(otherSpend) || 0;
        const totalSpent = totalAd + totalBoost + totalPr + totalOther;

        const generated = Number(leadsGenerated) || 0;
        const converted = Number(leadsConverted) || 0;
        const revenue = Number(revenueFromConversions) || 0;

        const costData: Partial<SocialCost> = {
            month: roasMonth,
            year: Number(roasYear),
            adSpend: totalAd,
            boostingSpend: totalBoost,
            prSpend: totalPr,
            otherSpend: totalOther,
            totalSpent: totalSpent,
            updatedAt: new Date().toISOString(),
            updatedBy: user.id
        };

        const roasData: Partial<SocialROAS> = {
            month: roasMonth,
            year: Number(roasYear),
            totalAdSpend: totalSpent, // Using total spent as total ad spend for P&L simplicity
            leadsGenerated: generated,
            leadsConverted: converted,
            revenueFromConversions: revenue,
            costPerLead: generated > 0 ? totalSpent / generated : 0,
            costPerConversion: converted > 0 ? totalSpent / converted : 0,
            conversionRate: generated > 0 ? (converted / generated) * 100 : 0,
            roas: totalSpent > 0 ? revenue / totalSpent : 0,
            updatedAt: new Date().toISOString(),
            updatedBy: user.id
        };

        try {
            await setDoc(doc(firestore, 'socialCosts', monthKey), costData, { merge: true });
            await setDoc(doc(firestore, 'socialROAS', monthKey), roasData, { merge: true });
            
            toast({ title: "ROAS Data Submitted", description: "Financial metrics successfully synced to Strategic P&L." });
            
            setAdSpend('');
            setBoostingSpend('');
            setPrSpend('');
            setOtherSpend('');
            setLeadsGenerated('');
            setLeadsConverted('');
            setRevenueFromConversions('');
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Failed to save ROAS data." });
        } finally {
            setIsSubmittingRoas(false);
        }
    };

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentYear = new Date().getFullYear();
    const years = [currentYear.toString(), (currentYear - 1).toString(), (currentYear - 2).toString()];

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4">
            <Tabs defaultValue="reports" className="w-full">
                <TabsList className="mb-6 bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger value="reports" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                        <FileText className="h-4 w-4 mr-2" /> Activity Reports
                    </TabsTrigger>
                    <TabsTrigger value="roas" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
                        <TrendingUp className="h-4 w-4 mr-2" /> Ad Spend & ROAS Log
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="reports" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-6 w-6 text-indigo-600"/>
                                {editingReport ? 'Edit Social Media Report' : 'Submit Social Media Report'}
                            </CardTitle>
                            <CardDescription>
                                {editingReport ? `Editing report from ${format(new Date(editingReport.reportDate), 'MMM dd, yyyy')}` : 'Submit your periodic report for management review.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="summary">Activity Summary</Label>
                                    <Textarea id="summary" placeholder="Summarize your key activities for the period..." value={summary} onChange={(e) => setSummary(e.target.value)} rows={4}/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="metrics">Key Metrics & Highlights</Label>
                                    <Textarea id="metrics" placeholder="Detail important metrics like engagement, reach, follower growth, and campaign highlights..." value={metrics} onChange={(e) => setMetrics(e.target.value)} rows={4}/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="plans">Plans for Next Period</Label>
                                    <Textarea id="plans" placeholder="Outline your main objectives and plans for the next reporting period..." value={plans} onChange={(e) => setPlans(e.target.value)} rows={4}/>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                {editingReport && (
                                    <Button variant="ghost" onClick={cancelEditing}>
                                        Cancel Edit
                                    </Button>
                                )}
                                <Button onClick={handleReportSubmit} disabled={isSubmittingReport} className="bg-indigo-600 hover:bg-indigo-700">
                                    {isSubmittingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (editingReport ? <Save className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />)}
                                    {editingReport ? 'Update Report' : 'Submit Report'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>My Past Reports</CardTitle>
                            <CardDescription>A history of your submitted social media reports.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {isLoading ? (
                                <div className="flex justify-center items-center h-48">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Summary</TableHead>
                                        <TableHead>Metrics/Highlights</TableHead>
                                        <TableHead>Next Plans</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reports?.map(report => (
                                        <TableRow key={report.id}>
                                            <TableCell className="font-medium whitespace-nowrap">{format(new Date(report.reportDate), 'MMM dd, yyyy')}</TableCell>
                                            <TableCell><p className="line-clamp-3 text-sm">{report.summary}</p></TableCell>
                                            <TableCell><p className="line-clamp-3 text-sm">{report.metrics}</p></TableCell>
                                            <TableCell><p className="line-clamp-3 text-sm">{report.plans}</p></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => startEditing(report)} className="h-8 text-indigo-600 hover:text-indigo-700">
                                                    Edit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {reports?.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-24">
                                                You have not submitted any reports yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="roas" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <Card className="border-none shadow-xl shadow-slate-200/50">
                        <CardHeader className="bg-emerald-50/50 rounded-t-xl border-b border-emerald-100/50">
                            <CardTitle className="flex items-center gap-3 text-emerald-900">
                                <div className="p-2 bg-emerald-600 rounded-lg text-white">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                ROAS & Ad Spend Logging
                            </CardTitle>
                            <CardDescription className="font-medium text-emerald-800/70">
                                Enter your marketing spend and conversion metrics here. This data syncs directly with the Admin Strategic P&L.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-8">
                            <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="space-y-2">
                                    <Label className="font-bold text-slate-600">Report Month</Label>
                                    <Select value={roasMonth} onValueChange={setRoasMonth}>
                                        <SelectTrigger className="bg-white"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-slate-600">Report Year</Label>
                                    <Select value={roasYear} onValueChange={setRoasYear}>
                                        <SelectTrigger className="bg-white"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                {/* Spend Section */}
                                <div className="space-y-4">
                                    <h3 className="font-black text-slate-800 flex items-center gap-2 border-b pb-2">
                                        <TrendingUp className="h-4 w-4 text-rose-500" /> Outflows & Spend
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label>Direct Ad Spend (Meta, Google, etc)</Label>
                                            <Input type="number" placeholder="Rs" value={adSpend} onChange={e => setAdSpend(e.target.value)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Post Boosting Spend</Label>
                                            <Input type="number" placeholder="Rs" value={boostingSpend} onChange={e => setBoostingSpend(e.target.value)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>PR & Influencer Marketing</Label>
                                            <Input type="number" placeholder="Rs" value={prSpend} onChange={e => setPrSpend(e.target.value)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Other Marketing Spend</Label>
                                            <Input type="number" placeholder="Rs" value={otherSpend} onChange={e => setOtherSpend(e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {/* Conversions Section */}
                                <div className="space-y-4">
                                    <h3 className="font-black text-slate-800 flex items-center gap-2 border-b pb-2">
                                        <TrendingUp className="h-4 w-4 text-emerald-500" /> Conversions & Revenue
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label>Total Leads Generated</Label>
                                            <Input type="number" placeholder="Number of leads" value={leadsGenerated} onChange={e => setLeadsGenerated(e.target.value)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Leads Successfully Converted</Label>
                                            <Input type="number" placeholder="Number of converted leads" value={leadsConverted} onChange={e => setLeadsConverted(e.target.value)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-emerald-700 font-bold">Revenue from Conversions</Label>
                                            <Input type="number" placeholder="Total Rs generated from these leads" className="border-emerald-200 focus-visible:ring-emerald-500" value={revenueFromConversions} onChange={e => setRevenueFromConversions(e.target.value)} />
                                            <p className="text-[10px] text-slate-500">Ask the front desk or check Strategic P&L if unsure.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-4 flex justify-end">
                                <Button onClick={handleRoasSubmit} disabled={isSubmittingRoas} className="bg-emerald-600 hover:bg-emerald-700 h-12 px-8 font-black rounded-xl shadow-lg shadow-emerald-200">
                                    {isSubmittingRoas ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Save className="mr-2 h-5 w-5" />}
                                    Sync Financial Data to Admin
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
