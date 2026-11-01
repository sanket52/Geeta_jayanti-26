import { jsPDF } from "jspdf";
import type { jsPDF as JsPDF } from "jspdf";
import QRCode from "qrcode";
import { createVerificationUrl, type StudentRecord, type VerificationDocumentType } from "./studentRecord";

const maroon: [number, number, number] = [92, 15, 15];
const gold: [number, number, number] = [200, 144, 43];
const brown: [number, number, number] = [44, 21, 8];
const cream: [number, number, number] = [253, 246, 238];
const institution = "Maharshi Panini Ved Vedang Vidhyapeeth Gurukul";

function addField(doc: JsPDF, label: string, value: string, x: number, y: number, width = 72) {
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 66, 38);
  doc.setFontSize(8);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brown);
  doc.setFontSize(10);
  doc.text(doc.splitTextToSize(value || "—", width), x, y + 5);
}

function createQrCodeDataUrl(value: string) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const quietZone = 4;
  const scale = 5;
  const canvas = document.createElement("canvas");
  const dimension = (qr.modules.size + quietZone * 2) * scale;
  canvas.width = dimension;
  canvas.height = dimension;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the document verification code.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, dimension, dimension);
  context.fillStyle = "#000000";
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) {
      if (qr.modules.get(row, column)) {
        context.fillRect((column + quietZone) * scale, (row + quietZone) * scale, scale, scale);
      }
    }
  }
  return canvas.toDataURL("image/png");
}

function downloadRegistrationDocument(
  record: StudentRecord,
  title: string,
  filename: string,
  acknowledgement: string,
  verificationType: Extract<VerificationDocumentType, "registration-confirmation" | "participation-receipt">,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const verificationUrl = createVerificationUrl(verificationType, record);
  const qr = createQrCodeDataUrl(verificationUrl);
  const documentReference = verificationType === "registration-confirmation"
    ? `${record.registrationNumber}-REG`
    : `${record.registrationNumber}-PART`;

  doc.setFillColor(...cream);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(...maroon);
  doc.rect(0, 0, 210, 48, "F");
  doc.setFillColor(...gold);
  doc.rect(0, 48, 210, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(institution, 105, 19, { align: "center" });
  doc.setTextColor(...gold);
  doc.setFontSize(11);
  doc.text(title.toUpperCase(), 105, 32, { align: "center" });

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, 58, 182, 180, 3, 3, "S");
  doc.setFillColor(255, 248, 220);
  doc.roundedRect(22, 66, 125, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...maroon);
  doc.text(verificationType === "registration-confirmation" ? "REGISTRATION STATUS: CONFIRMED" : "PARTICIPATION STATUS: REGISTERED", 26, 73);
  doc.addImage(qr, "PNG", 157, 65, 29, 29);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(107, 66, 38);
  doc.text("SCAN TO VERIFY", 171.5, 97, { align: "center" });

  addField(doc, "Student Name", record.fullName, 24, 89, 125);
  addField(doc, "Registration Number", record.registrationNumber, 24, 111, 78);
  addField(doc, "Document Reference", documentReference, 111, 111, 75);
  addField(doc, "Father / Guardian", record.fatherName, 24, 133, 78);
  addField(doc, "School", record.school, 111, 133, 75);
  addField(doc, "Competition", record.competition, 24, 155, 155);
  addField(doc, "Category", record.category, 24, 177, 78);
  addField(doc, "Subject", record.subject, 111, 177, 75);
  addField(doc, "Language", record.language, 24, 199, 78);
  addField(doc, "Class / Grade", record.classYear, 111, 199, 75);
  addField(doc, "Exam Schedule", `${record.examDate} · ${record.examTime}`, 24, 221, 155);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...brown);
  doc.setFontSize(8.5);
  doc.text(doc.splitTextToSize(acknowledgement, 174), 18, 251);
  doc.setTextColor(107, 66, 38);
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · Keep this document for your records.`, 105, 278, { align: "center" });
  doc.save(filename);
}

export function downloadRegistrationConfirmationPdf(record: StudentRecord) {
  downloadRegistrationDocument(
    record,
    "Registration Confirmation",
    `${record.registrationNumber}-registration-confirmation.pdf`,
    `This document confirms that ${record.fullName} is registered for ${record.competition}. Keep it with your registration number for reference.`,
    "registration-confirmation",
  );
}

export function downloadParticipationReceiptPdf(record: StudentRecord) {
  downloadRegistrationDocument(
    record,
    "Competition Participation Receipt",
    `${record.registrationNumber}-participation-receipt.pdf`,
    `This receipt acknowledges ${record.fullName}'s registration to participate in ${record.competition}. It confirms participation registration only; it is not a fee or payment receipt.`,
    "participation-receipt",
  );
}

