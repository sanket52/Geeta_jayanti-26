import { useSearchParams } from "react-router";
import { createVerificationToken } from "../lib/studentRecord";

export default function VerifyDocument() {
  const [params] = useSearchParams();
  const type = params.get("type");
  const registration = params.get("registration");
  const name = params.get("name");
  const documentNumber = params.get("document");
  const token = params.get("token");
  const expectedToken = type && registration && name && documentNumber
    ? createVerificationToken(type, registration, name, documentNumber)
    : "";
  const valid = Boolean(expectedToken && token === expectedToken);

  return (
    <div className="min-h-[70vh] bg-cream-dark px-6 py-16">
      <div className="max-w-xl mx-auto bg-cream border border-cream-dark rounded-2xl p-8 shadow-xl text-center">
        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl font-bold ${
          valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {valid ? "✓" : "!"}
        </div>
        <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-brown mt-5">
          {valid ? "Document Verified" : "Invalid Verification Link"}
        </h1>
        {valid && (
          <>
            <p className="text-sm text-brown-mid mt-2">This document was issued by Maharshi Panini Ved Vedang Vidhyapeeth Gurukul.</p>
            <div className="bg-cream-dark rounded-xl p-5 text-left mt-6 space-y-3">
              {[
                ["Document", ({
                  "admit-card": "Examination Admit Card",
                  certificate: "Certificate of Achievement",
                  "registration-confirmation": "Registration Confirmation",
                  "participation-receipt": "Competition Participation Receipt",
                } as Record<string, string>)[type || ""] || "Official Student Document"],
                ["Candidate", name || ""],
                ["Registration No.", registration || ""],
                ["Document No.", documentNumber || ""],
                ["Status", "Valid"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 text-sm">
                  <span className="text-brown-mid">{label}</span>
                  <span className="font-semibold text-brown text-right">{value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
