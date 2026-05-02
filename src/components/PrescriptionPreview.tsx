import * as React from 'react';
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

type PrescriptionFooter = {
  disclaimer: string;
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
}

function safeFormatDate(dateStr: string) {
  if (!dateStr) return '';
  try { 
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // Return raw string if invalid but not empty
    return format(d, 'dd MMMM yyyy'); 
  } catch { 
    return dateStr; 
  }
}

const GOLD = '#D1B057';
const INK  = '#1a1a1a';
const LIGHT_GOLD = '#fdfaf2';
const BORDER_COLOR = '#e5e7eb';

const RxSymbol = () => (
  <span style={{ fontSize: '24pt', fontFamily: 'serif', color: GOLD, fontWeight: 700, marginRight: '8px', lineHeight: 1 }}>℞</span>
);

// Ultra-Elegant Lady Profile for SkinSmith (Thin Line-Art)
const preciseFace = "M15.5,10.5c-4.2,0.1-7.8,3.2-8.5,7.3c-0.1,0.5,0.1,1.1,0.5,1.4c4.1,2.8,7.9,6.7,11.2,11.3c2.4,3.3,4.1,7.2,4.8,11.2c0.2,1,1.1,1.7,2,1.7c0.2,0,0.5,0,0.7-0.1c1.1-0.3,1.8-1.5,1.5-2.6c-0.6-3.1-4.7-18.4-12.2-24.1C15,16,15,10.5,15.5,10.5z M25.4,12.5c-5.1,1-9.2,5.2-10.2,10.3c10,2,15,12,15,12s5-15,15-20c-5-2-10-2.3-15-2.3c-1.5,0-3.2,0.1-4.8,0.2c-0.1,2.1,1.8,4.1,4,4.1s4.1-1.8,4.1-4C29.6,12.6,27.5,12.4,25.4,12.5z";
const swooshHair = "M32.5,5.5c-2.1,0-4,1.8-4,4c0,2.1,1.8,4,4,4s4-1.8,4-4C36.5,7.3,34.7,5.5,32.5,5.5z M18.5,8.5c-1.1,0-2,0.9-2,2c0,1.1,0.9,2,2,2s2-0.9,2-2C20.5,9.4,19.6,8.5,18.5,8.5z";