export async function downloadAdmitCardPdf(record: StudentRecord) {
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([import("jspdf"), import("qrcode")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const verificationUrl = createVerificationUrl("admit-card", record);
  const qr = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 300 });

  doc.setFillColor(...cream);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(...maroon);
  doc.rect(0, 0, 210, 48, "F");
  doc.setFillColor(...gold);
  doc.rect(0, 48, 210, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(institution, 105, 18, { align: "center" });
  doc.setTextColor(...gold);
  doc.setFontSize(11);
  doc.text("OFFICIAL EXAMINATION ADMIT CARD", 105, 29, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(record.competition, 105, 38, { align: "center" });

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.roundedRect(12, 58, 186, 204, 3, 3, "S");

  if (record.photo) {
    try {
      doc.addImage(record.photo, "JPEG", 18, 68, 36, 45, undefined, "FAST");
    } catch {
      doc.setFillColor(242, 228, 204);
      doc.rect(18, 68, 36, 45, "F");
    }
  } else {
    doc.setFillColor(242, 228, 204);
    doc.rect(18, 68, 36, 45, "F");
    doc.setTextColor(...maroon);
    doc.setFontSize(9);
    doc.text("STUDENT", 36, 92, { align: "center" });
  }
  doc.setDrawColor(...gold);
  doc.rect(18, 68, 36, 45, "S");

  doc.addImage(qr, "PNG", 162, 68, 27, 27);
  doc.setTextColor(107, 66, 38);
  doc.setFontSize(6.5);
  doc.text("Scan to verify", 175.5, 99, { align: "center" });

  addField(doc, "Candidate Name", record.fullName, 62, 70, 88);
  addField(doc, "Registration Number", record.registrationNumber, 62, 88);
  addField(doc, "Roll Number", record.rollNumber, 62, 105);

  doc.setDrawColor(242, 228, 204);
  doc.line(18, 123, 190, 123);
  addField(doc, "Father's Name", record.fatherName, 18, 134);
  addField(doc, "Date of Birth", record.dob, 108, 134);
  addField(doc, "Category", record.category, 18, 154);
  addField(doc, "Subject", record.subject, 108, 154);
  addField(doc, "Exam Date", record.examDate, 18, 174);
  addField(doc, "Exam Time", record.examTime, 108, 174);
  addField(doc, "Exam Mode / Centre", record.examMode, 18, 194, 165);
  addField(doc, "Language", record.language, 18, 214);

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.4);
  doc.line(132, 220, 188, 220);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brown);
  doc.setFontSize(8);
  doc.text("CANDIDATE SIGNATURE", 160, 225, { align: "center" });

  doc.setFillColor(255, 248, 220);
  doc.setDrawColor(232, 184, 75);
  doc.roundedRect(18, 232, 172, 38, 2, 2, "FD");
  doc.setFillColor(...maroon);
  doc.roundedRect(22, 236, 25, 6, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("IMPORTANT", 34.5, 240, { align: "center" });
  doc.setTextColor(...maroon);
  doc.setFontSize(7.5);
  doc.text("EXAMINATION INSTRUCTIONS", 51, 240);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...brown);
  doc.setFontSize(6.4);
  doc.text("1. PHOTO ID: Carry this card and an original photo ID.", 23, 247);
  doc.text("2. REPORT EARLY: Arrive 30 minutes before the exam.", 23, 251);
  doc.text("3. SIGNATURE: Sign only inside the designated box.", 23, 255);
  doc.text("4. QR CODE: Keep the code clear and undamaged.", 108, 247);
  doc.text("5. PROHIBITED: No phones, notes, watches, or calculators.", 108, 251);
  doc.text("6. CONDUCT: Unfair means will cause disqualification.", 108, 255);

  doc.setTextColor(107, 66, 38);
  doc.setFontSize(7);
  doc.text(`Generated electronically · Verification: ${record.rollNumber}`, 105, 279, { align: "center" });
  doc.save(`${record.rollNumber}-admit-card.pdf`);
}

