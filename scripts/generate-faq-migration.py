import json
from pathlib import Path

faqs = json.loads(Path("src/data/geetaJayantiFaqs.json").read_text(encoding="utf-8"))
def quote(value):
    return "'" + value.replace("'", "''") + "'"

lines = ["-- Geeta Jayanti chatbot FAQ knowledge base. Safe to reapply.", "create table if not exists public.gjm_chatbot_faqs (", "  id integer primary key check (id between 1 and 80),", "  category text not null, question_en text not null, answer_en text not null,", "  question_hi text not null, answer_hi text not null, keywords jsonb not null default '[]'::jsonb,", "  related_questions jsonb not null default '[]'::jsonb, updated_at date not null default current_date,", "  published boolean not null default true", ");", "alter table public.gjm_chatbot_faqs enable row level security;", "drop policy if exists \"Anyone can read published chatbot FAQs\" on public.gjm_chatbot_faqs;", "create policy \"Anyone can read published chatbot FAQs\" on public.gjm_chatbot_faqs for select to anon, authenticated using (published or public.current_user_role() = 'admin');", "drop policy if exists \"Admins manage chatbot FAQs\" on public.gjm_chatbot_faqs;", "create policy \"Admins manage chatbot FAQs\" on public.gjm_chatbot_faqs for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');", "grant select on public.gjm_chatbot_faqs to anon, authenticated;", "grant insert, update, delete on public.gjm_chatbot_faqs to authenticated;", "insert into public.gjm_chatbot_faqs (id, category, question_en, answer_en, question_hi, answer_hi, keywords, related_questions, updated_at, published) values"]
values = []
for f in faqs:
    values.append("(" + ", ".join([str(f["id"]), quote(f["category"]), quote(f["question_en"]), quote(f["answer_en"]), quote(f["question_hi"]), quote(f["answer_hi"]), quote(json.dumps(f["keywords"], ensure_ascii=False)) + "::jsonb", quote(json.dumps(f["related_questions"])) + "::jsonb", quote(f["updated_at"]), "true"]) + ")")
lines.append(",\n".join(values) + "\non conflict (id) do nothing;")
Path("supabase/geeta_jayanti_chatbot_faqs.sql").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("Generated Supabase chatbot FAQ migration with 80 bilingual rows")
