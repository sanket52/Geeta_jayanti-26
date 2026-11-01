export const STUDENT_RECORD_KEY = "mpvvg_student_record";
export const STUDENT_RECORD_UPDATED_EVENT = "mpvvg:student-record-updated";

export type StudentRecord = {
  registrationNumber: string;
  fullName: string;
  fatherName: string;
  motherName: string;
  dob: string;
  gender: string;
  mobile: string;
  email: string;
  address: string;
  village: string;
  district: string;
  state: string;
  pinCode: string;
  school: string;
  classYear: string;
  board: string;
  passingYear: string;
  qualification: string;
  sanskritLevel: string;
  prevParticipation: string;
  idType: string;
  idReference: string;
  educationalDocumentName: string;
  competition: string;
  category: string;
  subject: string;
  language: string;
  photo: string;
  examDate: string;
  examTime: string;
  examMode: string;
  rollNumber: string;
  certificateNumber: string;
};

export const defaultStudentRecord: StudentRecord = {
  registrationNumber: "MPVVG-2026-000123",
  fullName: "Ravi Kumar Sharma",
  fatherName: "Shri Ram Kumar Sharma",
  motherName: "Smt. Sunita Sharma",
  dob: "2012-03-12",
  gender: "Male",
  mobile: "+91 94XXX XXXXX",
  email: "ravi.sharma@example.com",
  address: "Varanasi, Uttar Pradesh",
  village: "",
  district: "Varanasi",
  state: "Uttar Pradesh",
  pinCode: "221005",
  school: "Saraswati Vidya Mandir",
  classYear: "Class 10",
  board: "CBSE",
  passingYear: "2026",
  qualification: "Class 10",
  sanskritLevel: "Intermediate",
  prevParticipation: "No",
  idType: "School ID",
  idReference: "0123",
  educationalDocumentName: "school-id.pdf",
  competition: "Vedic Knowledge Competition 2026",
  category: "Junior (10–14 years)",
  subject: "Sanskrit",
  language: "Hindi",
  photo: "",
  examDate: "15 October 2026",
  examTime: "10:00 AM – 12:00 PM",
  examMode: "Online Proctored Examination",
  rollNumber: "VK26-JR-00123",
  certificateNumber: "MPVVG-CERT-2026-00123",
};

export function getStudentRecord(): StudentRecord {
  if (typeof window === "undefined") return defaultStudentRecord;
  try {
    const stored = window.localStorage.getItem(STUDENT_RECORD_KEY);
    return stored ? { ...defaultStudentRecord, ...JSON.parse(stored) } : defaultStudentRecord;
  } catch {
    return defaultStudentRecord;
  }
}

export function saveStudentRecord(record: StudentRecord) {
  window.localStorage.setItem(STUDENT_RECORD_KEY, JSON.stringify(record));
  window.dispatchEvent(new CustomEvent(STUDENT_RECORD_UPDATED_EVENT));
}

export function subscribeToStudentRecord(callback: () => void) {
  window.addEventListener(STUDENT_RECORD_UPDATED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STUDENT_RECORD_UPDATED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function createVerificationToken(type: string, registration: string, name: string, documentNumber: string) {
  const value = `${type}|${registration}|${name}|${documentNumber}|MPVVG-2013`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

export type VerificationDocumentType = "admit-card" | "certificate" | "registration-confirmation" | "participation-receipt";

export function createVerificationUrl(type: VerificationDocumentType, record: StudentRecord) {
  const documentNumber = {
    "admit-card": record.rollNumber,
    certificate: record.certificateNumber,
    "registration-confirmation": `${record.registrationNumber}-REG`,
    "participation-receipt": `${record.registrationNumber}-PART`,
  }[type];
  const params = new URLSearchParams({
    type,
    registration: record.registrationNumber,
    name: record.fullName,
    document: documentNumber,
    token: createVerificationToken(type, record.registrationNumber, record.fullName, documentNumber),
  });
  return `${window.location.origin}/verify?${params.toString()}`;
}
