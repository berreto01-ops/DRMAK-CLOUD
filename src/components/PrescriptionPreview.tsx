import React, { useState, useLayoutEffect, useRef } from 'react';
import type { Patient } from '@/lib/types';
import { format } from 'date-fns';

type Medicine = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

export interface PrescriptionPreviewProps {
  doctorName: string;
  doctorQualification: string;
  doctorSpecialization: string;
  patient: Patient | null;
  chiefComplaint: string;
  examination: string;
  diagnosis: string;
  medicines: Medicine[];
  investigations: string;
  procedure: string;
  advice: string;
  followUpDates: string[];
  allergies: string;
  coMorbids: string;
  today: string;
  hideBranding?: boolean;
  maritalStatus?: string;
  prescriptionTemplateUrl?: string;
  prescriptionAge?: string;
  prescriptionGender?: string;
}

function safeFormatDate(dateStr: string) {
  if (!dateStr) return '';
  try { 
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; 
    return format(d, 'dd MMMM yyyy'); 
  } catch { 
    return dateStr; 
  }
}

const GOLD = '#D1B057';
const INK  = '#1a1a1a';
const LIGHT_GOLD = '#fdfaf2';

const RxSymbol = () => (
  <span style={{ fontSize: '24pt', fontFamily: 'serif', color: GOLD, fontWeight: 700, marginRight: '8px', lineHeight: 1 }}>℞</span>
);

function PrintStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @media print {
        @page {
          size: A4;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
        }
        .no-print {
          display: none !important;
        }
        .prescription-print-active {
          position: absolute;
          left: 0;
          top: 0;
          width: 210mm;
          height: 296.5mm;
          margin: 0;
          padding: 0;
          visibility: visible;
          z-index: 9999;
        }
        * {
          box-sizing: border-box !important;
        }
        body > *:not(.prescription-print-active) {
          display: none !important;
        }
      }
    `}} />
  );
}

function LetterheadLayout(p: PrescriptionPreviewProps) {
  return (
    <div style={{ padding: '0', backgroundColor: '#f5f5f5', minHeight: '100%' }}>
      <div id="prescription-print" style={{ 
        width: '210mm', 
        height: '296.5mm', 
        backgroundColor: '#fff', 
        margin: '0 auto', 
        padding: '15mm 20mm',
        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        <PrintStyles />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8mm', paddingBottom: '4mm', borderBottom: `2px solid ${GOLD}` }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '18pt', fontWeight: 900, color: INK, marginBottom: '1.5mm', fontFamily: 'serif' }}>{p.doctorName}</div>
            <div style={{ fontSize: '10pt', color: '#555', fontWeight: 600, letterSpacing: '0.5px' }}>{p.doctorQualification}</div>
            <div style={{ fontSize: '9pt', color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '1mm' }}>{p.doctorSpecialization}</div>
          </div>
          <div style={{ textAlign: 'right', paddingBottom: '1mm' }}>
            <div style={{ fontSize: '9pt', color: '#999', fontWeight: 600 }}>Date</div>
            <div style={{ fontSize: '12pt', fontWeight: 800, color: INK }}>{p.today}</div>
          </div>
        </div>

        {p.patient && (
          <div style={{ 
            backgroundColor: LIGHT_GOLD,
            padding: '4mm 6mm',
            borderRadius: '2mm',
            border: `1px solid ${GOLD}30`,
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '8mm', 
            fontSize: '11pt',
            fontWeight: 800,
            color: INK
          }}>
            <div><span style={{ fontSize: '8pt', color: GOLD, textTransform: 'uppercase', marginRight: '8px', letterSpacing: '1px' }}>Name:</span>{p.patient.name}</div>
            <div><span style={{ fontSize: '8pt', color: GOLD, textTransform: 'uppercase', marginRight: '8px', letterSpacing: '1px' }}>Age:</span>{p.prescriptionAge || p.patient.age}</div>
            <div><span style={{ fontSize: '8pt', color: GOLD, textTransform: 'uppercase', marginRight: '8px', letterSpacing: '1px' }}>Sex:</span>{p.patient.gender}</div>
            <div><span style={{ fontSize: '8pt', color: GOLD, textTransform: 'uppercase', marginRight: '8px', letterSpacing: '1px' }}>Status:</span>{p.maritalStatus || p.patient.maritalStatus || '—'}</div>
          </div>
        )}

        {(p.chiefComplaint || p.examination || p.investigations || p.diagnosis) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8mm', marginBottom: '4mm' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3mm' }}>
              {p.chiefComplaint && (
                <div>
                  <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1mm' }}>Chief Complaints</div>
                  <div style={{ fontSize: '10pt', lineHeight: 1.4 }}>{p.chiefComplaint}</div>
                </div>
              )}
              {p.examination && (
                <div>
                  <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1mm' }}>Examination</div>
                  <div style={{ fontSize: '10pt', lineHeight: 1.4 }}>{p.examination}</div>
                </div>
              )}
              {p.investigations && (
                <div>
                  <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1mm' }}>Investigations</div>
                  <div style={{ fontSize: '10pt', lineHeight: 1.4 }}>{p.investigations}</div>
                </div>
              )}
            </div>
            <div>
              {p.diagnosis && (
                <div style={{ padding: '4mm', backgroundColor: '#fafafa', borderRadius: '2mm', border: '1px solid #eee' }}>
                  <div style={{ fontSize: '8pt', fontWeight: 800, textTransform: 'uppercase', color: GOLD, marginBottom: '2mm' }}>Diagnosis</div>
                  <div style={{ fontSize: '11pt', fontWeight: 700, color: INK }}>{p.diagnosis}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${GOLD}40`, paddingTop: '4mm', marginBottom: '6mm' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4mm' }}>
            <RxSymbol />
            <span style={{ fontSize: '10pt', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px' }}>Treatment Plan</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100%, 1fr))', gap: '4mm' }}>
            {p.medicines.map((med, i) => (
              <div key={med.id} style={{ padding: '3mm 4mm', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '1.5mm' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
                  <span style={{ fontSize: '11pt', fontWeight: 800, color: INK }}>{med.name}</span>
                  <span style={{ fontSize: '9pt', color: GOLD, fontWeight: 700 }}>{med.frequency}</span>
                </div>
                <div style={{ fontSize: '8.5pt', color: '#666' }}>
                  Duration: {med.duration} {med.instructions && `| Note: ${med.instructions}`}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginTop: 'auto', paddingTop: '8mm', borderTop: `1px solid ${GOLD}40` }}>
          <div>
            {p.advice && (
              <div style={{ marginBottom: '4mm' }}>
                <div style={{ fontSize: '8pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '1mm' }}>Advice</div>
                <div style={{ fontSize: '9pt', color: '#555', lineHeight: 1.4 }}>{p.advice}</div>
              </div>
            )}
            {p.procedure && (
              <div>
                <div style={{ fontSize: '8pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '1mm' }}>Procedure</div>
                <div style={{ fontSize: '9pt', color: '#555', lineHeight: 1.4 }}>{p.procedure}</div>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            {p.followUpDates.length > 0 && (
              <div style={{ marginBottom: '4mm' }}>
                <div style={{ fontSize: '8pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '1mm' }}>Follow Up</div>
                {p.followUpDates.map((date, i) => (
                  <div key={i} style={{ fontSize: '10pt', fontWeight: 700, color: INK }}>{safeFormatDate(date)}</div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '8mm' }}>
              <div style={{ borderTop: '1px solid #333', width: '50mm', marginLeft: 'auto', marginBottom: '1mm' }}></div>
              <div style={{ fontSize: '9pt', fontWeight: 700 }}>{p.doctorName}</div>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '8mm', left: '20mm', right: '20mm', fontSize: '7.5pt', color: '#999', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '4mm' }}>
          This prescription is generated electronically. In case of any emergency, please visit the nearest hospital.
        </div>
      </div>
    </div>
  );
}

function DigitalLayout(p: Omit<PrescriptionPreviewProps, 'hideBranding'>) {
  const nameToDisplay = p.doctorName.includes('Mahvish') ? 'Dr Prof. Dr Mahvish Aftab Khan' : p.doctorName;

  return (
    <div style={{ padding: '5mm', backgroundColor: '#f5f5f5', minHeight: '100%' }}>
      <div id="prescription-print" style={{ 
        width: '210mm', 
        height: '296.5mm', 
        backgroundColor: '#fff', 
        margin: '0 auto', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        <PrintStyles />
        
        <div style={{ position: 'absolute', top: 0, right: 0, width: '120mm', height: '120mm', background: `linear-gradient(135deg, ${GOLD}08 0%, transparent 80%)`, zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '120mm', height: '120mm', background: `radial-gradient(circle at bottom left, ${GOLD}05 0%, transparent 70%)`, zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '12mm 22mm 15mm 22mm', display: 'flex', flexDirection: 'column', height: '296.5mm', boxSizing: 'border-box' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '8mm' }}>
            <img src="/logo.png" alt="Clinic Logo" style={{ height: '22mm', marginBottom: '4mm', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }} />
            <div style={{ fontSize: '24pt', fontWeight: 900, color: INK, letterSpacing: '-0.5px', marginBottom: '1mm', fontFamily: 'serif' }}>{nameToDisplay}</div>
            <div style={{ fontSize: '11pt', fontWeight: 600, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>{p.doctorSpecialization}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6mm', backgroundColor: '#fafafa', padding: '5mm', borderRadius: '3mm', border: `1px solid ${GOLD}20`, marginBottom: '10mm' }}>
            <div>
              <div style={{ fontSize: '8pt', color: GOLD, fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5mm' }}>Patient Name</div>
              <div style={{ fontSize: '11pt', fontWeight: 800, color: INK }}>{p.patient?.name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '8pt', color: GOLD, fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5mm' }}>Age / Gender</div>
              <div style={{ fontSize: '11pt', fontWeight: 800, color: INK }}>{p.prescriptionAge || p.patient?.age || '—'} / {p.prescriptionGender || p.patient?.gender || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '8pt', color: GOLD, fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5mm' }}>Prescription ID</div>
              <div style={{ fontSize: '11pt', fontWeight: 800, color: INK }}>#{Math.random().toString(36).substr(2, 6).toUpperCase()}</div>
            </div>
            <div>
              <div style={{ fontSize: '8pt', color: GOLD, fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5mm' }}>Date</div>
              <div style={{ fontSize: '11pt', fontWeight: 800, color: INK }}>{p.today}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12mm', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {p.chiefComplaint && (
                <div style={{ marginBottom: '8mm' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3mm', marginBottom: '3mm' }}>
                    <div style={{ width: '8mm', height: '1px', backgroundColor: GOLD }}></div>
                    <div style={{ fontSize: '10pt', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px' }}>Chief Complaints</div>
                  </div>
                  <div style={{ fontSize: '12pt', color: INK, lineHeight: 1.6, paddingLeft: '11mm' }}>{p.chiefComplaint}</div>
                </div>
              )}

              {p.examination && (
                <div style={{ marginBottom: '8mm' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3mm', marginBottom: '3mm' }}>
                    <div style={{ width: '8mm', height: '1px', backgroundColor: GOLD }}></div>
                    <div style={{ fontSize: '10pt', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px' }}>Clinical Examination</div>
                  </div>
                  <div style={{ fontSize: '12pt', color: INK, lineHeight: 1.6, paddingLeft: '11mm' }}>{p.examination}</div>
                </div>
              )}

              <div style={{ marginTop: '4mm' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4mm', marginBottom: '6mm' }}>
                  <RxSymbol />
                  <div style={{ fontSize: '12pt', fontWeight: 900, color: INK, textTransform: 'uppercase', letterSpacing: '2px' }}>Treatment Plan</div>
                  <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${GOLD}40, transparent)` }}></div>
                </div>
                
                <div style={{ paddingLeft: '6mm' }}>
                  {p.medicines.map((med, i) => (
                    <div key={med.id} style={{ marginBottom: '6mm', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-6mm', top: '2mm', width: '2mm', height: '2mm', borderRadius: '50%', border: `1.5px solid ${GOLD}` }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5mm' }}>
                        <div style={{ fontSize: '13pt', fontWeight: 800, color: INK }}>{med.name}</div>
                        <div style={{ fontSize: '10pt', fontWeight: 700, color: GOLD, backgroundColor: LIGHT_GOLD, padding: '1mm 3mm', borderRadius: '1mm' }}>{med.frequency}</div>
                      </div>
                      <div style={{ fontSize: '10pt', color: '#666', fontStyle: 'italic' }}>
                        Duration: {med.duration} {med.instructions && `| Note: ${med.instructions}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${GOLD}20`, paddingLeft: '10mm' }}>
              {p.diagnosis && (
                <div style={{ marginBottom: '10mm', backgroundColor: LIGHT_GOLD, padding: '6mm', borderRadius: '4mm', border: `1px solid ${GOLD}20` }}>
                  <div style={{ fontSize: '9pt', color: GOLD, fontWeight: 900, textTransform: 'uppercase', marginBottom: '3mm', letterSpacing: '1px' }}>Primary Diagnosis</div>
                  <div style={{ fontSize: '13pt', fontWeight: 800, color: INK, lineHeight: 1.4 }}>{p.diagnosis}</div>
                </div>
              )}

              {p.advice && (
                <div style={{ marginBottom: '8mm' }}>
                  <div style={{ fontSize: '9pt', color: GOLD, fontWeight: 900, textTransform: 'uppercase', marginBottom: '3mm' }}>Doctor's Advice</div>
                  <div style={{ fontSize: '11pt', color: '#555', lineHeight: 1.6 }}>{p.advice}</div>
                </div>
              )}

              {p.procedure && (
                <div style={{ marginBottom: '8mm' }}>
                  <div style={{ fontSize: '9pt', color: GOLD, fontWeight: 900, textTransform: 'uppercase', marginBottom: '3mm' }}>Procedures</div>
                  <div style={{ fontSize: '11pt', color: '#555', lineHeight: 1.6 }}>{p.procedure}</div>
                </div>
              )}

              {p.followUpDates.length > 0 && (
                <div style={{ marginTop: 'auto', padding: '6mm', backgroundColor: '#fdfdfd', borderRadius: '4mm', border: '1px solid #eee' }}>
                  <div style={{ fontSize: '9pt', color: GOLD, fontWeight: 900, textTransform: 'uppercase', marginBottom: '3mm' }}>Follow Up Visit</div>
                  {p.followUpDates.map((date, i) => (
                    <div key={i} style={{ fontSize: '13pt', fontWeight: 900, color: INK }}>{safeFormatDate(date)}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '12mm', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `2px solid ${GOLD}20`, paddingTop: '6mm' }}>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: '12pt', 
                fontWeight: 900, 
                color: '#eee', 
                letterSpacing: '5px', 
                textTransform: 'uppercase', 
                marginBottom: '2mm',
                fontStyle: 'italic'
              }}>
                Not valid for court
              </div>
              <div style={{ 
                display: 'flex', 
                gap: '8mm', 
                fontSize: '9pt', 
                color: '#777',
                fontWeight: 600
              }}>
                <span>Islamabad, Pakistan</span>
                <span>+92 333 0477704</span>
                <span>skinsmith.pk</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4mm', padding: '2mm', backgroundColor: '#fff', borderRadius: '2mm', border: `1px solid ${GOLD}30` }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '8pt', color: GOLD, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>WhatsApp Us</div>
                <div style={{ fontSize: '7pt', color: '#999', fontWeight: 600 }}>Scan for Instant Contact</div>
              </div>
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://wa.me/923330477704" 
                alt="WhatsApp QR" 
                style={{ width: '16mm', height: '16mm' }} 
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function CustomTemplateLayout(p: Omit<PrescriptionPreviewProps, 'hideBranding'>) {
  const namedMeds = p.medicines.filter(m => m.name);
  const leftColRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [procedureOverflows, setProcedureOverflows] = useState(false);

  useLayoutEffect(() => {
    if (!sidebarRef.current || !p.procedure) {
      setProcedureOverflows(false);
      return;
    }
    const pageEl = sidebarRef.current.closest('#prescription-print') as HTMLElement;
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    const sidebarRect = sidebarRef.current.getBoundingClientRect();
    // 35mm footer buffer in px (1mm ≈ 3.7795px at 96dpi)
    const footerPx = 35 * 3.7795;
    setProcedureOverflows(sidebarRect.bottom > pageRect.bottom - footerPx);
  }, [p.procedure, p.allergies, p.coMorbids, p.advice, p.followUpDates]);


  return (
    <div style={{ padding: '0', backgroundColor: '#f5f5f5', minHeight: '100%' }}>
      <div id="prescription-print" style={{ 
        width: '210mm', 
        height: '296.5mm', 
        backgroundColor: '#fff', 
        margin: '0 auto', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        <PrintStyles />
        
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          zIndex: 0,
          backgroundImage: `url(${p.prescriptionTemplateUrl})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat'
        }} />

        <div style={{ 
          position: 'relative', 
          zIndex: 1, 
          paddingTop: '43mm', 
          paddingBottom: '35mm',
          paddingLeft: '16mm',
          paddingRight: '16mm',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '245mm', 
          background: 'transparent',
          color: INK
        }}>
          {/* Patient Info Row */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            height: '10mm',
            fontSize: '11pt',
            fontWeight: 800,
            marginBottom: '4mm',
            transform: 'translateY(-2mm)',
            color: INK
          }}>
            <div style={{ width: '58mm', paddingLeft: '14mm', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.patient?.name}</div>
            <div style={{ width: '38mm', paddingLeft: '12mm' }}>{p.prescriptionAge ? `${p.prescriptionAge} Y` : (p.patient?.age ? `${p.patient.age} Y` : '')}</div>
            <div style={{ width: '38mm', paddingLeft: '11mm' }}>{p.prescriptionGender || p.patient?.gender}</div>
            <div style={{ flex: 1, paddingLeft: '18mm' }}>{p.today}</div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '50mm 1fr', 
            gap: '8mm',
            flex: 1
          }}>
            {/* Left Column: Clinical Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '15mm', marginLeft: '-13mm', paddingTop: '20mm', minWidth: 0 }}>
              {p.chiefComplaint && (
                <div style={{ marginBottom: '20mm' }}>
                  <div style={{ fontSize: '9.5pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5mm' }}>Chief Complaints:</div>
                  <div style={{ fontSize: '10.5pt', lineHeight: 1.4, whiteSpace: 'pre-line', color: '#333', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{p.chiefComplaint}</div>
                </div>
              )}
              {p.examination && (
                <div style={{ marginBottom: '20mm' }}>
                  <div style={{ fontSize: '11pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5mm' }}>Examination:</div>
                  <div style={{ fontSize: '10.5pt', lineHeight: 1.4, whiteSpace: 'pre-line', color: '#333', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{p.examination}</div>
                </div>
              )}
              {p.investigations && (
                <div style={{ marginBottom: '20mm' }}>
                  <div style={{ fontSize: '11pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5mm' }}>Investigations:</div>
                  <div style={{ fontSize: '10.5pt', lineHeight: 1.4, whiteSpace: 'pre-line', color: '#333', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{p.investigations}</div>
                </div>
              )}
            </div>

            {/* Main Column */}
            <div ref={leftColRef} style={{ display: 'flex', flexDirection: 'column', paddingLeft: '8mm', marginLeft: '-35mm' }}>
              {/* Diagnosis & Treatment */}
              {p.diagnosis && (
                <div style={{ marginTop: '10mm', marginBottom: '8mm' }}>
                  <div style={{ fontSize: '18pt', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '2mm', marginLeft: '2mm' }}>Diagnosis:</div>
                  <div style={{ fontSize: '14pt', fontWeight: 900, whiteSpace: 'pre-line', color: INK, lineHeight: 1.4, marginLeft: '2mm' }}>{p.diagnosis}</div>
                </div>
              )}

              {namedMeds.length > 0 && (
                <div style={{ marginTop: '2mm', marginBottom: '8mm' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6mm', marginLeft: '2mm' }}>
                    <span style={{ fontSize: '28pt', fontWeight: 900, color: GOLD, fontFamily: 'serif', marginRight: '4mm', lineHeight: 1 }}>℞</span>
                    <span style={{ fontSize: '18pt', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px' }}>Treatment Plan</span>
                  </div>
                  <div style={{ paddingLeft: '4mm' }}>
                    {namedMeds.map((med, i) => (
                      <div key={med.id} style={{ marginBottom: '5mm', paddingBottom: '3mm' }}>
                        <div style={{ display: 'flex', gap: '4mm', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '13pt', fontWeight: 800, color: INK }}>{med.name}</div>
                          <div style={{ fontSize: '10.5pt', color: GOLD, fontWeight: 700 }}>{med.frequency}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5mm', paddingLeft: '4mm' }}>
                          <div style={{ fontSize: '9.5pt', color: '#666', fontWeight: 600 }}>Duration: {med.duration}</div>
                          {med.instructions && (
                            <div style={{ fontSize: '9.5pt', color: INK, fontStyle: 'italic', fontWeight: 500 }}>
                              <span style={{ color: GOLD, fontWeight: 800, fontStyle: 'normal' }}>Note: </span>{med.instructions}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overflow Procedures — rendered here when sidebar overflows page */}
              {procedureOverflows && p.procedure && (
                <div style={{ marginTop: '6mm', marginLeft: '2mm' }}>
                  <div style={{ fontSize: '11pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2mm' }}>Procedures:</div>
                  <div style={{ fontSize: '11pt', lineHeight: 1.6, color: INK, fontWeight: 400, paddingLeft: '4mm', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{p.procedure}</div>
                </div>
              )}

          </div> {/* Close Main Column */}
        </div> {/* Close Grid */}
        </div> {/* Close Content Wrapper */}

        {/* Secondary Group: Absolutely positioned to prevent squeezing */}
        <div ref={sidebarRef} style={{ 
          position: 'absolute',
          left: '166mm',
          top: '82mm',
          width: '30mm',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '20mm',
          textAlign: 'left',
          zIndex: 10,
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          whiteSpace: 'normal',
        }}>
          {p.allergies && (
            <div>
              <div style={{ fontSize: '11pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '1mm' }}>Allergies:</div>
              <div style={{ fontSize: '11pt', color: INK, fontWeight: 400, overflowWrap: 'break-word', wordBreak: 'break-word', lineHeight: 1.5 }}>{p.allergies}</div>
            </div>
          )}
          {p.coMorbids && (
            <div>
              <div style={{ fontSize: '11pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1mm' }}>Co-Morbids:</div>
              <div style={{ fontSize: '11pt', color: INK, fontWeight: 400, overflowWrap: 'break-word', wordBreak: 'break-word', lineHeight: 1.5 }}>{p.coMorbids}</div>
            </div>
          )}
          {p.advice && (
            <div>
              <div style={{ fontSize: '11pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2mm' }}>Special Advice:</div>
              <div style={{ fontSize: '11pt', lineHeight: 1.6, whiteSpace: 'pre-line', color: '#444', fontStyle: 'italic', fontWeight: 400 }}>{p.advice}</div>
            </div>
          )}
          {!procedureOverflows && p.procedure && (
            <div>
              <div style={{ fontSize: '11pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2mm' }}>Procedures:</div>
              <div style={{ fontSize: '11pt', lineHeight: 1.6, color: INK, fontWeight: 400 }}>{p.procedure}</div>
            </div>
          )}
          {p.followUpDates && p.followUpDates.length > 0 && (
            <div style={{ marginTop: '2mm' }}>
              <div style={{ fontSize: '12pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '2mm' }}>Follow Up:</div>
              {p.followUpDates.map((date, index) => (
                <div key={index} style={{ fontSize: '11pt', fontWeight: 400, color: INK, lineHeight: 1.5 }}>{safeFormatDate(date)}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrescriptionPreview({ hideBranding, ...rest }: PrescriptionPreviewProps) {
  if (hideBranding) return <LetterheadLayout {...rest} />;
  if (rest.prescriptionTemplateUrl) return <CustomTemplateLayout {...rest} />;
  return <DigitalLayout {...rest} />;
}
