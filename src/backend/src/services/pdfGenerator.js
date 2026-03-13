// PDF Generator Service - Analytics PDF report generation
// Uses pdfkit to render formatted analytics reports.

const PDFDocument = require('pdfkit');
const { getDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');

const BRAND_COLOR = [0, 128, 128]; // Teal
const HEADER_BG = [245, 245, 244]; // Stone-100
const TEXT_COLOR = [41, 37, 36]; // Stone-800
const MUTED_COLOR = [120, 113, 108]; // Stone-500

/**
 * Generate an analytics PDF report for a therapist
 * @param {number} therapistId
 * @param {number} days - Number of days for the report
 * @param {string} therapistEmail - Therapist's email for the header
 * @returns {PDFDocument} - Piped PDF document stream
 */
function generateAnalyticsPDF(therapistId, days, therapistEmail) {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date();

  // Gather analytics data
  const totals = getTotals(db, therapistId, cutoff);
  const dailyActivity = getDailyActivity(db, therapistId, cutoff);
  const clientActivity = getClientActivity(db, therapistId, cutoff);
  const sessionFrequency = getSessionFrequency(db, therapistId, cutoff, days);

  // Create PDF
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Analytics Report - ${days} Days`,
      Author: 'PR-TOP',
      Subject: 'Therapist Analytics Report',
      Creator: 'PR-TOP Platform'
    }
  });

  // ---- Header ----
  doc.fontSize(24).fillColor(...BRAND_COLOR).text('PR-TOP', 50, 50);
  doc.fontSize(10).fillColor(...MUTED_COLOR)
    .text('Analytics Report', 50, 78)
    .text(`${therapistEmail}`, 50, 92)
    .text(`Period: Last ${days} days (${cutoff.split('T')[0]} to ${now.toISOString().split('T')[0]})`, 50, 106)
    .text(`Generated: ${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`, 50, 120);

  doc.moveTo(50, 140).lineTo(545, 140).strokeColor(...BRAND_COLOR).lineWidth(2).stroke();

  // ---- Summary Cards ----
  let y = 160;
  doc.fontSize(16).fillColor(...TEXT_COLOR).text('Summary', 50, y);
  y += 30;

  const cards = [
    { label: 'Total Activity', value: String(totals.total) },
    { label: 'Diary Entries', value: String(totals.diary_entries) },
    { label: 'Sessions', value: String(totals.sessions) },
    { label: 'Notes', value: String(totals.notes) }
  ];

  const cardWidth = 120;
  cards.forEach((card, i) => {
    const x = 50 + i * (cardWidth + 5);
    doc.rect(x, y, cardWidth, 50).fill(245, 245, 244);
    doc.fontSize(8).fillColor(...MUTED_COLOR).text(card.label, x + 10, y + 8, { width: cardWidth - 20 });
    doc.fontSize(20).fillColor(...TEXT_COLOR).text(card.value, x + 10, y + 22, { width: cardWidth - 20 });
  });

  y += 70;

  // ---- Session Frequency ----
  doc.fontSize(16).fillColor(...TEXT_COLOR).text('Session Frequency', 50, y);
  y += 25;
  doc.fontSize(10).fillColor(...MUTED_COLOR)
    .text(`Total sessions: ${sessionFrequency.total} | Per week: ${sessionFrequency.perWeek} | Days with sessions: ${sessionFrequency.daysWithSessions}/${days}`, 50, y);
  y += 25;

  // ---- Daily Activity Table ----
  if (dailyActivity.length > 0) {
    doc.fontSize(16).fillColor(...TEXT_COLOR).text('Daily Activity', 50, y);
    y += 25;

    // Table header
    doc.rect(50, y, 495, 20).fill(...HEADER_BG);
    doc.fontSize(8).fillColor(...TEXT_COLOR);
    doc.text('Date', 55, y + 6, { width: 100 });
    doc.text('Diary', 165, y + 6, { width: 80 });
    doc.text('Sessions', 255, y + 6, { width: 80 });
    doc.text('Notes', 345, y + 6, { width: 80 });
    doc.text('Total', 435, y + 6, { width: 80 });
    y += 22;

    // Show last 30 days max to fit on page
    const displayDays = dailyActivity.slice(-30);
    displayDays.forEach((day, i) => {
      if (y > 740) {
        doc.addPage();
        y = 50;
      }
      if (i % 2 === 0) {
        doc.rect(50, y, 495, 16).fill(252, 252, 251);
      }
      doc.fontSize(8).fillColor(...TEXT_COLOR);
      doc.text(day.date, 55, y + 4, { width: 100 });
      doc.text(String(day.diary_entries), 165, y + 4, { width: 80 });
      doc.text(String(day.sessions), 255, y + 4, { width: 80 });
      doc.text(String(day.notes), 345, y + 4, { width: 80 });
      doc.text(String(day.total), 435, y + 4, { width: 80 });
      y += 16;
    });
    y += 15;
  }

  // ---- Client Activity Table ----
  if (clientActivity.length > 0) {
    if (y > 620) {
      doc.addPage();
      y = 50;
    }
    doc.fontSize(16).fillColor(...TEXT_COLOR).text('Client Activity Breakdown', 50, y);
    y += 25;

    // Table header
    doc.rect(50, y, 495, 20).fill(...HEADER_BG);
    doc.fontSize(8).fillColor(...TEXT_COLOR);
    doc.text('Client', 55, y + 6, { width: 130 });
    doc.text('Diary', 195, y + 6, { width: 70 });
    doc.text('Sessions', 275, y + 6, { width: 70 });
    doc.text('Notes', 355, y + 6, { width: 70 });
    doc.text('Total', 435, y + 6, { width: 70 });
    y += 22;

    clientActivity.forEach((client, i) => {
      if (y > 740) {
        doc.addPage();
        y = 50;
      }
      if (i % 2 === 0) {
        doc.rect(50, y, 495, 16).fill(252, 252, 251);
      }
      doc.fontSize(8).fillColor(...TEXT_COLOR);
      const displayName = client.email ? client.email.split('@')[0] : `Client #${client.id}`;
      doc.text(displayName, 55, y + 4, { width: 130 });
      doc.text(String(client.diary_entries), 195, y + 4, { width: 70 });
      doc.text(String(client.sessions), 275, y + 4, { width: 70 });
      doc.text(String(client.notes), 355, y + 4, { width: 70 });
      doc.text(String(client.total), 435, y + 4, { width: 70 });
      y += 16;
    });
    y += 15;
  }

  // ---- Footer ----
  if (y > 720) {
    doc.addPage();
    y = 50;
  }
  y = Math.max(y, 700);
  doc.moveTo(50, y).lineTo(545, y).strokeColor(200, 200, 200).lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(...MUTED_COLOR)
    .text('Generated by PR-TOP | GDPR-compliant analytics report | Data is consent-filtered', 50, y + 8, { align: 'center', width: 495 });

  return doc;
}

