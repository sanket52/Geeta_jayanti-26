-- Run after geeta_jayanti_competitions_setup.sql and geeta_jayanti_chatbot_faqs.sql.
-- Public contact data is readable; only current_user_role() = 'admin' may edit it.
alter table public.gjm_event_settings
  add column if not exists organization_name text not null default 'Maharshi Panini Ved Vedang Vidhyapeeth Gurukul',
  add column if not exists organization_name_hi text not null default 'महर्षि पाणिनि वेद वेदांग विद्यापीठ गुरुकुल',
  add column if not exists contact_phone_1 text not null default '9456984723',
  add column if not exists contact_phone_2 text not null default '7500790387',
  add column if not exists support_email text,
  add column if not exists support_email_verified boolean not null default false,
  add column if not exists organization_address text not null default 'RB-22, Sector 36, Greater Noida, Uttar Pradesh, India.',
  add column if not exists phone_1_whatsapp_confirmed boolean not null default false,
  add column if not exists phone_2_whatsapp_confirmed boolean not null default false;

insert into public.gjm_event_settings (id) values (true) on conflict (id) do nothing;

-- Keep the website's persisted FAQ copy in step with the contact details.
update public.gjm_chatbot_faqs set answer_en = 'For official event updates, check the Geeta Jayanti Mahotsav website and its announcements section. For personal assistance, use Contact Support to reach the organizers.',
  answer_hi = 'आधिकारिक अपडेट के लिए गीता जयंती महोत्सव की वेबसाइट और घोषणा अनुभाग देखें। सहायता के लिए संपर्क विवरण नीचे दिए गए हैं।', updated_at = current_date where id = 10;
update public.gjm_chatbot_faqs set answer_en = 'For technical help with registration, competitions, examinations, or uploads, contact the official support team at +91 9456984723 or +91 7500790387. The address is RB-22, Sector 36, Greater Noida, Uttar Pradesh, India. See Contact Us for current support information.',
  answer_hi = 'पंजीकरण, प्रतियोगिताओं, परीक्षा या अपलोड में तकनीकी सहायता के लिए आधिकारिक सहायता टीम से +91 9456984723 या +91 7500790387 पर संपर्क करें। पता: RB-22, सेक्टर 36, ग्रेटर नोएडा, उत्तर प्रदेश, भारत। सहायता की नवीनतम जानकारी के लिए Contact Us देखें।', updated_at = current_date where id = 70;
update public.gjm_chatbot_faqs set answer_en = 'Contact the official event support team at +91 9456984723 or +91 7500790387. The organization is Maharshi Panini Ved Vedang Vidhyapeeth Gurukul, at RB-22, Sector 36, Greater Noida, Uttar Pradesh, India. See Contact Us for current support information.',
  answer_hi = 'आयोजन की आधिकारिक सहायता टीम से +91 9456984723 या +91 7500790387 पर संपर्क करें। संस्था महर्षि पाणिनि वेद वेदांग विद्यापीठ गुरुकुल है। पता: RB-22, सेक्टर 36, ग्रेटर नोएडा, उत्तर प्रदेश, भारत। सहायता की नवीनतम जानकारी के लिए Contact Us देखें।', updated_at = current_date where id = 78;
update public.gjm_chatbot_faqs set answer_en = 'You can ask this chatbot any event-related question. If you need a person, contact Maharshi Panini Ved Vedang Vidhyapeeth Gurukul at +91 9456984723 or +91 7500790387, or visit RB-22, Sector 36, Greater Noida, Uttar Pradesh, India. See Contact Us for current support information.',
  answer_hi = 'आप इस चैटबॉट से आयोजन से जुड़ा कोई भी प्रश्न पूछ सकते हैं। किसी व्यक्ति से सहायता के लिए महर्षि पाणिनि वेद वेदांग विद्यापीठ गुरुकुल से +91 9456984723 या +91 7500790387 पर संपर्क करें, या RB-22, सेक्टर 36, ग्रेटर नोएडा, उत्तर प्रदेश, भारत स्थित पते पर जाएँ। सहायता की नवीनतम जानकारी के लिए Contact Us देखें।', updated_at = current_date where id = 79;
update public.gjm_chatbot_faqs set answer_en = 'For additional help, contact Maharshi Panini Ved Vedang Vidhyapeeth Gurukul at +91 9456984723 or +91 7500790387. The address is RB-22, Sector 36, Greater Noida, Uttar Pradesh, India. See Contact Us for current support information.',
  answer_hi = 'अतिरिक्त सहायता के लिए महर्षि पाणिनि वेद वेदांग विद्यापीठ गुरुकुल से +91 9456984723 या +91 7500790387 पर संपर्क करें। पता: RB-22, सेक्टर 36, ग्रेटर नोएडा, उत्तर प्रदेश, भारत। सहायता की नवीनतम जानकारी के लिए Contact Us देखें।', updated_at = current_date where id = 80;
