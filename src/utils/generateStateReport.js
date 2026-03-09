// ─────────────────────────────────────────────────────────────────────────────
// generateStateReport.js
// Drop into src/utils/generateStateReport.js
// Usage: import generateStateReport from '../utils/generateStateReport';
//        generateStateReport({ stateData, mapCanvas, isDark });
//
// Requires: npm install jspdf
// ─────────────────────────────────────────────────────────────────────────────

import { jsPDF } from 'jspdf';

const REA_GREEN = [0, 132, 61];
const REA_DARK  = [0, 92,  43];
const WHITE     = [255, 255, 255];
const LIGHT_BG  = [245, 250, 247];
const GREY_TEXT = [120, 120, 120];
const DARK_TEXT = [30,  30,  30];

/* ── Draw a rounded rectangle ── */
const roundRect = (doc, x, y, w, h, r, fillColor, strokeColor) => {
  if (fillColor)   doc.setFillColor(...fillColor);
  if (strokeColor) doc.setDrawColor(...strokeColor);
  doc.roundedRect(x, y, w, h, r, r, fillColor ? (strokeColor ? 'FD' : 'F') : 'S');
};

/* ── Draw a horizontal progress bar ── */
const progressBar = (doc, x, y, w, h, pct, color) => {
  roundRect(doc, x, y, w, h, h/2, [230, 240, 235]);
  if (pct > 0) roundRect(doc, x, y, w * (pct/100), h, h/2, color);
};

/* ── Stat block: colored top border, big number, small label ── */
const statBlock = (doc, x, y, w, h, value, label, color) => {
  roundRect(doc, x, y, w, h, 3, WHITE);
  doc.setFillColor(...color);
  doc.rect(x, y, w, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...color);
  doc.text(String(value), x + w/2, y + 14, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...GREY_TEXT);
  doc.text(label.toUpperCase(), x + w/2, y + 20, { align: 'center' });
};

