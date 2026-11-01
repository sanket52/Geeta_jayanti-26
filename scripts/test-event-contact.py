"""Checks the supplied event contact details and their public link gates."""
import json
import re
from pathlib import Path

contact = Path("src/lib/eventContact.ts").read_text(encoding="utf-8")
links = Path("src/components/EventContactLinks.tsx").read_text(encoding="utf-8")
chat = Path("src/components/EventHelpdesk.tsx").read_text(encoding="utf-8")
public_layout = Path("src/layouts/PublicLayout.tsx").read_text(encoding="utf-8")
contact_page = Path("src/pages/Contact.tsx").read_text(encoding="utf-8")
admin = Path("src/pages/admin/ContactSettings.tsx").read_text(encoding="utf-8")
migration = Path("supabase/geeta_jayanti_contact_settings.sql").read_text(encoding="utf-8")
faqs = json.loads(Path("src/data/geetaJayantiFaqs.json").read_text(encoding="utf-8"))

for expected in ["9456984723", "7500790387", "RB-22, Sector 36, Greater Noida, Uttar Pradesh, India."]:
    assert expected in contact and expected in migration
assert 'return `tel:+91${phone.replace(/\\D/g, "")}`' in contact
assert 'https://www.google.com/maps/dir/?api=1&destination=' in contact
assert "whatsapp &&" in links and "phone_1_whatsapp_confirmed: false" in contact and "phone_2_whatsapp_confirmed: false" in contact
assert "support_email_verified && isValidEmail" in contact and "mailto:${contact.support_email}" in links
assert 'organization_name_hi: "महर्षि पाणिनि वेद वेदांग विद्यापीठ गुरुकुल"' in contact
assert "support_email: \"\"" in contact and "support_email_verified: false" in contact
assert "Contact Support" in chat and "loadEventContact()" in chat
assert "EventContactLinks contact={contact}" in contact_page
assert "phoneHref(eventContact.contact_phone_1)" in public_layout and "phoneHref(eventContact.contact_phone_2)" in public_layout
assert "support_email_verified" in admin and "phone_1_whatsapp_confirmed" in admin and "organization_address" in admin
assert "info@gurukul.edu" not in public_layout + contact_page + chat
assert "98765 43210" not in public_layout + contact_page

for faq_id in (70, 78, 79, 80):
    faq = faqs[faq_id - 1]
    for number in ("9456984723", "7500790387"):
        assert number in faq["answer_en"] and number in faq["answer_hi"], faq_id
    assert "RB-22, Sector 36" in faq["answer_en"] and "RB-22" in faq["answer_hi"], faq_id

assert len(re.findall(r"where id = (10|70|78|79|80);", migration)) == 5
print("Contact checks passed: exact numbers, map/tel/email links, WhatsApp gates, five support FAQ records, and admin-managed settings.")
