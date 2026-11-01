-- A separate practice bank. It does not read or write candidate_exam_attempts.
create table if not exists public.gjm_mock_questions (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('Gita Chapters','Kurukshetra and Characters','Krishna–Arjuna Dialogue','Philosophical Concepts','Gita Teachings')),
  question_en text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation_en text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(topic, question_en)
);
alter table public.gjm_mock_questions enable row level security;
drop policy if exists "Admins manage mock practice questions" on public.gjm_mock_questions;
create policy "Admins manage mock practice questions" on public.gjm_mock_questions
  for all to authenticated using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
revoke all on public.gjm_mock_questions from anon, authenticated;
grant select, insert, update, delete on public.gjm_mock_questions to authenticated;

create or replace function public.get_gjm_mock_questions()
returns table(id uuid, topic text, question_en text, options jsonb)
language sql stable security definer set search_path = '' as $$
  select q.id, q.topic, q.question_en, q.options
  from public.gjm_mock_questions q where q.published
  order by extensions.gen_random_uuid() limit 50;
$$;
revoke all on function public.get_gjm_mock_questions() from public;
grant execute on function public.get_gjm_mock_questions() to anon, authenticated;

create or replace function public.submit_gjm_mock_test(p_question_ids uuid[], p_answers jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  q_count integer;
  score integer;
  review jsonb;
  topics jsonb;
begin
  if p_question_ids is null or cardinality(p_question_ids) <> 50 or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Invalid practice test submission';
  end if;
  select count(*) into q_count from public.gjm_mock_questions q
  where q.id = any(p_question_ids) and q.published;
  if q_count <> 50 then raise exception 'Practice test questions are no longer available'; end if;
  select count(*) into score from public.gjm_mock_questions q
  where q.id = any(p_question_ids) and q.published
    and (p_answers ->> q.id::text) ~ '^[0-3]$'
    and (p_answers ->> q.id::text)::smallint = q.correct_index;
  select jsonb_agg(jsonb_build_object(
    'id', q.id, 'topic', q.topic, 'question', q.question_en,
    'options', q.options, 'correctIndex', q.correct_index,
    'selectedIndex', case when (p_answers ->> q.id::text) ~ '^[0-3]$' then (p_answers ->> q.id::text)::int else null end,
    'explanation', q.explanation_en
  ) order by array_position(p_question_ids, q.id)) into review
  from public.gjm_mock_questions q where q.id = any(p_question_ids) and q.published;
  select jsonb_agg(jsonb_build_object('topic', grouped.topic, 'correct', grouped.correct, 'total', grouped.total)) into topics
  from (
    select q.topic, count(*) filter (where (p_answers ->> q.id::text) ~ '^[0-3]$' and (p_answers ->> q.id::text)::smallint = q.correct_index)::int as correct, count(*)::int as total
    from public.gjm_mock_questions q where q.id = any(p_question_ids) and q.published group by q.topic
  ) grouped;
  return jsonb_build_object('score', score, 'total', 50, 'review', coalesce(review, '[]'::jsonb), 'topics', coalesce(topics, '[]'::jsonb));
end;
$$;
revoke all on function public.submit_gjm_mock_test(uuid[], jsonb) from public;
grant execute on function public.submit_gjm_mock_test(uuid[], jsonb) to anon, authenticated;

-- Clearly labeled sample practice material, separate from the official examination bank.
insert into public.gjm_mock_questions(topic, question_en, options, correct_index, explanation_en, published) values
('Gita Chapters','How many chapters are in the Bhagavad Gita?', '["12","16","18","20"]', 2, 'The Bhagavad Gita is traditionally divided into 18 chapters.', true),
('Gita Chapters','Which chapter is commonly titled Arjuna Vishada Yoga?', '["Chapter 1","Chapter 2","Chapter 6","Chapter 18"]', 0, 'The first chapter presents Arjuna’s grief and moral crisis on the battlefield.', true),
('Gita Chapters','Which chapter is commonly titled Sankhya Yoga?', '["Chapter 1","Chapter 2","Chapter 3","Chapter 12"]', 1, 'Chapter 2 is commonly titled Sankhya Yoga and introduces central teachings including the self and disciplined action.', true),
('Gita Chapters','Which chapter is commonly titled Karma Yoga?', '["Chapter 2","Chapter 3","Chapter 4","Chapter 5"]', 1, 'Chapter 3 is commonly known as Karma Yoga and discusses action and duty.', true),
('Gita Chapters','Which chapter is commonly titled Dhyana Yoga?', '["Chapter 4","Chapter 6","Chapter 9","Chapter 12"]', 1, 'Chapter 6 is commonly titled Dhyana Yoga and discusses meditation and self-discipline.', true),
('Gita Chapters','Which chapter contains Krishna’s universal-form revelation to Arjuna?', '["Chapter 7","Chapter 9","Chapter 11","Chapter 15"]', 2, 'Chapter 11 is known as Vishvarupa Darshana Yoga.', true),
('Gita Chapters','Which chapter is commonly titled Bhakti Yoga?', '["Chapter 6","Chapter 10","Chapter 12","Chapter 16"]', 2, 'Chapter 12 discusses devotion and is commonly titled Bhakti Yoga.', true),
('Gita Chapters','Which chapter discusses the three gunas?', '["Chapter 8","Chapter 10","Chapter 14","Chapter 17"]', 2, 'Chapter 14 is commonly titled Gunatraya Vibhaga Yoga and describes sattva, rajas, and tamas.', true),
('Gita Chapters','Which chapter is commonly titled Moksha Sannyasa Yoga?', '["Chapter 12","Chapter 15","Chapter 17","Chapter 18"]', 3, 'The eighteenth and final chapter is commonly titled Moksha Sannyasa Yoga.', true),
('Gita Chapters','In which chapter does Arjuna ask Krishna to explain the imperishable Brahman and remembrance at death?', '["Chapter 3","Chapter 8","Chapter 13","Chapter 16"]', 1, 'Chapter 8, Akshara Brahma Yoga, addresses these questions.', true),
('Gita Chapters','Which chapter is commonly called Vibhuti Yoga?', '["Chapter 7","Chapter 10","Chapter 11","Chapter 14"]', 1, 'Chapter 10 describes divine manifestations and is commonly called Vibhuti Yoga.', true),
('Gita Chapters','Which chapter is commonly titled Raja Vidya Raja Guhya Yoga?', '["Chapter 5","Chapter 8","Chapter 9","Chapter 13"]', 2, 'This is the commonly used title for chapter 9.', true),
('Gita Chapters','Which chapter is commonly titled Jnana Karma Sannyasa Yoga?', '["Chapter 3","Chapter 4","Chapter 5","Chapter 7"]', 1, 'Chapter 4 is commonly titled Jnana Karma Sannyasa Yoga.', true),
('Gita Chapters','Which chapter is commonly titled Karma Sannyasa Yoga?', '["Chapter 3","Chapter 5","Chapter 6","Chapter 8"]', 1, 'Chapter 5 compares renunciation and disciplined action.', true),
('Gita Chapters','Which chapter is commonly titled Jnana Vijnana Yoga?', '["Chapter 4","Chapter 7","Chapter 9","Chapter 13"]', 1, 'Chapter 7 is commonly titled Jnana Vijnana Yoga.', true),
('Gita Chapters','Which chapter compares the world to an ashvattha tree?', '["Chapter 6","Chapter 10","Chapter 13","Chapter 15"]', 3, 'Chapter 15 includes the image of the ashvattha tree.', true),
('Gita Chapters','Which chapter contrasts divine and demonic qualities?', '["Chapter 11","Chapter 14","Chapter 16","Chapter 18"]', 2, 'Chapter 16 is commonly titled Daivasura Sampad Vibhaga Yoga.', true),
('Gita Chapters','Which chapter discusses three kinds of faith?', '["Chapter 9","Chapter 12","Chapter 17","Chapter 18"]', 2, 'Chapter 17 is commonly titled Shraddhatraya Vibhaga Yoga.', true),
('Kurukshetra and Characters','Where does the dialogue of the Bhagavad Gita take place?', '["At a forest hermitage","On the battlefield of Kurukshetra","In a royal court in Dvaraka","On a mountain in the Himalaya"]', 1, 'The dialogue takes place on the battlefield of Kurukshetra before the battle.', true),
('Kurukshetra and Characters','Who asks Krishna for guidance before the battle?', '["Bhima","Arjuna","Yudhishthira","Nakula"]', 1, 'Arjuna asks Krishna for guidance as he faces a moral and emotional crisis.', true),
('Kurukshetra and Characters','What is Krishna’s role in Arjuna’s chariot during the dialogue?', '["Charioteer and guide","Commander of the Pandava army","Messenger for Duryodhana","Royal physician"]', 0, 'Krishna serves as Arjuna’s charioteer and spiritual guide.', true),
('Kurukshetra and Characters','Who narrates the battlefield events to King Dhritarashtra?', '["Sanjaya","Vidura","Bhishma","Drona"]', 0, 'Sanjaya narrates the events to Dhritarashtra.', true),
('Kurukshetra and Characters','What causes Arjuna to hesitate at the start of the Gita?', '["He cannot see the battlefield","He sees relatives, teachers, and friends among those assembled","He has lost his bow","He is asked to leave the army"]', 1, 'Arjuna is distressed by the prospect of fighting people he knows and respects.', true),
('Kurukshetra and Characters','Which bow is associated with Arjuna?', '["Pinaka","Gandiva","Sharanga","Vijaya"]', 1, 'Gandiva is Arjuna’s celebrated bow in the Mahabharata tradition.', true),
('Krishna–Arjuna Dialogue','What is Arjuna’s first response to seeing both armies assembled?', '["He asks to inspect the armies and then becomes distressed","He immediately leaves the battlefield","He begins the battle alone","He asks Sanjaya to lead the chariot"]', 0, 'The opening chapter describes Arjuna asking to see those assembled and then becoming overwhelmed.', true),
('Krishna–Arjuna Dialogue','What does Arjuna ask Krishna to do at the beginning of the battlefield scene?', '["Place the chariot between the two armies","Return to Dvaraka","Hide the army","Speak to Dhritarashtra"]', 0, 'Arjuna asks Krishna to place the chariot between the armies so he can look at those assembled.', true),
('Krishna–Arjuna Dialogue','What is a central purpose of Krishna’s teaching to Arjuna?', '["To guide him through confusion about duty and action","To teach him shipbuilding","To appoint a new king","To explain agricultural seasons"]', 0, 'Krishna responds to Arjuna’s distress with teachings on the self, duty, action, knowledge, and devotion.', true),
('Krishna–Arjuna Dialogue','Who is the king listening to Sanjaya’s account?', '["Pandu","Dhritarashtra","Drupada","Virata"]', 1, 'Sanjaya reports the conversation and battle preparations to the blind king Dhritarashtra.', true),
('Philosophical Concepts','Karma Yoga primarily emphasizes which approach?', '["Disciplined action performed with attention to duty","Avoiding every responsibility","Seeking praise before acting","Collecting possessions"]', 0, 'Karma Yoga teaches a disciplined way of acting rather than escaping all action.', true),
('Philosophical Concepts','Jnana Yoga is most closely associated with which path?', '["Knowledge and discernment","Physical strength alone","Political authority","Musical performance"]', 0, 'Jnana Yoga emphasizes knowledge and understanding.', true),
('Philosophical Concepts','Bhakti Yoga is most closely associated with which path?', '["Devotion","Debate for victory","Wealth accumulation","Silence in every situation"]', 0, 'Bhakti Yoga emphasizes devotion and loving dedication.', true),
('Philosophical Concepts','Sankhya Yoga in the Gita is associated with reflection on which distinction?', '["The self and the body","Two kinds of musical scale","The seasons of the year","Different forms of government"]', 0, 'The Gita’s discussion includes distinguishing the enduring self from the changing body.', true),
('Philosophical Concepts','What does Nishkama Karma refer to in common explanations of the Gita?', '["Action without attachment to its fruits","Action only when praised","Refusing to act","Action for personal reward alone"]', 0, 'Nishkama Karma is commonly explained as action without attachment to its results.', true),
('Philosophical Concepts','Which three gunas are discussed in the Gita?', '["Sattva, rajas, and tamas","Dharma, artha, and kama","Vata, pitta, and kapha","Shruti, smriti, and kavya"]', 0, 'The Gita describes sattva, rajas, and tamas as the three gunas.', true),
('Philosophical Concepts','What is the main practice associated with Dhyana Yoga?', '["Meditative discipline and mental steadiness","Public debate","Collecting ritual objects","Learning military formations"]', 0, 'Chapter 6 presents discipline of the mind and meditation.', true),
('Philosophical Concepts','Which quality is closest to samatva in the Gita?', '["Equanimity","Indifference to learning","Fear of responsibility","Desire for constant praise"]', 0, 'Samatva refers to evenness of mind or equanimity.', true),
('Gita Teachings','In the Gita’s field-and-knower discussion, what does kshetra mean?', '["The field, often explained as the body","A type of bow","A season","A sacred river"]', 0, 'Chapter 13 uses kshetra for the field and kshetrajna for its knower.', true),
('Gita Teachings','What does swadharma commonly mean?', '["One’s own duty","A kind of musical instrument","A place of residence","A type of meditation posture"]', 0, 'Swadharma refers to one’s own duty or responsibility.', true),
('Gita Teachings','What is a student-friendly example of applying Karma Yoga?', '["Do assigned work carefully without making praise the only goal","Avoid homework unless rewarded","Blame others for mistakes","Choose only easy tasks"]', 0, 'The example reflects disciplined effort without making reward or praise the sole motive.', true),
('Gita Teachings','What reminder does the Gita’s teaching on the self and body offer?', '["The body changes, while the self is described as enduring","The body never changes","Learning is unnecessary","People should avoid caring for others"]', 0, 'Chapter 2 teaches that the self is not identical to the changing body.', true),
('Gita Teachings','Which response best reflects equanimity during success and difficulty?', '["Stay steady and continue to act thoughtfully","Celebrate success but give up after a setback","Ignore all responsibilities","Act only when circumstances are easy"]', 0, 'Equanimity means cultivating steadiness through changing outcomes.', true),
('Gita Teachings','Which choice reflects responsible self-discipline for a student?', '["Prepare consistently and complete work honestly","Copy answers to save time","Study only when watched","Avoid asking questions"]', 0, 'Disciplined effort and honesty are practical ways to apply these teachings.', true),
('Gita Teachings','What is the role of guidance in Arjuna’s dialogue with Krishna?', '["It helps Arjuna examine his confusion and responsibilities","It removes the need for Arjuna to think","It gives Arjuna a way to avoid every duty","It decides the battle outcome by itself"]', 0, 'The dialogue models reflection, guidance, and a considered response to duty.', true),
('Kurukshetra and Characters','Which relationship best describes Krishna and Arjuna in the Gita dialogue?', '["Krishna guides Arjuna, who seeks counsel","Arjuna teaches Krishna archery","They are rival kings","Krishna reports to Arjuna as a messenger"]', 0, 'Krishna is Arjuna’s charioteer and guide; Arjuna asks him questions.', true),
('Gita Chapters','Which chapter is commonly titled Kshetra Kshetrajna Vibhaga Yoga?', '["Chapter 10","Chapter 13","Chapter 15","Chapter 17"]', 1, 'Chapter 13 is commonly titled Kshetra Kshetrajna Vibhaga Yoga.', true),
('Gita Chapters','Which chapter is commonly titled Purushottama Yoga?', '["Chapter 12","Chapter 14","Chapter 15","Chapter 16"]', 2, 'Chapter 15 is commonly titled Purushottama Yoga.', true),
('Gita Chapters','Which chapter is commonly titled Daivasura Sampad Vibhaga Yoga?', '["Chapter 8","Chapter 11","Chapter 16","Chapter 17"]', 2, 'Chapter 16 discusses divine and demonic qualities.', true),
('Krishna–Arjuna Dialogue','How does the Gita’s dialogue conclude for Arjuna?', '["He says his confusion has been dispelled and that he will act according to Krishna’s instruction","He leaves without hearing Krishna","He asks Sanjaya to decide for him","He refuses to speak again"]', 0, 'At the end of chapter 18, Arjuna says his delusion is gone and that he will act as instructed.', true),
('Philosophical Concepts','What does the Gita advise about the fruits of one’s actions?', '["Do not make attachment to results the sole basis of action","Never plan or prepare","Results are always guaranteed","Only act when success is certain"]', 0, 'The Gita teaches disciplined action without attachment to its fruits; it does not say to avoid preparation.', true),
('Gita Teachings','Which practice best combines study and reflection?', '["Read a passage carefully, ask questions, and consider how to apply its ideas","Memorize words without understanding","Assume every online summary is authoritative","Skip unfamiliar parts"]', 0, 'Careful study, questions, and thoughtful application help students engage with a text.', true)
on conflict (topic, question_en) do nothing;