const generateStateReport = ({ stateData, mapCanvas, isDark, techData }) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W   = 210;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

  const d = stateData;
  const stateName = d.shapeName === 'Federal Capital Territory'
    ? 'FCT – Abuja'
    : d.shapeName;

  const completed     = Number(d.completed)       || 0;
  const ongoing       = Number(d.ongoing)         || 0;
  const yetToMobilize = Number(d.yet_to_mobilize) || 0;
  const total         = Number(d.total)           || 1;
  const pctDone       = Number(d.pct_completed)   || 0;

  const solar  = Number(d.solar_street_light) || 0;
  const grid   = Number(d.grid)               || 0;
  const mini   = Number(d.solar_mini_grid)    || 0;
  const home   = Number(d.solar_home_system)  || 0;
  const other  = Number(d.other_type)         || 0;

  /* ───────── PAGE 1 ───────── */

  // Header gradient strip
  doc.setFillColor(...REA_GREEN);
  doc.rect(0, 0, W, 38, 'F');
  doc.setFillColor(...REA_DARK);
  doc.rect(0, 34, W, 4, 'F');

  // REA badge
  roundRect(doc, 12, 8, 22, 22, 3, [255,255,255,0.2]);
  doc.setFillColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 132, 61);
  doc.text('REA', 23, 22, { align: 'center' });

  // Header text
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('STATE PROJECT REPORT', 40, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Rural Electrification Agency  ·  Nigeria', 40, 23);
  doc.setFontSize(8);
  doc.text(`Generated: ${dateStr}`, 40, 30);

  // State name banner
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 38, W, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...REA_DARK);
  doc.text(stateName.toUpperCase(), W/2, 52, { align: 'center' });

  // ── Section: Key Stats ──
  let y = 66;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...REA_GREEN);
  doc.text('KEY STATISTICS', 14, y);
  doc.setDrawColor(...REA_GREEN);
  doc.setLineWidth(0.4);
  doc.line(14, y+2, W-14, y+2);

  y += 7;
  const blockW = (W - 28 - 9) / 4;
  statBlock(doc, 14,               y, blockW, 26, total,         'Total Projects',    REA_GREEN);
  statBlock(doc, 14+blockW+3,      y, blockW, 26, completed,     'Completed',         [0, 196, 140]);
  statBlock(doc, 14+(blockW+3)*2,  y, blockW, 26, ongoing,       'Ongoing',           [255, 184, 0]);
  statBlock(doc, 14+(blockW+3)*3,  y, blockW, 26, yetToMobilize, 'Yet to Mobilize',   [255, 71, 87]);

  // ── Completion progress ──
  y += 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK_TEXT);
  doc.text('COMPLETION PROGRESS', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREY_TEXT);
  doc.text(`${pctDone}%`, W-14, y, { align: 'right' });
  y += 4;
  progressBar(doc, 14, y, W-28, 5, pctDone, REA_GREEN);

  // ── Section: Technology Breakdown ──
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...REA_GREEN);
  doc.text('TECHNOLOGY BREAKDOWN', 14, y);
  doc.line(14, y+2, W-14, y+2);

  y += 8;
  const techItems = [
    { label: 'Solar Street Light', value: solar,  color: [255, 184, 0]   },
    { label: 'Grid Extension',     value: grid,   color: [255, 71,  87]  },
    { label: 'Solar Mini Grid',    value: mini,   color: [30,  144, 255] },
    { label: 'Solar Home System',  value: home,   color: [168, 85,  247] },
    { label: 'Other',              value: other,  color: [119, 140, 163] },
  ];

  techItems.forEach(t => {
    const barPct = total > 0 ? (t.value / total) * 100 : 0;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK_TEXT);
    doc.text(t.label, 14, y + 3.5);
    doc.setTextColor(...GREY_TEXT);
    doc.text(`${t.value} (${Math.round(barPct)}%)`, W-14, y + 3.5, { align: 'right' });
    progressBar(doc, 14, y + 5, W-28, 4, barPct, t.color);
    y += 13;
  });

  // ── Map screenshot ──
  if (mapCanvas) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...REA_GREEN);
    doc.text('MAP VIEW', 14, y);
    doc.line(14, y+2, W-14, y+2);
    y += 6;

    try {
      const imgData = mapCanvas.toDataURL('image/png');
      const mapH    = 65;
      roundRect(doc, 14, y, W-28, mapH, 3, LIGHT_BG);
      doc.addImage(imgData, 'PNG', 14, y, W-28, mapH);
      // Subtle border
      doc.setDrawColor(...REA_GREEN);
      doc.setLineWidth(0.3);
      roundRect(doc, 14, y, W-28, mapH, 3, null, REA_GREEN);
      y += mapH + 6;
    } catch(e) {
      doc.setFont('helvetica','italic');
      doc.setFontSize(8);
      doc.setTextColor(...GREY_TEXT);
      doc.text('(Map screenshot unavailable — enable preserveDrawingBuffer in Mapbox config)', 14, y+10);
      y += 20;
    }
  }

  // ── Footer ──
  const footerY = 287;
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, footerY - 4, W, 14, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GREY_TEXT);
  doc.text('Rural Electrification Agency  ·  Project Monitoring Dashboard', 14, footerY + 2);
  doc.text(`Page 1  ·  ${dateStr}`, W-14, footerY + 2, { align: 'right' });
  doc.setDrawColor(...REA_GREEN);
  doc.setLineWidth(0.5);
  doc.line(14, footerY - 4, W-14, footerY - 4);

  /* ───────── PAGE 2: Data Table ───────── */
  doc.addPage();

  // Page 2 header
  doc.setFillColor(...REA_GREEN);
  doc.rect(0, 0, W, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(`${stateName.toUpperCase()}  —  PROJECT DETAIL`, 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(dateStr, W-14, 12, { align: 'right' });

  // Table header
  y = 24;
  const cols = [
    { label: '#',          w: 8  },
    { label: 'Project Title', w: 80 },
    { label: 'Type',       w: 35 },
    { label: 'Year',       w: 14 },
    { label: 'Status',     w: 32 },
    { label: 'Contractor', w: 27 },
  ];

  doc.setFillColor(...REA_DARK);
  doc.rect(14, y, W-28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  let cx = 14;
  cols.forEach(c => {
    doc.text(c.label, cx + 2, y + 5.5);
    cx += c.w;
  });

  // Note — actual project rows require project-level data passed in
  // This renders a summary note if no rows are provided
  y += 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GREY_TEXT);
  doc.text(
    'To include individual project rows, pass the filtered projects array as the "projects" prop to generateStateReport().',
    14, y, { maxWidth: W-28 }
  );

  if (techData && Array.isArray(techData) && techData.length > 0) {
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK_TEXT);
    let rowY = y;
    techData.forEach((p, i) => {
      if (rowY > 272) { doc.addPage(); rowY = 20; }
      const bg = i % 2 === 0 ? WHITE : LIGHT_BG;
      doc.setFillColor(...bg);
      doc.rect(14, rowY, W-28, 7, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...DARK_TEXT);
      cx = 14;
      const cells = [
        String(i+1),
        (p.title || '').slice(0, 48),
        (p.type  || '').slice(0, 22),
        String(p.year || ''),
        (p.status || '').slice(0, 20),
        (p.contractor || '').slice(0, 18),
      ];
      cols.forEach((c, ci) => {
        doc.text(cells[ci], cx + 2, rowY + 4.5);
        cx += c.w;
      });
      // Status colour dot
      const statusColor = p.status === 'COMPLETED' ? [0,196,140] : p.status === 'ONGOING' ? [255,184,0] : [255,71,87];
      doc.setFillColor(...statusColor);
      doc.circle(14 + cols[0].w + cols[1].w + cols[2].w + cols[3].w + 1.5, rowY + 3.5, 1.2, 'F');
      rowY += 7;
    });
  }

  // Page 2 footer
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 283, W, 14, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GREY_TEXT);
  doc.text('Rural Electrification Agency  ·  Project Monitoring Dashboard', 14, 290);
  doc.text(`Page 2  ·  ${dateStr}`, W-14, 290, { align: 'right' });
  doc.setDrawColor(...REA_GREEN);
  doc.line(14, 283, W-14, 283);

  // ── Save ──
  const fileName = `REA-${stateName.replace(/\s+/g,'-')}-Report-${now.toISOString().slice(0,10)}.pdf`;
  doc.save(fileName);
};

export default generateStateReport;