function getTotals(db, therapistId, cutoff) {
  let diary = 0, sessions = 0, notes = 0;

  const diaryResult = db.exec(
    `SELECT COUNT(*) FROM diary_entries d
     JOIN users u ON u.id = d.client_id AND u.therapist_id = ? AND u.consent_therapist_access = 1
     WHERE d.created_at >= ?`,
    [therapistId, cutoff]
  );
  if (diaryResult.length > 0) diary = diaryResult[0].values[0][0];

  const sessionResult = db.exec(
    `SELECT COUNT(*) FROM sessions s
     JOIN users u ON u.id = s.client_id AND u.consent_therapist_access = 1
     WHERE s.therapist_id = ? AND s.created_at >= ?`,
    [therapistId, cutoff]
  );
  if (sessionResult.length > 0) sessions = sessionResult[0].values[0][0];

  const noteResult = db.exec(
    "SELECT COUNT(*) FROM therapist_notes WHERE therapist_id = ? AND created_at >= ?",
    [therapistId, cutoff]
  );
  if (noteResult.length > 0) notes = noteResult[0].values[0][0];

  return { diary_entries: diary, sessions, notes, total: diary + sessions + notes };
}

function getDailyActivity(db, therapistId, cutoff) {
  const dateMap = {};

  const diaryResult = db.exec(
    `SELECT date(d.created_at) as dt, COUNT(*) as cnt FROM diary_entries d
     JOIN users u ON u.id = d.client_id AND u.therapist_id = ? AND u.consent_therapist_access = 1
     WHERE d.created_at >= ? GROUP BY date(d.created_at)`,
    [therapistId, cutoff]
  );
  if (diaryResult.length > 0) {
    diaryResult[0].values.forEach(r => {
      if (!dateMap[r[0]]) dateMap[r[0]] = { date: r[0], diary_entries: 0, sessions: 0, notes: 0, total: 0 };
      dateMap[r[0]].diary_entries = r[1];
      dateMap[r[0]].total += r[1];
    });
  }

  const sessionResult = db.exec(
    `SELECT date(s.created_at) as dt, COUNT(*) as cnt FROM sessions s
     JOIN users u ON u.id = s.client_id AND u.consent_therapist_access = 1
     WHERE s.therapist_id = ? AND s.created_at >= ? GROUP BY date(s.created_at)`,
    [therapistId, cutoff]
  );
  if (sessionResult.length > 0) {
    sessionResult[0].values.forEach(r => {
      if (!dateMap[r[0]]) dateMap[r[0]] = { date: r[0], diary_entries: 0, sessions: 0, notes: 0, total: 0 };
      dateMap[r[0]].sessions = r[1];
      dateMap[r[0]].total += r[1];
    });
  }

  const noteResult = db.exec(
    `SELECT date(n.created_at) as dt, COUNT(*) as cnt FROM therapist_notes n
     WHERE n.therapist_id = ? AND n.created_at >= ? GROUP BY date(n.created_at)`,
    [therapistId, cutoff]
  );
  if (noteResult.length > 0) {
    noteResult[0].values.forEach(r => {
      if (!dateMap[r[0]]) dateMap[r[0]] = { date: r[0], diary_entries: 0, sessions: 0, notes: 0, total: 0 };
      dateMap[r[0]].notes = r[1];
      dateMap[r[0]].total += r[1];
    });
  }

  return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
}

