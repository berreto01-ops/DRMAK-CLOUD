'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, updateDoc, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { safeFormat } from '@/lib/safe-date';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Printer, CheckCircle2, Clock, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PrescriptionPreview } from '@/components/PrescriptionPreview';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Eye, History, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/firebase';

function formatWhatsAppPhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
  return `+${digits}`;
}


export default function PrintPrescriptionPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const isOpsManager = user?.role === 'Operations Manager' || user?.role === 'Admin';

  const [view, setView] = React.useState<'pending' | 'history'>('pending');

  // Query all prescriptions that are Pending print
  const pendingQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'prescriptions'), where('printStatus', '==', 'Pending'));
  }, [firestore]);

  // Query last 100 printed prescriptions for history
  const historyQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'prescriptions'), where('printStatus', '==', 'Printed'));
  }, [firestore]);

  const { toast } = useToast();
  const { data: rawPendingJobs, isLoading: pendingLoading } = useCollection(pendingQuery);
  const { data: rawHistoryJobs, isLoading: historyLoading } = useCollection(historyQuery);

  const doctorsRef = useMemoFirebase(() => firestore ? collection(firestore, 'doctors') : null, [firestore]);
  const { data: doctors } = useCollection(doctorsRef);

  const sortJobs = (jobs: any[] | null) => {
    if (!jobs) return [];
    return [...jobs].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  };

  const pendingJobs = React.useMemo(() => sortJobs(rawPendingJobs), [rawPendingJobs]);
  const historyJobs = React.useMemo(() => sortJobs(rawHistoryJobs), [rawHistoryJobs]);

  const [printingJob, setPrintingJob] = React.useState<any | null>(null);
  const [viewingJob, setViewingJob] = React.useState<any | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  // WhatsApp prescription sharing
  const [whatsappJob, setWhatsappJob] = React.useState<any | null>(null);
  const [whatsappLoadingId, setWhatsappLoadingId] = React.useState<string | null>(null);
  const whatsappPreviewRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!whatsappJob || !whatsappPreviewRef.current) return;

    const captureAndSend = async () => {
      try {
        // Wait for fonts/images to render inside the preview
        await new Promise(r => setTimeout(r, 800));

        const html2canvas = (await import('html2canvas')).default;
        const el = whatsappPreviewRef.current!;
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: el.scrollWidth,
          height: el.scrollHeight,
          windowWidth: el.scrollWidth,
          windowHeight: el.scrollHeight,
        });

        // Capture as PNG (required for clipboard API)
        const pngBlob = await new Promise<Blob>(resolve =>
          canvas.toBlob(b => resolve(b!), 'image/png')
        );

        const phone = formatWhatsAppPhone(whatsappJob.patientMobile);

        // Try to copy the prescription image to clipboard so staff can Ctrl+V in WhatsApp
        let clipboardOk = false;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
          ]);
          clipboardOk = true;
        } catch {
          // Clipboard API unavailable or denied — fall back to download
        }

        if (clipboardOk) {
          window.open(`https://wa.me/${phone}`, '_blank');
          toast({
            title: 'Prescription Copied!',
            description: 'WhatsApp is opening — press Ctrl+V in the chat to paste and send the prescription image.',
          });
        } else {
          // Fallback: download + open WhatsApp with phone pre-filled
          const fileName = `Prescription-${whatsappJob.patientName || 'Patient'}.png`;
          const objectUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(objectUrl);
          window.open(`https://wa.me/${phone}`, '_blank');
          toast({
            title: 'Image Downloaded',
            description: 'Prescription saved to Downloads — attach it in the WhatsApp chat that just opened.',
          });
        }
      } catch (err) {
        console.error('WhatsApp prescription error:', err);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to prepare the prescription for WhatsApp.' });
      } finally {
        setWhatsappJob(null);
        setWhatsappLoadingId(null);
      }
    };

    captureAndSend();
  }, [whatsappJob]);

  const handleWhatsApp = (job: any) => {
    if (whatsappLoadingId) return;
    setWhatsappLoadingId(job.id);
    setWhatsappJob(job);
  };

  const handlePrint = async (job: any) => {
    // 1. Close any open preview dialogs first to prevent duplicate rendering in DOM
    setIsPreviewOpen(false);
    setViewingJob(null);
    
    // 2. Set the active job for the hidden print layer
    setPrintingJob(job);
    
    // 3. Brief delay to allow the Dialog to unmount and the print layer to render
    setTimeout(async () => {
      window.print();
      
      // Mark as printed
      if (firestore && job.id) {
        try {
          await updateDoc(doc(firestore, 'prescriptions', job.id), {
            printStatus: 'Printed'
          });
          toast({ title: 'Marked as Printed', description: 'The prescription has been cleared from the queue.' });
        } catch (error) {
          console.error("Failed to update print status:", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Printed, but failed to clear from queue.' });
        }
      }
      
      // Clear print job from state after printing dialog closes
      setTimeout(() => setPrintingJob(null), 1000);
    }, 500); // Increased delay for cleaner unmounting
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight dark:text-white">Print Queue</h1>
        <p className="text-slate-500 mt-1">Manage and print E-Prescriptions sent by doctors.</p>
      </div>

      <Tabs value={view} onValueChange={(v: any) => setView(v)} className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 bg-slate-100/50 p-1 rounded-xl">
          <TabsTrigger value="pending" className="rounded-lg font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
            <Clock className="w-4 h-4 mr-2" />
            Pending Queue ({pendingJobs.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
            <History className="w-4 h-4 mr-2" />
            Print History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-800 tracking-tight">Active Queue</CardTitle>
                  <CardDescription className="text-slate-500 font-medium">Prescriptions waiting for physical dispatch.</CardDescription>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6 px-8">Date & Time</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6">Patient Details</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6">Medical Professional</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6">Priority</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6 text-right px-8">Operational Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-24">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 opacity-20" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-tighter">Syncing Queue...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : pendingJobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-24">
                          <div className="flex flex-col items-center gap-4">
                            <div className="p-6 bg-emerald-50 rounded-full">
                              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xl font-black text-slate-800">Queue is Clear</p>
                              <p className="text-sm text-slate-500 font-medium">All clinical prescriptions have been processed.</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingJobs.map((job) => (
                        <TableRow key={job.id} className="group hover:bg-slate-50/50 transition-colors">
                          <TableCell className="px-8">
                            <div className="text-sm font-bold text-slate-900">{safeFormat(job.createdAt, 'dd MMM yyyy')}</div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{safeFormat(job.createdAt, 'hh:mm a')}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-black text-slate-900 text-base leading-tight tracking-tight">{job.patientName}</div>
                            <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">{job.patientMobile}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-bold text-slate-700">{job.doctorName}</div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Attending Physician</div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100">
                              <Clock className="w-3.5 h-3.5" />
                              Immediate
                            </span>
                          </TableCell>
                          <TableCell className="text-right px-8">
                            <div className="flex justify-end gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 border-indigo-100 hover:bg-indigo-50 text-indigo-700 font-black text-[10px] uppercase tracking-widest rounded-xl px-4 transition-all"
                                onClick={() => {
                                  setViewingJob(job);
                                  setIsPreviewOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Show Prescription
                              </Button>
                              {isOpsManager && job.patientMobile && (
                                <Button
                                  size="sm"
                                  disabled={whatsappLoadingId === job.id}
                                  className="h-10 bg-[#25D366] hover:bg-[#1ebe5d] font-black text-[10px] uppercase tracking-widest rounded-xl px-4 text-white shadow-lg shadow-green-200 transition-all active:scale-95 disabled:opacity-70"
                                  onClick={() => handleWhatsApp(job)}
                                >
                                  {whatsappLoadingId === job.id
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Preparing...</>
                                    : <><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</>}
                                </Button>
                              )}
                              <Button
                                onClick={() => handlePrint(job)}
                                size="sm"
                                className="h-10 bg-indigo-600 hover:bg-indigo-700 font-black text-[10px] uppercase tracking-widest rounded-xl px-6 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                              >
                                <Printer className="w-4 h-4 mr-2" />
                                Print Now
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-800 tracking-tight">Print History</CardTitle>
                  <CardDescription className="text-slate-500 font-medium">Recently processed and printed medical records.</CardDescription>
                </div>
                <div className="p-3 bg-indigo-50 rounded-2xl">
                  <History className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6 px-8">Print Date</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6">Patient</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6">Physician</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6">Status</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6 text-right px-8">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-24">
                          <Loader2 className="h-10 w-10 animate-spin text-slate-300 mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : historyJobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-24 text-slate-400 font-bold uppercase tracking-widest text-xs">
                          No print history available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      historyJobs.map((job) => (
                        <TableRow key={job.id} className="group hover:bg-slate-50/50 transition-colors">
                          <TableCell className="px-8">
                            <div className="text-sm font-bold text-slate-900">{safeFormat(job.createdAt, 'dd MMM yyyy')}</div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{safeFormat(job.createdAt, 'hh:mm a')}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-black text-slate-900 text-base leading-tight tracking-tight">{job.patientName}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-bold text-slate-700">{job.doctorName}</div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Dispatched
                            </span>
                          </TableCell>
                          <TableCell className="text-right px-8">
                            <div className="flex justify-end gap-3">
                            {isOpsManager && job.patientMobile && (
                              <Button
                                size="sm"
                                disabled={whatsappLoadingId === job.id}
                                className="h-9 bg-[#25D366] hover:bg-[#1ebe5d] font-black text-[10px] uppercase tracking-widest rounded-xl px-4 text-white shadow-md shadow-green-200 transition-all active:scale-95 disabled:opacity-70"
                                onClick={() => handleWhatsApp(job)}
                              >
                                {whatsappLoadingId === job.id
                                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Preparing...</>
                                  : <><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</>}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl"
                              onClick={() => {
                                setViewingJob(job);
                                setIsPreviewOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Copy
                            </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* VIEW DIALOG */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-100 p-0 border-none">
          <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b p-4 flex justify-between items-center">
            <DialogTitle className="text-xl font-bold">Prescription Preview</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
              <Button 
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => {
                  if (viewingJob) {
                    handlePrint(viewingJob);
                    setIsPreviewOpen(false);
                  }
                }}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Now
              </Button>
            </div>
          </div>
          
          <div className="p-8 flex justify-center">
            {viewingJob && (() => {
              // Enhanced Lookup Logic: Try ID first, then Name
              const docProfile = doctors?.find(d => 
                d.id === viewingJob.doctorId || 
                d.name?.toLowerCase().includes(viewingJob.doctorName?.toLowerCase())
              );
              
              const templateUrl = viewingJob.prescriptionTemplateUrl || (docProfile?.useCustomPrescription ? docProfile.prescriptionTemplateUrl : undefined);
              const shouldHideBranding = viewingJob.hideBranding !== undefined ? viewingJob.hideBranding : false;

              return (
                <div className="shadow-2xl">
                  <PrescriptionPreview
                    doctorName={viewingJob.doctorName || ''}
                    doctorQualification={viewingJob.doctorQualification || ''}
                    doctorSpecialization={viewingJob.doctorSpecialization || ''}
                    patient={viewingJob.patient || { name: viewingJob.patientName, mobileNumber: viewingJob.patientMobile, age: '', gender: '' }}
                    chiefComplaint={viewingJob.chiefComplaint || ''}
                    examination={viewingJob.examination || ''}
                    diagnosis={viewingJob.diagnosis || ''}
                    medicines={viewingJob.medicines || []}
                    procedure={viewingJob.procedure || ''}
                    advice={viewingJob.advice || ''}
                    followUpDates={viewingJob.followUp || []}
                    allergies={viewingJob.allergies || ''}
                    coMorbids={viewingJob.coMorbids || ''}
                    today={safeFormat(viewingJob.createdAt, 'dd MMMM yyyy', format(new Date(), 'dd MMMM yyyy'))}
                    prescriptionTemplateUrl={templateUrl}
                    hideBranding={shouldHideBranding}
                    prescriptionAge={viewingJob.prescriptionAge}
                    prescriptionGender={viewingJob.prescriptionGender}
                    investigations={viewingJob.investigations || ''}
                  />
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* HIDDEN PRINT LAYER - Portaled to body for total isolation */}
      {printingJob && typeof document !== 'undefined' && require('react-dom').createPortal(
        (() => {
          // Robust fallback for the actual print engine too
          const docProfile = doctors?.find(d => 
            d.id === printingJob.doctorId || 
            d.name?.toLowerCase().includes(printingJob.doctorName?.toLowerCase())
          );
          const templateUrl = printingJob.prescriptionTemplateUrl || (docProfile?.useCustomPrescription ? docProfile.prescriptionTemplateUrl : undefined);
          const shouldHideBranding = printingJob.hideBranding !== undefined ? printingJob.hideBranding : false;

          return (
            <div className="hidden print:block prescription-print-active">
              <PrescriptionPreview
                doctorName={printingJob.doctorName || ''}
                doctorQualification={printingJob.doctorQualification || ''}
                doctorSpecialization={printingJob.doctorSpecialization || ''}
                patient={printingJob.patient || { name: printingJob.patientName, mobileNumber: printingJob.patientMobile, age: '', gender: '' }}
                chiefComplaint={printingJob.chiefComplaint || ''}
                examination={printingJob.examination || ''}
                diagnosis={printingJob.diagnosis || ''}
                medicines={printingJob.medicines || []}
                procedure={printingJob.procedure || ''}
                advice={printingJob.advice || ''}
                followUpDates={printingJob.followUp || []}
                allergies={printingJob.allergies || ''}
                coMorbids={printingJob.coMorbids || ''}
                today={safeFormat(printingJob.createdAt, 'dd MMMM yyyy', format(new Date(), 'dd MMMM yyyy'))}
                prescriptionTemplateUrl={templateUrl}
                hideBranding={shouldHideBranding}
                prescriptionAge={printingJob.prescriptionAge}
                prescriptionGender={printingJob.prescriptionGender}
                investigations={printingJob.investigations || ''}
              />
            </div>
          );
        })(),
        document.body
      )}

      {/* OFF-SCREEN WHATSAPP CAPTURE LAYER */}
      {whatsappJob && (() => {
        const docProfile = doctors?.find((d: any) =>
          d.id === whatsappJob.doctorId ||
          d.name?.toLowerCase().includes(whatsappJob.doctorName?.toLowerCase())
        );
        const templateUrl = whatsappJob.prescriptionTemplateUrl || (docProfile?.useCustomPrescription ? docProfile.prescriptionTemplateUrl : undefined);
        const shouldHideBranding = whatsappJob.hideBranding !== undefined ? whatsappJob.hideBranding : false;
        return (
          <div
            ref={whatsappPreviewRef}
            style={{
              position: 'fixed',
              left: '-9999px',
              top: 0,
              width: '794px',
              backgroundColor: '#fff',
              zIndex: -1,
            }}
          >
            <PrescriptionPreview
              doctorName={whatsappJob.doctorName || ''}
              doctorQualification={whatsappJob.doctorQualification || ''}
              doctorSpecialization={whatsappJob.doctorSpecialization || ''}
              patient={whatsappJob.patient || { name: whatsappJob.patientName, mobileNumber: whatsappJob.patientMobile, age: '', gender: '' }}
              chiefComplaint={whatsappJob.chiefComplaint || ''}
              examination={whatsappJob.examination || ''}
              diagnosis={whatsappJob.diagnosis || ''}
              medicines={whatsappJob.medicines || []}
              procedure={whatsappJob.procedure || ''}
              advice={whatsappJob.advice || ''}
              followUpDates={whatsappJob.followUp || []}
              allergies={whatsappJob.allergies || ''}
              coMorbids={whatsappJob.coMorbids || ''}
              today={safeFormat(whatsappJob.createdAt, 'dd MMMM yyyy', format(new Date(), 'dd MMMM yyyy'))}
              prescriptionTemplateUrl={templateUrl}
              hideBranding={shouldHideBranding}
              prescriptionAge={whatsappJob.prescriptionAge}
              prescriptionGender={whatsappJob.prescriptionGender}
              investigations={whatsappJob.investigations || ''}
            />
          </div>
        );
      })()}
    </div>
  );
}
