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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, useUser } from '@/firebase';
import { uploadFile } from '@/firebase/storage';
import type { DailyPosting } from '@/lib/types';
import { collection, query, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
    Loader2,
    Send,
    Video,
    History,
    ExternalLink,
    Instagram,
    Facebook,
    Share2,
    MessageCircle,
    MoreHorizontal,
    Image as ImageIcon,
    FileText,
    Pencil,
    Trash2,
    Eye
} from 'lucide-react';
import { cn } from "@/lib/utils";

const PLATFORM_ICONS = {
    Instagram: Instagram,
    Facebook: Facebook,
    WhatsApp: MessageCircle,
    TikTok: Video,
    Other: Share2,
};

export default function DailyPostingPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    // Form Stats
    const [platform, setPlatform] = React.useState<string>('Instagram');
    const [activityType, setActivityType] = React.useState<string>('Post');
    const [description, setDescription] = React.useState('');
    const [link, setLink] = React.useState('');
    const [postedAt, setPostedAt] = React.useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    const [screenshotFile, setScreenshotFile] = React.useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Edit State
    const [editingLog, setEditingLog] = React.useState<DailyPosting | null>(null);
    const [viewingLog, setViewingLog] = React.useState<DailyPosting | null>(null);

    // Fetch History
    const postingsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.id) return null;
        const isManager = user.role === 'Admin' || user.role === 'Social Media Manager' || user.role === 'Operations Manager';
        if (isManager) {
            return query(collection(firestore, 'dailyPostings'));
        }
        return query(collection(firestore, 'dailyPostings'), where('userId', '==', user.id));
    }, [firestore, user?.id, user?.role]);

    const { data: rawPostings, isLoading, forceRerender } = useCollection<DailyPosting>(postingsQuery);

    const postings = React.useMemo(() => {
        if (!rawPostings) return [];
        return [...rawPostings].sort((a, b) => {
            const dateA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
            const dateB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
            return dateB - dateA;
        });
    }, [rawPostings]);

    const handleSubmit = async () => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'System Error', description: 'Not authenticated.' });
            return;
        }

        if (!description.trim()) {
            toast({ variant: 'destructive', title: 'Missing Info', description: 'Please describe what you posted.' });
            return;
        }

        setIsSubmitting(true);
        try {
            let uploadedUrl = editingLog?.screenshotUrl || "";
            let uploadFailed = false;
            
            // 1. Handle File Upload if exists
            if (screenshotFile) {
                const path = `daily-postings/${user.id}/${Date.now()}_${screenshotFile.name}`;
                const result = await uploadFile(screenshotFile, path);
                if (result) {
                    uploadedUrl = result;
                } else {
                    uploadFailed = true;
                }
            }

            // 2. Prepare Data
            const logData: Omit<DailyPosting, 'id'> = {
                userId: user.id,
                platform: platform as any,
                activityType: activityType as any,
                description: description.trim(),
                link: link.trim() || "",
                screenshotUrl: uploadedUrl,
                postedAt: new Date(postedAt).toISOString(),
            };

            // 3. Save to Firestore
            if (editingLog) {
                await updateDoc(doc(firestore, 'dailyPostings', editingLog.id), logData);
            } else {
                await addDocumentNonBlocking(collection(firestore, 'dailyPostings'), logData);
            }
            
            // 4. Combined Feedback
            toast({ 
                title: editingLog ? 'Log Updated' : 'Post Logged', 
                description: uploadFailed ? 'Saved without image due to connection.' : 'Your activity has been recorded.' 
            });
            
            // 5. Reset
            resetForm();
            if (forceRerender) forceRerender();
            
        } catch (error: any) {
            console.error("Submit Error:", error);
            toast({ 
                variant: 'destructive', 
                title: 'Submission Error', 
                description: 'Could not save your activity. Please check your connection.' 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'dailyPostings', id));
            toast({ title: 'Deleted', description: 'Activity log removed.' });
            if (forceRerender) forceRerender();
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete.' });
        }
    };

    const handleEdit = (log: DailyPosting) => {
        setEditingLog(log);
        setPlatform(log.platform);
        setActivityType(log.activityType);
        setDescription(log.description);
        setLink(log.link || '');
        setPostedAt(format(new Date(log.postedAt), "yyyy-MM-dd'T'HH:mm"));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditingLog(null);
        setDescription('');
        setLink('');
        setPostedAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        setScreenshotFile(null);
    };

    return (
        <div className="space-y-6 p-1">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        <Video className="h-10 w-10 text-teal-600" />
                        Log Daily Social Posting
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Record your activities to keep the team updated on reach and engagement.</p>
                </div>
            </div>

            <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/50 border-b py-4">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">
                        {editingLog ? 'Edit Posting Log' : 'Log New Activity'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Platform</Label>
                                    <Select value={platform} onValueChange={setPlatform}>
                                        <SelectTrigger className="h-11 rounded-2xl border-slate-200 font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Instagram" className="font-bold">Instagram</SelectItem>
                                            <SelectItem value="Facebook" className="font-bold">Facebook</SelectItem>
                                            <SelectItem value="WhatsApp" className="font-bold">WhatsApp</SelectItem>
                                            <SelectItem value="TikTok" className="font-bold">TikTok</SelectItem>
                                            <SelectItem value="Other" className="font-bold">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Activity Type</Label>
                                    <Select value={activityType} onValueChange={setActivityType}>
                                        <SelectTrigger className="h-11 rounded-2xl border-slate-200 font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Post" className="font-bold">Post</SelectItem>
                                            <SelectItem value="Story" className="font-bold">Story</SelectItem>
                                            <SelectItem value="Reel" className="font-bold">Reel</SelectItem>
                                            <SelectItem value="Video" className="font-bold">Video</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Content Description / Video Topic</Label>
                                <Textarea
                                    placeholder="Briefly describe what was posted today..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="rounded-2xl border-slate-200 resize-none min-h-[100px] font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Post Link (Optional)</Label>
                                <Input
                                    placeholder="https://..."
                                    value={link}
                                    onChange={(e) => setLink(e.target.value)}
                                    className="h-11 rounded-2xl border-slate-200 font-bold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Posting Date & Time</Label>
                                <Input
                                    type="datetime-local"
                                    value={postedAt}
                                    onChange={(e) => setPostedAt(e.target.value)}
                                    className="h-11 rounded-2xl border-slate-200 font-bold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                                    {editingLog?.screenshotUrl ? 'Update Screenshot / Proof (Optional)' : 'Screenshot / Proof (Optional)'}
                                </Label>
                                <div className="flex items-center gap-3">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                                        className="h-11 rounded-2xl border-slate-200 font-bold py-2 px-3"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-2 justify-end pt-2">
                                {editingLog && (
                                    <Button variant="ghost" onClick={resetForm} className="rounded-2xl font-black text-slate-400">Cancel</Button>
                                )}
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-2xl px-10 font-bold h-11 shadow-lg shadow-teal-100 transition-all active:scale-95"
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    {editingLog ? 'Update Log' : 'Log Activity'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/50 border-b py-4">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                        <History className="h-4 w-4 text-teal-600" />
                        Recent Posting History
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/30 hover:bg-slate-50/30">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest p-4">Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest p-4">Platform</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest p-4">Type</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest p-4">Description</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest p-4">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-teal-600" />
                                    </TableCell>
                                </TableRow>
                            ) : postings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                        No activities logged yet.
                                    </TableCell>
                                </TableRow>
                            ) : postings.map((post) => {
                                const Icon = PLATFORM_ICONS[post.platform as keyof typeof PLATFORM_ICONS] || PLATFORM_ICONS.Other;
                                return (
                                    <TableRow key={post.id} className="hover:bg-slate-50/50 group">
                                        <TableCell className="p-4 whitespace-nowrap text-[11px] font-black text-slate-500">
                                            {post.postedAt ? format(new Date(post.postedAt), 'MMM dd, HH:mm') : '---'}
                                        </TableCell>
                                        <TableCell className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-white border border-transparent group-hover:border-slate-100 transition-all">
                                                    <Icon className="h-4 w-4 text-slate-600" />
                                                </div>
                                                <span className="text-[11px] font-bold text-slate-700">{post.platform}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-4">
                                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 rounded-full text-slate-500">
                                                {post.activityType}
                                            </span>
                                        </TableCell>
                                        <TableCell className="p-4">
                                            <p className="text-[11px] font-bold text-slate-600 line-clamp-1 max-w-[200px]">{post.description}</p>
                                        </TableCell>
                                        <TableCell className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-teal-600 hover:bg-teal-50"
                                                    onClick={() => setViewingLog(post)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                                    onClick={() => handleEdit(post)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                                                    onClick={() => handleDelete(post.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* VIEW LOG DIALOG */}
            <Dialog open={!!viewingLog} onOpenChange={() => setViewingLog(null)}>
                <DialogContent className="max-w-2xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                    {viewingLog && (
                        <div className="flex flex-col">
                            {viewingLog.screenshotUrl ? (
                                <div className="h-64 sm:h-80 w-full overflow-hidden relative group bg-black">
                                    <img 
                                        src={viewingLog.screenshotUrl} 
                                        alt="Proof" 
                                        className="w-full h-full object-cover opacity-90"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-8">
                                        <Badge className="w-fit mb-2 bg-teal-600 text-[10px] font-black uppercase tracking-widest">PROVED ACTIVITY</Badge>
                                        <DialogTitle className="text-white text-2xl font-black">{viewingLog.platform} {viewingLog.activityType}</DialogTitle>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-32 w-full bg-slate-900 flex flex-col justify-center p-8">
                                    <Badge className="w-fit mb-2 bg-slate-700 text-[10px] font-black uppercase tracking-widest">TEXT LOG ONLY</Badge>
                                    <DialogTitle className="text-white text-2xl font-black">{viewingLog.platform} {viewingLog.activityType}</DialogTitle>
                                </div>
                            )}

                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posted At</p>
                                        <p className="font-bold text-slate-800">{format(new Date(viewingLog.postedAt), 'MMMM dd, yyyy · hh:mm a')}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link Provided</p>
                                        {viewingLog.link ? (
                                            <a 
                                                href={viewingLog.link.startsWith('http') ? viewingLog.link : `https://${viewingLog.link}`} 
                                                target="_blank" 
                                                className="font-bold text-teal-600 flex items-center gap-1.5 hover:underline"
                                            >
                                                External Link <ExternalLink className="h-3 w-3" />
                                            </a>
                                        ) : (
                                            <p className="font-bold text-slate-400">Not specified</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1 pb-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity Description</p>
                                    <p className="font-medium text-slate-600 leading-relaxed text-sm p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        {viewingLog.description}
                                    </p>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button 
                                        variant="outline" 
                                        className="rounded-2xl border-slate-200 font-black px-6 hover:bg-slate-50"
                                        onClick={() => setViewingLog(null)}
                                    >
                                        Close Details
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
