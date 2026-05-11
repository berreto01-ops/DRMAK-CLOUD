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
import {
  Loader2,
  Sparkles,
  Camera,
  Upload,
  RefreshCw,
  Scan,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Pill,
  ChevronRight,
  Printer,
  History as HistoryIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { analyzeSkinAction } from '@/app/actions';
import type { AnalyzeSkinOutput } from '@/ai/flows/analyze-skin';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { SalesTraining } from '@/lib/types';
import { collection, orderBy, query, serverTimestamp } from 'firebase/firestore';
import Webcam from 'react-webcam';
import { cn } from '@/lib/utils';
import type { Patient } from '@/lib/types';
import { addDocumentNonBlocking } from '@/firebase';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';

interface Marker {
  x: number;
  y: number;
  width?: number;
  height?: number;
  id: string;
  diagnosis?: string;
  loading?: boolean;
}

export default function RecommendationsPage() {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AnalyzeSkinOutput | null>(null);
  const [imageBase64, setImageBase64] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'camera' | 'upload'>('upload');
  const [isLiveScanning, setIsLiveScanning] = React.useState(false);
  const [markers, setMarkers] = React.useState<Marker[]>([]);
  const webcamRef = React.useRef<Webcam>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const firestore = useFirestore();
  const trainingsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'salesTrainings'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  const { data: trainings, isLoading: trainingsLoading } = useCollection<SalesTraining>(trainingsQuery);

  const patientsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'patients');
  }, [firestore]);
  const { data: patients } = useCollection<Patient>(patientsQuery);

  const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = React.useState('');

  const historyQuery = useMemoFirebase(() => {
    if (!firestore || !selectedPatient) return null;
    return query(collection(firestore, 'skinConsultations'), orderBy('timestamp', 'desc'));
  }, [firestore, selectedPatient]);
  const { data: history } = useCollection<any>(historyQuery);
  const [selectedHistoryId, setSelectedHistoryId] = React.useState<string | null>(null);

  // Region Selection State
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState<{ x: number, y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = React.useState<{ x: number, y: number } | null>(null);

  const filteredPatients = React.useMemo(() => {
    if (!patients || !patientSearch) return [];
    const term = patientSearch.toLowerCase();
    return patients.filter(p =>
      (p.name || '').toLowerCase().includes(term) ||
      (p.mobileNumber || '').includes(term)
    );
  }, [patients, patientSearch]);

  const capture = React.useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImageBase64(imageSrc.split(',')[1]);
      setMode('upload'); // Switch to preview mode
      setMarkers([]); // Clear markers when taking a new snapshot
    }
  }, [webcamRef]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImageBase64(base64.split(',')[1]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    let currentImage = imageBase64;

    if (!currentImage && mode === 'camera') {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) {
        currentImage = imageSrc.split(',')[1];
        setImageBase64(currentImage);
      }
    }

    if (!currentImage) {
      toast({
        variant: 'destructive',
        title: 'No image',
        description: 'Please upload an image or ensure your camera is active.',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    const formattedTrainings = (trainings ?? []).map(t => ({
      title: t.title,
      content: t.content,
    }));

    try {
      const response = await analyzeSkinAction({
        imageBase64: currentImage,
        trainingData: formattedTrainings,
      });

      if (response.success && response.data) {
        setResult(response.data);
        toast({
          title: 'Analysis Complete',
          description: 'Your skin consultation results are ready.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Analysis Failed',
          description: response.error || 'Unable to analyze skin image.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred during analysis.',
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImageBase64(null);
    setResult(null);
    setMarkers([]);
    setIsLiveScanning(false);
    setSelectedPatient(null);
    setPatientSearch('');
    setSelectedHistoryId(null);
    setMode('upload');
  };

  const handleSaveConsultation = async () => {
    if (!firestore) return;
    if (!selectedPatient) {
      toast({
        variant: 'destructive',
        title: 'Patient Required',
        description: 'Please select a patient before saving the consultation.',
      });
      return;
    }

    if (!result && markers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No results to save',
        description: 'Please perform an analysis or mark spots before saving.',
      });
      return;
    }

    try {
      const consultationData = {
        patientId: selectedPatient.id || '',
        patientName: selectedPatient.name || 'Unknown',
        patientMobile: selectedPatient.mobileNumber || 'N/A',
        timestamp: serverTimestamp(),
        overallDiagnosis: result?.diagnosis || 'Spot-only analysis',
        isHumanSkin: result?.isHumanSkin ?? true,
        markers: markers.map(m => ({
          x: m.x,
          y: m.y,
          diagnosis: m.diagnosis || 'Analysis pending',
        })),
        recommendations: result?.recommendations || [],
        imageBase64: imageBase64 || null,
      };

      await addDocumentNonBlocking(collection(firestore, 'skinConsultations'), consultationData);
      
      toast({
        title: 'Consultation Saved',
        description: `Results saved for ${selectedPatient.name}`,
      });
    } catch (error) {
      console.error('Error saving consultation:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'An error occurred while saving to record.',
      });
    }
  };

  const handlePrintReport = () => {
    if (!result && markers.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        variant: 'destructive',
        title: 'Popup Blocked',
        description: 'Please allow popups to print the report.',
      });
      return;
    }

    const markerRows = markers.map((m, i) => `
      <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid #3b82f6; background: #f8fafc;">
        <div style="font-weight: bold; color: #3b82f6; margin-bottom: 4px;">SPOT #${i + 1} (X: ${m.x.toFixed(1)}%, Y: ${m.y.toFixed(1)}%)</div>
        <div style="font-style: italic;">${m.diagnosis || 'Analysis pending...'}</div>
      </div>
    `).join('');

    const recommendationRows = result?.recommendations.map((rec, i) => `
      <div style="margin-bottom: 12px;">
        <div style="font-weight: bold;">${i + 1}. ${rec.productName}</div>
        <div style="font-size: 12px; color: #64748b;">${rec.reason}</div>
      </div>
    `).join('') || '<p>No specific product recommendations for this analysis.</p>';

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Skin Consultation Report - ${selectedPatient?.name || 'Guest'}</title>
        <style>
          body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; line-height: 1.5; padding: 40px; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: 800; color: #3b82f6; margin-bottom: 5px; }
          .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f1f5f9; padding: 20px; border-radius: 12px; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
          .diagnosis { font-size: 18px; font-weight: 500; color: #0f172a; margin-bottom: 20px; }
          .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">SkinSmith AI</div>
          <div style="font-size: 14px; color: #64748b;">Dermatological Consultation Report</div>
          <div style="margin-top: 10px; font-size: 12px;">Date: ${new Date().toLocaleDateString()}</div>
        </div>

        <div class="patient-info">
          <div>
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Patient Name</div>
            <div style="font-weight: 700;">${selectedPatient?.name || 'Guest Patient'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Contact info</div>
            <div style="font-weight: 700;">${selectedPatient?.mobileNumber || 'N/A'}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Primary AI Diagnosis</div>
          <div class="diagnosis">"${result?.diagnosis || 'Spot-Specific Analysis Only'}"</div>
        </div>

        ${markers.length > 0 ? `
          <div class="section">
            <div class="section-title">Targeted Spot Analysis</div>
            ${markerRows}
          </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Suggested Treatments & Protocols</div>
          ${recommendationRows}
        </div>

        <div class="footer">
          <p><strong>Note:</strong> This AI-generated report is for informational purposes only. A final medical assessment by a certified physician is required before starting any treatment.</p>
          <p style="margin-top: 10px;">SkinSmith Clinic &copy; ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleSpotAnalyze = async (marker: Marker) => {
    let currentImage = imageBase64;

    if (!currentImage && mode === 'camera') {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) {
        currentImage = imageSrc.split(',')[1];
        setImageBase64(currentImage);
      }
    }

    if (!currentImage) return;

    // IF it's a region (cropping), extract the cropped image first
    let analysisImage = currentImage;
    if (marker.width && marker.height) {
      try {
        analysisImage = await cropImageBase64(currentImage, marker.x, marker.y, marker.width, marker.height);
      } catch (err) {
        console.error('Cropping failed:', err);
      }
    }

    setMarkers(prev => prev.map(m =>
      m.id === marker.id ? { ...m, loading: true } : m
    ));

    try {
      const formattedTrainings = (trainings ?? []).map(t => ({
        title: t.title,
        content: t.content,
      }));

      const response = await analyzeSkinAction({
        imageBase64: analysisImage,
        trainingData: formattedTrainings,
        markerPosition: marker.width ? undefined : { x: marker.x, y: marker.y }, // No marker position if it's already a crop
      });

      if (response.success && response.data) {
        setMarkers(prev => prev.map(m => 
          m.id === marker.id ? { ...m, diagnosis: response.data!.diagnosis, loading: false } : m
        ));
      } else {
        setMarkers(prev => prev.map(m => 
          m.id === marker.id ? { ...m, diagnosis: 'Analysis failed. Please try again.', loading: false } : m
        ));
      }
    } catch (error) {
      setMarkers(prev => prev.map(m => 
        m.id === marker.id ? { ...m, loading: false } : m
      ));
    }
  };

  const cropImageBase64 = (base64: string, xRel: number, yRel: number, wRel: number, hRel: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Failed to get canvas context');

        const x = (xRel / 100) * img.width;
        const y = (yRel / 100) * img.height;
        const w = (wRel / 100) * img.width;
        const h = (hRel / 100) * img.height;

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
      };
      img.onerror = reject;
      img.src = `data:image/jpeg;base64,${base64}`;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLiveScanning || loading) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Handle Click-to-Capture logic first for camera
    if (mode === 'camera' && !imageBase64) {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) {
        setImageBase64(imageSrc.split(',')[1]);
      } else {
        return;
      }
    }

    if (!imageBase64 && mode === 'upload') {
      toast({
        variant: 'destructive',
        title: 'Image Required',
        description: 'Please upload an image before selection.',
      });
      return;
    }

    setIsDragging(true);
    setDragStart({ x, y });
    setDragCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDragCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragCurrent) {
        setIsDragging(false);
        return;
    }

    const minX = Math.min(dragStart.x, dragCurrent.x);
    const minY = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragStart.x - dragCurrent.x);
    const height = Math.abs(dragStart.y - dragCurrent.y);

    // If drag is very small, treat as a point click
    const isPoint = width < 1 && height < 1;

    const newMarker: Marker = {
      id: uuidv4(),
      x: isPoint ? dragStart.x : minX,
      y: isPoint ? dragStart.y : minY,
      width: isPoint ? undefined : width,
      height: isPoint ? undefined : height,
      loading: true,
    };

    setMarkers(prev => [...prev, newMarker]);
    handleSpotAnalyze(newMarker);

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  const removeMarker = (id: string) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  // REMOVED: Auto-scanning interval as per user request to manual marking
  /*
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLiveScanning && mode === 'camera' && !loading) {
      interval = setInterval(() => {
        handleAnalyze();
      }, 7000);
    }
    return () => clearInterval(interval);
  }, [isLiveScanning, mode, loading, trainings]);
  */

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
          <Sparkles className="h-10 w-10 text-primary" />
          SkinSmith AI Skin Consultation
        </h1>
        <p className="text-muted-foreground text-lg">
          Upload a photo or use your camera to get an instant skin diagnosis and treatment suggestions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Patient Selection Card */}
        <Card className="lg:col-span-12 border-2 border-primary/10 shadow-lg mb-4">
          <CardHeader className="py-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Associate with Patient
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            {selectedPatient ? (
              <div className="flex items-center justify-between p-4 border-2 border-primary/20 rounded-xl bg-primary/5">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-xl">
                    {selectedPatient.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedPatient.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedPatient.mobileNumber}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)} className="text-muted-foreground hover:text-destructive">
                  Change Patient
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient name or mobile number..."
                  className="pl-10 h-12 text-lg rounded-xl border-2 focus-visible:ring-primary/20"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
                {patientSearch && filteredPatients.length > 0 && (
                  <div className="absolute top-14 left-0 right-0 bg-background border-2 rounded-xl shadow-2xl z-50 max-h-[300px] overflow-y-auto animate-in slide-in-from-top-2">
                    {filteredPatients.map(p => (
                      <div
                        key={p.id}
                        className="p-4 hover:bg-primary/5 cursor-pointer border-b last:border-0 transition-colors"
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearch('');
                        }}
                      >
                        <p className="font-bold">{p.name}</p>
                        <p className="text-sm text-muted-foreground">{p.mobileNumber}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Left Column: Input/Preview */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-6">
          <Card className="overflow-hidden border-2 border-primary/10 shadow-xl bg-gradient-to-b from-card to-muted/20">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  {imageBase64 ? <CheckCircle2 className="text-emerald-500" /> : <Scan className="text-primary" />}
                  {imageBase64 ? 'Image Ready' : 'Capture or Upload'}
                </CardTitle>
                <div className="flex gap-2 items-center">
                  <div className="flex bg-muted rounded-lg p-1 mr-2">
                    <Button
                      variant={!isLiveScanning ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 text-xs px-3"
                      onClick={() => setIsLiveScanning(false)}
                    >
                      Snapshot
                    </Button>
                    <Button
                      variant={isLiveScanning ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 text-xs px-3"
                      onClick={() => setIsLiveScanning(true)}
                    >
                      Spot Analysis
                    </Button>
                  </div>
                  <div className="h-6 w-px bg-border mx-1" />
                  <Button
                    variant={mode === 'camera' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8"
                    onClick={() => setMode('camera')}
                  >
                    <Camera className="mr-2 h-3.5 w-3.5" /> Camera
                  </Button>
                  <Button
                    variant={mode === 'upload' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8"
                    onClick={() => setMode('upload')}
                  >
                    <Upload className="mr-2 h-3.5 w-3.5" /> Upload
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div 
                ref={containerRef}
                className="aspect-video relative bg-slate-900 flex items-center justify-center overflow-hidden cursor-crosshair select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => isDragging && handleMouseUp()}
              >
                {mode === 'camera' && !imageBase64 ? (
                  <>
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border-[40px] border-slate-900/40 pointer-events-none">
                      <div className="w-full h-full border-2 border-dashed border-primary/50 rounded-lg animate-pulse" />
                    </div>
                    {!isLiveScanning && (
                      <Button
                        onClick={capture}
                        size="lg"
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full h-16 w-16 p-0 border-4 border-white shadow-2xl hover:scale-110 transition-transform"
                      >
                        <div className="h-12 w-12 rounded-full bg-red-500"></div>
                      </Button>
                    )}
                    {isLiveScanning && loading && (
                      <div className="absolute top-6 right-6 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-white text-xs font-bold uppercase tracking-wider">Analyzing Live...</span>
                      </div>
                    )}
                  </>
                ) : imageBase64 ? (
                  <div className="relative w-full h-full">
                    <img
                      src={`data:image/jpeg;base64,${imageBase64}`}
                      alt="Skin Preview"
                      className="w-full h-full object-contain"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-4 right-4 rounded-full"
                      onClick={() => setImageBase64(null)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-slate-400 p-12 text-center">
                    <div className="p-6 rounded-full bg-slate-800 animate-bounce">
                      <Upload className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-white">No Image Selected</p>
                      <p>Drag and drop or click the button below to upload a photo.</p>
                    </div>
                    <Button onClick={() => fileInputRef.current?.click()}>
                      Select Image
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileUpload}
                      aria-label="Upload skin image"
                    />
                  </div>
                )}
                
                {/* Markers Overlay - ONLY visible in Spot Analysis mode */}
                {isLiveScanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    {markers.map((marker) => (
                      <div
                        key={marker.id}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute flex items-center justify-center pointer-events-auto group",
                          marker.width ? "border-2 border-primary/50 rounded-lg shadow-xl" : "w-10 h-10 -ml-5 -mt-5"
                        )}
                        style={{ 
                            left: `${marker.x}%`, 
                            top: `${marker.y}%`,
                            width: marker.width ? `${marker.width}%` : undefined,
                            height: marker.height ? `${marker.height}%` : undefined,
                        }}
                      >
                        {marker.loading ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                            <div className="w-6 h-6 rounded-full border-2 border-primary animate-spin border-t-transparent bg-background/80 backdrop-blur-sm shadow-xl" />
                          </div>
                        ) : (
                          <div className="relative w-full h-full flex items-center justify-center cursor-pointer" onClick={() => handleSpotAnalyze(marker)}>
                            {/* Pulse Effect */}
                            <div className={cn(
                              "absolute inset-0 rounded-full animate-pulse opacity-40",
                              marker.diagnosis ? "bg-emerald-500" : "bg-primary",
                              marker.width && "rounded-lg"
                            )} />
                            
                            {/* Marker Icon / Frame */}
                            {!marker.width && (
                              <div className={cn(
                                "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-2xl backdrop-blur-sm",
                                marker.diagnosis 
                                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-600" 
                                  : "bg-primary/10 border-primary text-primary"
                              )}>
                                <Sparkles className="h-4 w-4" />
                              </div>
                            )}

                            {/* Inner Dot */}
                            {!marker.width && (
                              <div className={cn(
                                "absolute w-2 h-2 rounded-full border border-white shadow-sm",
                                marker.diagnosis ? "bg-emerald-500" : "bg-primary"
                              )} />
                            )}

                            {marker.width && (
                                <div className={cn(
                                    "absolute inset-0 border-2 rounded-lg opacity-40 animate-pulse",
                                    marker.diagnosis ? "border-emerald-500" : "border-primary"
                                )} />
                            )}
                          </div>
                        )}
                        
                        {marker.diagnosis && (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-slate-900/95 backdrop-blur-xl text-white p-5 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <Stethoscope className="h-3 w-3 text-emerald-400" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                  {marker.width ? 'Region Analysis' : 'Spot Diagnosis'}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed font-medium">
                              {marker.diagnosis}
                            </p>
                            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40 font-bold uppercase tracking-tighter">
                              <span>Analysis Accurate</span>
                              <div className="flex gap-1">
                                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/50" />
                                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/20" />
                              </div>
                            </div>
                            
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full mt-2 h-7 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMarkers(prev => prev.map(m => m.id === marker.id ? { ...m, diagnosis: undefined } : m));
                              }}
                            >
                            </Button>
                          </div>
                        )}

                        <button 
                          onClick={(e) => { e.stopPropagation(); removeMarker(marker.id); }}
                          className="absolute -top-1 -right-1 bg-white text-slate-900 rounded-full w-5 h-5 text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:bg-destructive hover:text-white border border-slate-200"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dragging Selection Preview */}
                {isDragging && dragStart && dragCurrent && (
                    <div 
                        className="absolute border-2 border-dashed border-primary bg-primary/10 rounded-lg pointer-events-none z-40"
                        style={{
                            left: `${Math.min(dragStart.x, dragCurrent.x)}%`,
                            top: `${Math.min(dragStart.y, dragCurrent.y)}%`,
                            width: `${Math.abs(dragStart.x - dragCurrent.x)}%`,
                            height: `${Math.abs(dragStart.y - dragCurrent.y)}%`,
                        }}
                    >
                        <div className="absolute -top-6 left-0 bg-primary text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest whitespace-nowrap">
                            Selective Crop
                        </div>
                    </div>
                )}

                
                {/* Pen Tool Visual */}
                {isLiveScanning && (
                  <div className="absolute top-4 left-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg animate-bounce border border-white/20">
                    <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
                    {mode === 'camera' && !imageBase64 ? 'LIVE PEN ACTIVE: CLICK TO MARK' : 'PEN TOOL ACTIVE: CLICK TO MARK'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              onClick={handleAnalyze}
              disabled={loading || (!imageBase64 && mode !== 'camera')}
              size="lg"
              className={cn(
                "flex-1 py-8 text-xl font-bold rounded-2xl shadow-lg transition-all",
                isLiveScanning ? "bg-primary/90 hover:bg-primary shadow-primary/10" : "shadow-primary/25"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-3 h-6 w-6" />
                  {isLiveScanning ? 'Overall AI Analysis' : 'Get AI Diagnosis'}
                </>
              )}
            </Button>
            {(result || markers.length > 0) && (
              <Button
                variant="outline"
                onClick={handlePrintReport}
                size="lg"
                className="px-8 rounded-2xl border-primary/20 hover:bg-primary/5"
              >
                <Printer className="mr-2 h-5 w-5" />
                Print Report
              </Button>
            )}
            {(result || markers.length > 0) && (
              <Button
                variant="default"
                onClick={handleSaveConsultation}
                size="lg"
                className="px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Save to Record
              </Button>
            )}
            <Button
              variant="outline"
              onClick={reset}
              size="lg"
              className="px-8 rounded-2xl"
            >
              Reset
            </Button>
            {isLiveScanning && markers.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => setMarkers([])}
                size="lg"
                className="px-8 rounded-2xl border-2 border-slate-200"
              >
                Clear Markers ({markers.length})
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          {loading ? (
            <Card className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4 border-dashed border-2">
              <div className="relative">
                <div className="h-20 w-20 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                <Stethoscope className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Consulting AI Specialist</h3>
              <p className="text-muted-foreground">We're analyzing the textures, tones, and patterns in your photo to find the best treatments.</p>
            </Card>
          ) : result ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <Card className={cn("border-primary/20 shadow-lg overflow-hidden", result && !result.isHumanSkin && "border-destructive/50")}>
                <div className={cn("bg-primary/10 p-4 border-b border-primary/10 flex items-center gap-2", result && !result.isHumanSkin && "bg-destructive/10 border-destructive/10")}>
                  {result && result.isHumanSkin ? (
                    <Stethoscope className="h-5 w-5 text-primary" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  <h3 className={cn("font-bold text-lg uppercase tracking-wider", result && !result.isHumanSkin && "text-destructive")}>
                    {result && result.isHumanSkin ? 'AI Diagnosis' : 'Validation Error'}
                  </h3>
                </div>
                <CardContent className="pt-6">
                  <p className={cn("text-lg leading-relaxed italic text-foreground/90", result && !result.isHumanSkin && "text-destructive font-medium")}>
                    "{result.diagnosis}"
                  </p>
                </CardContent>
              </Card>

              {result.isHumanSkin && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Pill className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold">Suggested Treatments</h2>
                  </div>

                  <div className="grid gap-4">
                    {result.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="group p-5 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all flex items-start gap-4 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 group-hover:scale-110 transition-all">
                          <ChevronRight className="h-8 w-8 text-primary" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="font-bold text-primary">{i + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-lg group-hover:text-primary transition-colors">{rec.productName}</h4>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {rec.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>Note:</strong> This AI diagnosis is for informational purposes only. Please consult with our physical doctors for a final medical assessment before starting any treatment.
                  </p>
                </CardContent>
              </Card>

              <Button 
                variant="outline" 
                className="w-full border-dashed"
                onClick={() => setResult(null)}
              >
                Dismiss Analysis Results
              </Button>
            </div>
          ) : (
            <Card className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-dashed border-2">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <Sparkles className="h-10 w-10 opacity-20" />
              </div>
              <h3 className="text-xl font-medium">Ready for Analysis</h3>
              <p className="max-w-[250px] mx-auto mt-2">Upload or capture an image to see results here.</p>
            </Card>
          )}
        </div>
      </div>

      {/* History Section - Full Width below */}
      {selectedPatient && history && history.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-2 border-b pb-4">
            <HistoryIcon className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Consultation History</h2>
            <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-bold">
              {history.length} Records
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((record) => (
              <Card 
                key={record.id} 
                className={cn(
                  "overflow-hidden cursor-pointer transition-all hover:border-primary/50 group",
                  selectedHistoryId === record.id && "border-2 border-primary shadow-primary/20"
                )}
                onClick={() => {
                   setSelectedHistoryId(record.id);
                   setResult({
                     isHumanSkin: record.isHumanSkin,
                     diagnosis: record.overallDiagnosis,
                     recommendations: record.recommendations
                   });
                   setMarkers(record.markers || []);
                   setImageBase64(record.imageBase64);
                }}
              >
                <div className="aspect-video relative bg-slate-100 overflow-hidden">
                  {record.imageBase64 ? (
                    <img 
                      src={`data:image/jpeg;base64,${record.imageBase64}`} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      alt="Past Consultation"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground italic text-xs">No image Preview</div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-bold">
                    {record.timestamp?.toDate ? format(record.timestamp.toDate(), 'MMM d, p') : 'Recent'}
                  </div>
                </div>
                <CardContent className="p-4">
                  <h4 className="font-bold text-sm truncate">{record.overallDiagnosis}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
                      {record.markers?.length || 0} Spots Analyzed
                    </span>
                    <ChevronRight className="h-3 w-3 text-primary ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