export async function downloadCertificatePdf(record: StudentRecord) {
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([import("jspdf"), import("qrcode")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const verificationUrl = createVerificationUrl("certificate", record);
  const qr = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 300 });

  doc.setFillColor(...cream);
  doc.rect(0, 0, 297, 210, "F");
  doc.setDrawColor(...maroon);
  doc.setLineWidth(2.2);
  doc.rect(8, 8, 281, 194, "S");
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.rect(12, 12, 273, 186, "S");
  doc.setFillColor(...maroon);
  doc.rect(18, 18, 261, 25, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(institution, 148.5, 29, { align: "center" });
  doc.setTextColor(...gold);
  doc.setFontSize(9);
  doc.text("GREATER NOIDA, UTTAR PRADESH", 148.5, 37, { align: "center" });

  doc.setTextColor(...maroon);
  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.text("Certificate of Achievement", 148.5, 67, { align: "center" });
  doc.setTextColor(107, 66, 38);
  doc.setFont("times", "italic");
  doc.setFontSize(13);
  doc.text("This certificate is proudly presented to", 148.5, 82, { align: "center" });

  doc.setTextColor(...brown);
  doc.setFont("times", "bold");
  doc.setFontSize(25);
  doc.text(record.fullName, 148.5, 101, { align: "center" });
  doc.setDrawColor(...gold);
  doc.line(72, 106, 225, 106);

  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(107, 66, 38);
  doc.text("for successfully participating in and completing", 148.5, 119, { align: "center" });
  doc.setFont("times", "bold");
  doc.setTextColor(...maroon);
  doc.setFontSize(16);
  doc.text(record.competition, 148.5, 131, { align: "center" });
  doc.setFont("times", "normal");
  doc.setTextColor(...brown);
  doc.setFontSize(11);
  doc.text(`${record.category} · ${record.subject} · Session 2026`, 148.5, 142, { align: "center" });
  doc.setTextColor(107, 66, 38);
  doc.setFontSize(9);
  doc.text(
    "This honour is awarded in recognition of the candidate's sincere dedication, disciplined preparation,",
    148.5,
    151,
    { align: "center" }
  );
  doc.text(
    "and successful demonstration of knowledge in Vedic studies, Sanskrit, and Indian cultural heritage.",
    148.5,
    156,
    { align: "center" }
  );
  doc.setFont("times", "italic");
  doc.text(
    "The Gurukul commends this achievement and wishes the candidate continued learning and scholarly excellence.",
    148.5,
    163,
    { align: "center" }
  );
  doc.setFont("times", "normal");

  doc.addImage(qr, "PNG", 245, 157, 25, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(107, 66, 38);
  doc.text("Scan to verify", 257.5, 186, { align: "center" });

  doc.setDrawColor(...brown);
  doc.line(30, 171, 88, 171);
  doc.line(108, 171, 166, 171);
  doc.line(186, 171, 232, 171);
  doc.setFontSize(8);
  doc.text("Date of Issue", 59, 177, { align: "center" });
  doc.text("Examination Controller", 137, 177, { align: "center" });
  doc.text("Authorized Signatory", 209, 177, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text("30 October 2026", 59, 167, { align: "center" });
  doc.text(record.certificateNumber, 148.5, 192, { align: "center" });

  doc.save(`${record.certificateNumber}.pdf`);
}