// ─────────────────────────────────────────────────────────────────────────────
// LETTERHEAD MODE
// Prints on top of the physical SkinSmith stationery.
// The physical paper already has logo, diamonds and footer pre-printed.
// This layout is completely plain — just the prescription data, no decorations.
//
// Physical letterhead safe zones (A4 = 297mm):
//   Top    ~42mm  → pre-printed logo + top-right diamond
//   Bottom ~60mm  → pre-printed bottom-left diamonds + contact info
// ─────────────────────────────────────────────────────────────────────────────
function LetterheadLayout(p: Omit<PrescriptionPreviewProps, 'hideBranding'>) {
  const namedMeds = p.medicines.filter(m => m.name);

  return (
    <div style={{
      fontFamily: "'Arial', sans-serif",
      width: '210mm',
      height: '297mm',
      boxSizing: 'border-box',
      paddingTop: '44mm',
      paddingBottom: '62mm',
      paddingLeft: '18mm',
      paddingRight: '18mm',
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      color: INK,
      position: 'relative',
      overflow: 'hidden'
    }} className="prescription-print-container">
      <PrintStyles />

      {/* Doctor + Date row */}
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

      {/* Patient info horizontal row */}
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

      {/* 1. Chief Complaint + 2. Examination + 3. Diagnosis */}
      {(p.chiefComplaint || p.examination || p.diagnosis) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginBottom: '4mm' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3mm' }}>
            {p.chiefComplaint && (
              <div>
                <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1mm' }}>1. Chief Complaints</div>
                <div style={{ fontSize: '10pt', lineHeight: 1.4 }}>{p.chiefComplaint}</div>
              </div>
            )}
            {p.examination && (
              <div>
                <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1mm' }}>2. Examination</div>
                <div style={{ fontSize: '10pt', lineHeight: 1.4 }}>{p.examination}</div>
              </div>
            )}
          </div>
          <div>
            {p.diagnosis && (
              <div>
                <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1mm' }}>3. Diagnosis</div>
                <div style={{ fontSize: '10.5pt', lineHeight: 1.4, fontWeight: 700 }}>{p.diagnosis}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Treatment (Medicines) */}
      <div style={{ marginBottom: '8mm' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4mm' }}>
          <RxSymbol />
          <div style={{ fontSize: '10pt', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px' }}>4. Treatment Plan</div>
        </div>
        <div style={{ paddingLeft: '2mm' }}>
          {namedMeds.length === 0 && <div style={{ fontSize: '10pt', color: '#ccc', fontStyle: 'italic' }}>No medication prescribed.</div>}
          {namedMeds.map((med, i) => (
            <div key={med.id} style={{ marginBottom: '5mm', paddingBottom: '3mm', borderBottom: i < namedMeds.length - 1 ? '1px dashed #eee' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: '13pt', fontWeight: 800, color: INK }}>{i + 1}. {med.name}</div>
                <div style={{ fontSize: '10.5pt', color: GOLD, fontWeight: 700 }}>{med.dosage} — {med.frequency}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1mm', paddingLeft: '4mm' }}>
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

      {/* 5. Advice + 6. Procedure */}
      {(p.advice || p.procedure) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginBottom: '4mm', borderTop: '0.5px solid #eee', paddingTop: '3mm' }}>
          {p.advice && (
            <div>
              <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1mm' }}>5. Advice</div>
              <div style={{ fontSize: '9.5pt', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{p.advice}</div>
            </div>
          )}
          {p.procedure && (
            <div>
              <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1mm' }}>6. Procedure</div>
              <div style={{ fontSize: '9.5pt', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{p.procedure}</div>
            </div>
          )}
        </div>
      )}

      {/* 7. Follow up */}
      {p.followUpDates.length > 0 && (
        <div style={{ marginBottom: '4mm', borderTop: '0.5px solid #eee', paddingTop: '3mm' }}>
          <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1.5mm' }}>7. Follow-up</div>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {p.followUpDates.map(d => <span key={d} style={{ fontSize: '10pt', fontWeight: 700 }}>• {safeFormatDate(d)}</span>)}
          </div>
        </div>
      )}

      {/* 8. Allergies + 9. Co-Morbids */}
      {(p.allergies || p.coMorbids) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginBottom: '4mm', borderTop: '0.5px solid #eee', paddingTop: '3mm' }}>
          {p.allergies && (
            <div>
              <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1mm' }}>8. Allergies</div>
              <div style={{ fontSize: '9pt', color: '#d32f2f', fontWeight: 600 }}>{p.allergies}</div>
            </div>
          )}
          {p.coMorbids && (
            <div>
              <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#333', marginBottom: '1mm' }}>9. Co-Morbids</div>
              <div style={{ fontSize: '9pt', color: '#555' }}>{p.coMorbids}</div>
            </div>
          )}
        </div>
      )}

      {/* Push footer to bottom */}
      <div style={{ flex: 1 }} />

      {/* Footer Disclaimer */}
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderTop: '0.6px solid #ccc',
        paddingTop: '4mm',
        marginTop: 'auto'
      }}>
        <div style={{ fontSize: '10pt', fontWeight: 800, color: '#aaa', fontStyle: 'italic' }}>
          Not valid for court
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '7pt', color: GOLD, fontWeight: 800, textTransform: 'uppercase' }}>WhatsApp</div>
            <div style={{ fontSize: '6pt', color: '#999' }}>03330477704</div>
          </div>
          <img 
            src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://wa.me/923330477704" 
            alt="WhatsApp" 
            style={{ width: '12mm', height: '12mm' }} 
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIGITAL / BRANDED MODE
// Full SkinSmith branded prescription for digital printing or screen preview.
// Corner motifs are kept BEHIND all content via z-index layering.
// ─────────────────────────────────────────────────────────────────────────────
function DigitalLayout(p: Omit<PrescriptionPreviewProps, 'hideBranding'>) {
  const nameToDisplay = p.doctorName.includes('Mahvish') ? 'Dr Prof. Dr Mahvish Aftab Khan' : p.doctorName;

  return (
    <div style={{ padding: '5mm', backgroundColor: '#f5f5f5', minHeight: '100%' }}>
      <div id="prescription-print" style={{ 
        width: '210mm', 
        minHeight: '297mm', 
        backgroundColor: '#fff', 
        margin: '0 auto', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        <PrintStyles />
        
        {/* ── Decorative Background elements ── */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '120mm', height: '120mm', background: `linear-gradient(135deg, ${GOLD}08 0%, transparent 80%)`, zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '120mm', height: '120mm', background: `radial-gradient(circle at bottom left, ${GOLD}05 0%, transparent 70%)`, zIndex: 0 }} />

        {/* ── Main Content Container ── */}
        <div style={{ position: 'relative', zIndex: 1, padding: '15mm 22mm', display: 'flex', flexDirection: 'column', minHeight: '297mm' }}>
          
          {/* Header: Centered Luxury ── */}
          <div style={{ textAlign: 'center', marginBottom: '10mm', borderBottom: `3px double ${GOLD}`, paddingBottom: '6mm' }}>
            <div style={{ fontSize: '24pt', fontWeight: 900, color: INK, marginBottom: '2mm', letterSpacing: '0.5px', fontFamily: 'serif' }}>
              {p.doctorName}
            </div>
            <div style={{ fontSize: '11pt', color: '#444', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '1.5mm' }}>
              {p.doctorQualification}
            </div>
            <div style={{ fontSize: '10pt', color: GOLD, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2.5px' }}>
              {p.doctorSpecialization}
            </div>
            <div style={{ fontSize: '10pt', color: '#999', marginTop: '4mm', fontWeight: 600 }}>
              {p.today}
            </div>
          </div>

          {/* Patient Info Card ── */}
          {p.patient && (
            <div style={{ 
              backgroundColor: LIGHT_GOLD, 
              padding: '6mm 8mm', 
              borderRadius: '3mm', 
              border: `1.5px solid ${GOLD}20`,
              display: 'grid', 
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr', 
              gap: '6mm',
              marginBottom: '10mm',
              boxShadow: '0 4px 20px rgba(209, 176, 87, 0.08)'
            }}>
              <div>
                <div style={{ fontSize: '8pt', color: GOLD, textTransform: 'uppercase', marginBottom: '1mm', fontWeight: 800, letterSpacing: '1px' }}>Patient Name</div>
                <div style={{ fontSize: '12pt', fontWeight: 800, color: INK }}>{p.patient.name}</div>
              </div>
              <div>
                <div style={{ fontSize: '8pt', color: GOLD, textTransform: 'uppercase', marginBottom: '1mm', fontWeight: 800, letterSpacing: '1px' }}>Age / Sex</div>
                <div style={{ fontSize: '12pt', fontWeight: 800, color: INK }}>{p.prescriptionAge || p.patient.age} Y / {p.patient.gender}</div>
              </div>
              <div>
                <div style={{ fontSize: '8pt', color: GOLD, textTransform: 'uppercase', marginBottom: '1mm', fontWeight: 800, letterSpacing: '1px' }}>Status</div>
                <div style={{ fontSize: '12pt', fontWeight: 800, color: INK }}>{p.maritalStatus || p.patient.maritalStatus || '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '8pt', color: GOLD, textTransform: 'uppercase', marginBottom: '1mm', fontWeight: 800, letterSpacing: '1px' }}>Mobile</div>
                <div style={{ fontSize: '11pt', fontWeight: 800, color: INK }}>{p.patient.mobileNumber}</div>
              </div>
            </div>
          )}

          {/* Clinical Info Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12mm', marginBottom: '8mm' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6mm' }}>
              {p.chiefComplaint && (
                <div style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: '4mm' }}>
                  <div style={{ fontSize: '9pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '1.5mm', letterSpacing: '1px' }}>1. Chief Complaints</div>
                  <div style={{ fontSize: '10.5pt', lineHeight: 1.5, color: '#333', fontWeight: 500 }}>{p.chiefComplaint}</div>
                </div>
              )}
              {p.examination && (
                <div style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: '4mm' }}>
                  <div style={{ fontSize: '9pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '1.5mm', letterSpacing: '1px' }}>2. Examination</div>
                  <div style={{ fontSize: '10.5pt', lineHeight: 1.5, color: '#333', fontWeight: 500 }}>{p.examination}</div>
                </div>
              )}
            </div>
            <div>
              {p.diagnosis && (
                <div style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: '4mm' }}>
                  <div style={{ fontSize: '9pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '1.5mm', letterSpacing: '1px' }}>3. Diagnosis</div>
                  <div style={{ fontSize: '13pt', fontWeight: 800, lineHeight: 1.4, color: INK }}>{p.diagnosis}</div>
                </div>
              )}
            </div>
          </div>

          {/* Treatment Plan (Rx) ── */}
          <div style={{ marginBottom: '10mm', padding: '6mm', backgroundColor: '#fafafa', borderRadius: '4mm', border: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4mm' }}>
              <RxSymbol />
              <div style={{ fontSize: '10pt', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px' }}>4. Treatment Plan (Medications)</div>
            </div>
            <div style={{ paddingLeft: '2mm' }}>
              {p.medicines.filter(m => m.name).map((med, i) => (
                <div key={med.id} style={{ marginBottom: '5mm', paddingBottom: '4mm', borderBottom: i < p.medicines.filter(m => m.name).length - 1 ? '1px dashed #ddd' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: '14pt', fontWeight: 800, color: INK }}>{i + 1}. {med.name}</div>
                    <div style={{ fontSize: '11pt', color: GOLD, fontWeight: 700 }}>{med.dosage} — {med.frequency}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5mm', paddingLeft: '4mm' }}>
                    <div style={{ fontSize: '10pt', color: '#666', fontWeight: 600 }}>Duration: {med.duration}</div>
                    {med.instructions && (
                      <div style={{ fontSize: '9.5pt', color: INK, fontStyle: 'italic', fontWeight: 500 }}>
                        <span style={{ color: GOLD, fontWeight: 800, fontStyle: 'normal' }}>Instructions: </span>{med.instructions}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Sections ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12mm', marginBottom: '8mm' }}>
            {p.advice && (
              <div>
                <div style={{ fontSize: '9pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '2mm', letterSpacing: '1px' }}>5. Special Advice</div>
                <div style={{ fontSize: '10.5pt', color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.advice}</div>
              </div>
            )}
            {p.procedure && (
              <div>
                <div style={{ fontSize: '9pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '2mm', letterSpacing: '1px' }}>6. Recommended Procedure</div>
                <div style={{ fontSize: '10.5pt', color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.procedure}</div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12mm', marginTop: 'auto' }}>
            {p.followUpDates.length > 0 && (
              <div>
                <div style={{ fontSize: '9pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginBottom: '2.5mm' }}>7. Follow-up Appointments</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {p.followUpDates.map(d => (
                    <div key={d} style={{ fontSize: '11pt', fontWeight: 800, color: INK, backgroundColor: LIGHT_GOLD, padding: '2mm 4mm', borderRadius: '2mm', border: `1px solid ${GOLD}40` }}>
                      • {safeFormatDate(d)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6mm' }}>
              {p.allergies && (
                <div style={{ backgroundColor: '#fff5f5', padding: '4mm 5mm', borderRadius: '2mm', borderLeft: '4px solid #f56565' }}>
                  <div style={{ fontSize: '8.5pt', fontWeight: 800, color: '#c53030', textTransform: 'uppercase', marginBottom: '1mm' }}>8. Known Allergies</div>
                  <div style={{ fontSize: '11pt', color: '#c53030', fontWeight: 700 }}>{p.allergies}</div>
                </div>
              )}
              {p.coMorbids && (
                <div style={{ backgroundColor: '#f7fafc', padding: '4mm 5mm', borderRadius: '2mm', borderLeft: '4px solid #4a5568' }}>
                  <div style={{ fontSize: '8.5pt', fontWeight: 800, color: '#2d3748', textTransform: 'uppercase', marginBottom: '1mm' }}>9. Co-Morbids</div>
                  <div style={{ fontSize: '11pt', color: '#4a5568', fontWeight: 600 }}>{p.coMorbids}</div>
                </div>
              )}
            </div>
          </div>

          {/* Legal & Contact Footer ── */}
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

// ─────────────────────────────────────────────────────────────────────────────
// PRINT STYLES & EXPORT
// ─────────────────────────────────────────────────────────────────────────────
function PrintStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @media print {
        @page {
          size: A4;
          margin: 0 !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 210mm !important;
          height: 297mm !important;
          overflow: hidden !important;
          -webkit-print-color-adjust: exact;
        }
        .prescription-print-container {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 210mm !important;
          height: 297mm !important;
          margin: 0 !important;
          padding-top: 44mm; /* Restore padding for LetterheadLayout if needed, but DigitalLayout has its own */
          background: white !important;
          z-index: 99999 !important;
          page-break-after: avoid !important;
          page-break-before: avoid !important;
        }
        /* Specific adjustments for DigitalLayout which handles its own padding */
        .prescription-print-container.digital-mode {
          padding-top: 0 !important;
        }
        /* Ensure anything outside the print container is hidden */
        #root, .main-layout, sidebar, nav, header, footer {
          display: none !important;
        }
      }
    `}} />
  );
}

function CustomTemplateLayout(p: Omit<PrescriptionPreviewProps, 'hideBranding'>) {
  const namedMeds = p.medicines.filter(m => m.name);
  const [shouldSpillOver, setShouldSpillOver] = React.useState(false);
  const leftColRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (leftColRef.current) {
      // 160mm threshold to ensure shift before hitting "NOT VALID FOR COURT"
      const thresholdPx = 160 * 3.7795; 
      const currentHeight = leftColRef.current.scrollHeight;
      if (currentHeight > thresholdPx) {
        setShouldSpillOver(true);
      } else {
        setShouldSpillOver(false);
      }
    }
  }, [p.chiefComplaint, p.examination, p.diagnosis, p.allergies, p.coMorbids, p.medications, p.advice, p.procedure, p.followUpDates]);

  const CarePlan = () => (
    <>
      {p.advice && (
        <div style={{ marginBottom: '5mm' }}>
          <div style={{ fontSize: '10.5pt', fontWeight: 800, color: GOLD, marginBottom: '1.5mm' }}>Advice:</div>
          <div style={{ fontSize: '12pt', lineHeight: 1.4, paddingLeft: '2mm', whiteSpace: 'pre-line' }}>{p.advice}</div>
        </div>
      )}
      {p.procedure && (
        <div style={{ marginBottom: '5mm' }}>
          <div style={{ fontSize: '10.5pt', fontWeight: 800, color: GOLD, marginBottom: '1.5mm' }}>Procedure:</div>
          <div style={{ fontSize: '12pt', lineHeight: 1.4, paddingLeft: '2mm', whiteSpace: 'pre-line' }}>{p.procedure}</div>
        </div>
      )}
      {p.followUpDates.length > 0 && (
        <div style={{ marginBottom: '5mm' }}>
          <div style={{ fontSize: '10.5pt', fontWeight: 800, color: GOLD, marginBottom: '1.5mm' }}>Follow-up:</div>
          <div style={{ fontSize: '12pt', fontWeight: 700, color: INK, paddingLeft: '2mm' }}>
            {p.followUpDates.map(d => safeFormatDate(d)).join(', ')}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div style={{ padding: '0', backgroundColor: '#f5f5f5', minHeight: '100%' }}>
      <div id="prescription-print" style={{ 
        width: '210mm', 
        minHeight: '297mm', 
        backgroundColor: '#fff', 
        margin: '0 auto', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        <PrintStyles />
        
        {/* ── Custom Template Background ── */}
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          zIndex: 0,
          backgroundImage: `url(${p.prescriptionTemplateUrl})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat'
        }} />

        {/* ── Content Overlay ── */}
        <div style={{ 
          position: 'relative', 
          zIndex: 1, 
          paddingTop: '48mm', 
          paddingBottom: '30mm',
          paddingLeft: '18mm',
          paddingRight: '18mm',
          display: 'grid', 
          gridTemplateColumns: '1.2fr 1fr', 
          gap: '12mm',
          minHeight: '240mm', 
          background: 'transparent',
          color: INK
        }}>
          {/* Left Column: Primary Clinical Information */}
          <div ref={leftColRef} style={{ display: 'flex', flexDirection: 'column' }}>
            {p.chiefComplaint && (
              <div style={{ marginBottom: '5mm' }}>
                <div style={{ fontSize: '10.5pt', fontWeight: 800, color: GOLD, marginBottom: '1.5mm' }}>Chief Complaints:</div>
                <div style={{ fontSize: '12pt', lineHeight: 1.4, paddingLeft: '2mm', whiteSpace: 'pre-line' }}>{p.chiefComplaint}</div>
              </div>
            )}
            {p.examination && (
              <div style={{ marginBottom: '5mm' }}>
                <div style={{ fontSize: '10.5pt', fontWeight: 800, color: GOLD, marginBottom: '1.5mm' }}>Examination:</div>
                <div style={{ fontSize: '12pt', lineHeight: 1.4, paddingLeft: '2mm', whiteSpace: 'pre-line' }}>{p.examination}</div>
              </div>
            )}
            {p.diagnosis && (
              <div style={{ marginBottom: '5mm' }}>
                <div style={{ fontSize: '10.5pt', fontWeight: 800, color: GOLD, marginBottom: '1.5mm' }}>Diagnosis:</div>
                <div style={{ fontSize: '12pt', fontWeight: 700, paddingLeft: '2mm', whiteSpace: 'pre-line' }}>{p.diagnosis}</div>
              </div>
            )}
            {p.allergies && (
              <div style={{ marginBottom: '5mm' }}>
                <div style={{ fontSize: '10.5pt', fontWeight: 800, color: GOLD, marginBottom: '1.5mm' }}>Allergies:</div>
                <div style={{ fontSize: '12pt', fontWeight: 800, color: '#c53030', paddingLeft: '2mm', whiteSpace: 'pre-line' }}>{p.allergies}</div>
              </div>
            )}
            {p.coMorbids && (
              <div style={{ marginBottom: '6mm' }}>
                <div style={{ fontSize: '10.5pt', fontWeight: 800, color: GOLD, marginBottom: '1.5mm' }}>Co-Morbids:</div>
                <div style={{ fontSize: '12pt', paddingLeft: '2mm', whiteSpace: 'pre-line' }}>{p.coMorbids}</div>
              </div>
            )}
            {namedMeds.length > 0 && (
              <div style={{ marginTop: '2mm', marginBottom: '5mm' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2mm' }}>
                  <span style={{ fontSize: '16pt', fontWeight: 800, color: GOLD, fontFamily: 'serif', marginRight: '3mm' }}>℞</span>
                  <span style={{ fontSize: '10.5pt', fontWeight: 800, color: GOLD }}>Treatment (Medicines):</span>
                </div>
                <div style={{ paddingLeft: '4mm' }}>
                  {namedMeds.map((med, i) => (
                    <div key={med.id} style={{ marginBottom: '4mm' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontSize: '12pt', fontWeight: 700, color: INK }}>{i + 1}. {med.name}</div>
                        <div style={{ fontSize: '10.5pt', color: INK, fontWeight: 700 }}>{med.dosage} — {med.frequency}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1mm', paddingLeft: '4mm' }}>
                        <div style={{ fontSize: '10pt', color: '#666', fontWeight: 600 }}>Duration: {med.duration}</div>
                        {med.instructions && (
                          <div style={{ fontSize: '10pt', color: INK, fontStyle: 'italic', fontWeight: 500 }}>
                            <span style={{ color: GOLD, fontWeight: 800, fontStyle: 'normal' }}>Note: </span>{med.instructions}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!shouldSpillOver && <CarePlan />}
          </div>

          {/* Right Column: Patient Info & Spillover */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Patient Data Block (Aligned strictly to gold lines) */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              fontSize: '11.5pt', 
              fontWeight: 700,
              paddingLeft: '55mm', 
              paddingRight: '5mm',
              marginBottom: '30mm',
              whiteSpace: 'nowrap'
            }}>
              <div style={{ height: '9mm', display: 'flex', alignItems: 'flex-end', paddingBottom: '1mm' }}>{p.patient?.name}</div>
              <div style={{ height: '19.5mm', display: 'flex', alignItems: 'flex-end', paddingBottom: '1mm' }}>{p.prescriptionAge ? `${p.prescriptionAge} Years` : ''}</div>
              <div style={{ height: '20.5mm', display: 'flex', alignItems: 'flex-end', paddingBottom: '1mm' }}>{p.patient?.gender}</div>
              <div style={{ height: '5mm' }}></div> 
              <div style={{ height: '15mm', display: 'flex', alignItems: 'flex-end', paddingBottom: '1mm' }}>{p.today}</div>
            </div>
            {shouldSpillOver && (
              <div style={{ 
                paddingLeft: '45mm', // Shifted further right
                paddingRight: '5mm', 
                marginTop: '10mm',
                whiteSpace: 'pre-line',
                overflowWrap: 'break-word',
                color: INK
              }}>
                <CarePlan />
              </div>
            )}
          </div>
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