function getClientActivity(db, therapistId, cutoff) {
  const result = db.exec(
    `SELECT u.id, u.email,
            (SELECT COUNT(*) FROM diary_entries de WHERE de.client_id = u.id AND de.created_at >= ?) as diary_entries,
            (SELECT COUNT(*) FROM sessions s WHERE s.client_id = u.id AND s.therapist_id = ? AND s.created_at >= ?) as sessions,
            (SELECT COUNT(*) FROM therapist_notes tn WHERE tn.client_id = u.id AND tn.therapist_id = ? AND tn.created_at >= ?) as notes
     FROM users u
     WHERE u.therapist_id = ? AND u.role = 'client' AND u.consent_therapist_access = 1`,
    [cutoff, therapistId, cutoff, therapistId, cutoff, therapistId]
  );

  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0],
    email: row[1],
    diary_entries: row[2],
    sessions: row[3],
    notes: row[4],
    total: row[2] + row[3] + row[4]
  }));
}

function getSessionFrequency(db, therapistId, cutoff, days) {
  const result = db.exec(
    `SELECT COUNT(*) FROM sessions s
     JOIN users u ON u.id = s.client_id AND u.consent_therapist_access = 1
     WHERE s.therapist_id = ? AND s.created_at >= ?`,
    [therapistId, cutoff]
  );
  const total = result.length > 0 ? result[0].values[0][0] : 0;
  const weeks = Math.max(days / 7, 1);
  const perWeek = (total / weeks).toFixed(1);

  const daysResult = db.exec(
    `SELECT COUNT(DISTINCT date(s.created_at)) FROM sessions s
     JOIN users u ON u.id = s.client_id AND u.consent_therapist_access = 1
     WHERE s.therapist_id = ? AND s.created_at >= ?`,
    [therapistId, cutoff]
  );
  const daysWithSessions = daysResult.length > 0 ? daysResult[0].values[0][0] : 0;

  return { total, perWeek, daysWithSessions };
}

module.exports = { generateAnalyticsPDF };
