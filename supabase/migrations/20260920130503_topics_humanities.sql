-- Languages and humanities for both curricula, and the remaining core subjects.
create or replace function pg_temp.seed_topics(
  p_curriculum text, p_grade int, p_stream text, p_subject text, p_language text, p_units jsonb
) returns int language plpgsql as $fn$
declare n int;
begin
  insert into public.topics (curriculum_id, grade, stream, subject, unit, name, language, track, sort, family_id)
  select p_curriculum, p_grade, p_stream, p_subject, el->>'unit', t.name, p_language, 'school',
         (e.ord * 100 + t.ord)::int, null
  from jsonb_array_elements(p_units) with ordinality as e(el, ord)
  cross join lateral jsonb_array_elements_text(el->'topics') with ordinality as t(name, ord)
  on conflict do nothing;
  get diagnostics n = row_count; return n;
end $fn$;

select pg_temp.seed_topics('american', 6, null, 'English Language Arts', 'en', '[
 {"unit":"Reading Literature","topics":["Theme and central idea","Plot structure and conflict","Character development","Point of view","Figurative language and imagery"]},
 {"unit":"Reading Informational Text","topics":["Main idea and supporting details","Text structure","Author purpose and perspective","Evaluating evidence and claims"]},
 {"unit":"Writing","topics":["Argumentative writing","Informative and explanatory writing","Narrative writing","The writing process: drafting and revising","Research and citing sources"]},
 {"unit":"Language","topics":["Pronouns and their cases","Commas, parentheses and dashes","Varying sentence patterns","Context clues and word meaning","Figures of speech and connotation"]}]'::jsonb);
select pg_temp.seed_topics('american', 7, null, 'English Language Arts', 'en', '[
 {"unit":"Reading Literature","topics":["Analysing theme development","Comparing texts across forms","Character interaction and plot","Rhyme, rhythm and structure in poetry","Drama: dialogue and stage direction"]},
 {"unit":"Reading Informational Text","topics":["Tracing an argument","Analysing text interactions","Comparing authors on the same subject","Technical and domain-specific vocabulary"]},
 {"unit":"Writing","topics":["Argument with acknowledged counterclaims","Explanatory essay with transitions","Narrative with pacing and reflection","Research with multiple sources","Assessing source credibility"]},
 {"unit":"Language","topics":["Phrases and clauses","Simple, compound and complex sentences","Correcting misplaced modifiers","Coordinate adjectives and commas","Word relationships and nuance"]}]'::jsonb);
select pg_temp.seed_topics('american', 8, null, 'English Language Arts', 'en', '[
 {"unit":"Reading Literature","topics":["Theme across a whole text","Analysing dialogue and incident","Comparing a text to its film adaptation","Modern fiction drawing on myth","Irony, humour and tone"]},
 {"unit":"Reading Informational Text","topics":["Evaluating argument and sufficiency of evidence","Conflicting information across sources","Analogies and allusions","Analysing text structure for effect"]},
 {"unit":"Writing","topics":["Argumentative essay with distinguished claims","Informative writing with precise language","Narrative with descriptive detail","Sustained research project","Avoiding plagiarism"]},
 {"unit":"Language","topics":["Verbals: gerunds, participles, infinitives","Active and passive voice","Verb mood and shifts","Ellipsis and punctuation for pause","Denotation, connotation and etymology"]}]'::jsonb);
select pg_temp.seed_topics('american', 9, null, 'English 9', 'en', '[
 {"unit":"Literary Analysis","topics":["Close reading and textual evidence","Theme and its development","Complex characters and motivation","Structure, order and pacing","Word choice, tone and mood","Introduction to Shakespeare"]},
 {"unit":"Informational and Argument","topics":["Delineating an argument","Rhetoric: ethos, pathos, logos","Seminal US documents","Analysing multiple mediums"]},
 {"unit":"Writing and Research","topics":["Argument with valid reasoning","Explanatory writing with formatting","Narrative technique and sequencing","Short research project","Integrating and citing evidence"]},
 {"unit":"Language and Speaking","topics":["Parallel structure","Phrases and clauses for variety","Semicolons and colons","Collaborative discussion","Formal presentation"]}]'::jsonb);
select pg_temp.seed_topics('american', 10, null, 'English 10', 'en', '[
 {"unit":"World Literature","topics":["World literature in translation","Cultural context and perspective","Parallel plots and subplots","Point of view and cultural experience","Comparing source material and its treatment"]},
 {"unit":"Argument and Rhetoric","topics":["Evaluating reasoning and false statements","Analysing landmark speeches","Comparing accounts across mediums","Author claims and counterclaims"]},
 {"unit":"Writing and Research","topics":["Argumentative essay with cohesion","Explanatory synthesis","Narrative with reflection","Sustained research with multiple sources","Assessing usefulness of a source"]},
 {"unit":"Language","topics":["Phrases and clauses in complex sentences","Colons and lists","Domain-specific vocabulary","Hyperbole, paradox and understatement"]}]'::jsonb);
select pg_temp.seed_topics('american', 11, null, 'English 11', 'en', '[
 {"unit":"American Literature","topics":["Early American and colonial writing","Romanticism and transcendentalism","Realism and naturalism","The Harlem Renaissance","Modern and contemporary American voices","Analysing an authors choices over a whole text"]},
 {"unit":"Rhetoric and Argument","topics":["Foundational US documents","Analysing rhetorical effectiveness","Evaluating premises and purposes","Multiple interpretations of a text"]},
 {"unit":"Writing and Research","topics":["Argument with thorough counterclaim analysis","Explanatory writing with complex ideas","Narrative with multiple plot lines","Research synthesising several sources","Managing bias in sources"]},
 {"unit":"Language","topics":["Usage as a matter of convention","Hyphenation conventions","Nuance in word meaning","Syntax for effect"]}]'::jsonb);
select pg_temp.seed_topics('american', 12, null, 'English 12', 'en', '[
 {"unit":"British and World Literature","topics":["Anglo-Saxon and medieval literature","Shakespearean tragedy","Seventeenth and eighteenth century writing","Romantic poetry","Victorian and modern literature","Postcolonial and global voices"]},
 {"unit":"Advanced Argument","topics":["Constructing a sustained argument","Analysing rhetoric in public discourse","Synthesising conflicting viewpoints","Logical fallacies"]},
 {"unit":"Writing and Research","topics":["Independent research paper","Literary criticism and interpretation","College application and professional writing","Revision for precision and voice"]},
 {"unit":"Language and Speaking","topics":["Style and register","Editing for concision","Formal presentation with evidence","Adapting speech to purpose"]}]'::jsonb);
select pg_temp.seed_topics('american', 6, null, 'Social Studies', 'en', '[
 {"unit":"Early Civilisations","topics":["Prehistory and the Neolithic revolution","Mesopotamia","Ancient Egypt","Ancient India and China"]},
 {"unit":"Classical Civilisations","topics":["Ancient Greece: city-states and democracy","Greek thought and legacy","The Roman Republic","The Roman Empire and its fall"]},
 {"unit":"Geography and Civics","topics":["Reading maps and geographic tools","Physical and human geography","Government, citizenship and rights","Economic basics: scarcity and trade"]}]'::jsonb);
select pg_temp.seed_topics('american', 7, null, 'Social Studies', 'en', '[
 {"unit":"The Medieval World","topics":["Byzantine Empire","The rise and spread of Islam","Medieval Europe and feudalism","African kingdoms","Imperial China and Japan","The Americas before contact"]},
 {"unit":"Renaissance to Revolution","topics":["Renaissance and Reformation","Age of exploration","Scientific revolution","The Enlightenment"]},
 {"unit":"Geography and Economics","topics":["Regions and cultural diffusion","Population and migration","Resources and trade networks"]}]'::jsonb);
select pg_temp.seed_topics('american', 8, null, 'Social Studies', 'en', '[
 {"unit":"Founding the United States","topics":["Colonial America","Causes of the American Revolution","The Revolutionary War","The Articles of Confederation","The Constitutional Convention","The Bill of Rights"]},
 {"unit":"The New Nation","topics":["Early presidencies and political parties","Westward expansion and manifest destiny","Industrial and market revolution","Reform movements and abolition"]},
 {"unit":"Civil War and Reconstruction","topics":["Causes of the Civil War","Major events of the war","Reconstruction and its end","Civics: the three branches and federalism"]}]'::jsonb);
select pg_temp.seed_topics('american', 9, null, 'World History', 'en', '[
 {"unit":"Foundations","topics":["River valley civilisations","Classical Greece and Rome","Major world religions and belief systems","Trade routes and cultural exchange"]},
 {"unit":"Post-Classical World","topics":["Islamic golden age","Medieval Europe","Mongol empire","African and Asian empires","The Americas before 1492"]},
 {"unit":"Early Modern World","topics":["Renaissance and Reformation","Age of exploration and the Columbian exchange","Gunpowder empires","Scientific revolution and Enlightenment","Atlantic slave trade"]}]'::jsonb);
select pg_temp.seed_topics('american', 10, null, 'World History II', 'en', '[
 {"unit":"Revolutions and Industry","topics":["American and French revolutions","Latin American independence","The Industrial Revolution","Nationalism and unification","Imperialism in Africa and Asia"]},
 {"unit":"Global Conflict","topics":["Causes and course of the First World War","The Russian Revolution","The interwar years and the Great Depression","Rise of totalitarianism","The Second World War","The Holocaust"]},
 {"unit":"The Contemporary World","topics":["The Cold War","Decolonisation","Globalisation and the world economy","Human rights and international institutions","Contemporary conflicts and challenges"]}]'::jsonb);
select pg_temp.seed_topics('american', 11, null, 'US History', 'en', '[
 {"unit":"Reconstruction to 1900","topics":["Reconstruction and its legacy","Industrialisation and big business","Immigration and urbanisation","The Gilded Age and reform","The closing of the frontier"]},
 {"unit":"Modern America Emerges","topics":["Progressive era reforms","American imperialism","The United States in the First World War","The 1920s and cultural change","The Great Depression and the New Deal"]},
 {"unit":"Global Power","topics":["The Second World War at home and abroad","The Cold War and containment","Civil rights movement","Vietnam and social change","Conservative resurgence"]},
 {"unit":"Contemporary America","topics":["End of the Cold War","Globalisation and the digital age","September 11 and its aftermath","Contemporary political and social issues"]}]'::jsonb);
select pg_temp.seed_topics('american', 12, null, 'Government and Economics', 'en', '[
 {"unit":"Foundations of Government","topics":["Types of government and political theory","The Constitution and its principles","Federalism","Civil liberties and civil rights"]},
 {"unit":"Institutions","topics":["The legislative branch","The executive branch","The judicial branch and judicial review","Bureaucracy and policy-making"]},
 {"unit":"Political Participation","topics":["Elections and campaigns","Political parties and interest groups","Public opinion and the media","Voting rights and behaviour"]},
 {"unit":"Microeconomics","topics":["Scarcity, choice and opportunity cost","Supply and demand","Market equilibrium and price","Market structures","Labour markets"]},
 {"unit":"Macroeconomics","topics":["GDP and measuring the economy","Inflation and unemployment","Fiscal policy","Monetary policy and the Federal Reserve","International trade and exchange rates","Personal finance and credit"]}]'::jsonb);
select pg_temp.seed_topics('american', 6, null, 'Computer Science', 'en', '[
 {"unit":"Computing Basics","topics":["Hardware, software and input-output","Files, folders and storage","Internet safety and digital citizenship"]},
 {"unit":"Programming","topics":["Block-based sequencing","Loops","Conditionals","Events and simple games"]},
 {"unit":"Data","topics":["Collecting and sorting data","Charts and simple visualisation"]}]'::jsonb);
select pg_temp.seed_topics('american', 7, null, 'Computer Science', 'en', '[
 {"unit":"Computing Systems","topics":["How networks move data","Binary and data representation","Troubleshooting a system"]},
 {"unit":"Programming","topics":["Variables and expressions","Nested loops","Functions and reuse","Lists","Debugging strategies"]},
 {"unit":"Impact","topics":["Algorithms in everyday life","Privacy and personal data"]}]'::jsonb);
select pg_temp.seed_topics('american', 8, null, 'Computer Science', 'en', '[
 {"unit":"Computing Systems","topics":["Hardware and software","How the internet works","Data representation: binary and encoding","Digital citizenship and safety"]},
 {"unit":"Programming","topics":["Sequencing and variables","Conditionals","Loops and iteration","Functions and parameters","Lists and data structures","Debugging and testing"]},
 {"unit":"Data and Impact","topics":["Collecting and visualising data","Algorithms and efficiency","Artificial intelligence basics","Ethics and bias in computing"]}]'::jsonb);
select pg_temp.seed_topics('american', 9, null, 'Computer Science', 'en', '[
 {"unit":"Programming Foundations","topics":["Data types and variables","Control flow","Functions and scope","Arrays and lists","Strings and text processing","Testing and debugging"]},
 {"unit":"Algorithms and Data","topics":["Searching and sorting","Algorithmic efficiency","Databases and queries","Data visualisation"]},
 {"unit":"Computing and Society","topics":["Cybersecurity basics","Artificial intelligence and machine learning","Ethics, bias and accountability"]}]'::jsonb);
select pg_temp.seed_topics('american', 10, null, 'Computer Science', 'en', '[
 {"unit":"Object-Oriented Programming","topics":["Classes and objects","Methods and parameters","Inheritance","Encapsulation and abstraction"]},
 {"unit":"Data Structures","topics":["Two-dimensional arrays","Stacks and queues","Recursion","Searching and sorting algorithms"]},
 {"unit":"Software Practice","topics":["Version control","Reading and writing documentation","Testing and code review"]}]'::jsonb);
select pg_temp.seed_topics('american', 6, null, 'Art', 'en', '[
 {"unit":"Elements and Principles","topics":["Line, shape and form","Colour theory","Texture and value","Composition and balance"]},
 {"unit":"Making and Responding","topics":["Drawing from observation","Working in a chosen medium","Describing and critiquing artwork","Art across cultures and periods"]}]'::jsonb);

-- ── Egyptian Arabic, social studies, religion and the literary stream ────────
select pg_temp.seed_topics('egyptian_national', 7, null, 'Arabic', 'ar', '[
 {"unit":"القراءة والنصوص","topics":["القراءة المتحررة وفهم المقروء","النصوص الشعرية وشرحها","النصوص النثرية","الاستيعاب والاستنتاج"]},
 {"unit":"النحو","topics":["الجملة الاسمية والفعلية","المبتدأ والخبر","كان وأخواتها","إن وأخواتها","الفاعل ونائب الفاعل","المفعول به"]},
 {"unit":"الصرف والإملاء","topics":["الهمزة المتوسطة والمتطرفة","التاء المربوطة والمفتوحة","علامات الترقيم"]},
 {"unit":"التعبير والأدب","topics":["التعبير الوظيفي","التعبير الإبداعي","القصة المقررة"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 8, null, 'Arabic', 'ar', '[
 {"unit":"القراءة والنصوص","topics":["النصوص الشعرية وتحليلها","النصوص النثرية","الصور البيانية في النص","القراءة النقدية"]},
 {"unit":"النحو","topics":["المفاعيل: المطلق ولأجله وفيه","الحال","التمييز","الاستثناء","النعت والتوكيد والبدل"]},
 {"unit":"البلاغة","topics":["التشبيه","الاستعارة","الكناية","الطباق والمقابلة"]},
 {"unit":"التعبير والأدب","topics":["التعبير الوظيفي والإبداعي","القصة المقررة"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 9, null, 'Arabic', 'ar', '[
 {"unit":"القراءة والنصوص","topics":["تحليل النص الشعري","تحليل النص النثري","الأساليب الخبرية والإنشائية"]},
 {"unit":"النحو","topics":["الممنوع من الصرف","الأسماء الخمسة","الاسم المقصور والمنقوص والممدود","الإعراب التقديري","أسلوب الشرط","العدد وتمييزه"]},
 {"unit":"البلاغة","topics":["الخبر والإنشاء","المحسنات البديعية","الصور الخيالية وأثرها"]},
 {"unit":"التعبير والأدب","topics":["مقال وتلخيص","القصة المقررة"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 7, null, 'Social Studies', 'ar', '[
 {"unit":"الجغرافيا","topics":["موقع مصر وأهميته","التضاريس في مصر","المناخ والنبات الطبيعي","السكان والعمران","الموارد الاقتصادية"]},
 {"unit":"التاريخ","topics":["مصر القديمة: الدولة القديمة","الدولة الوسطى","الدولة الحديثة","الحضارة المصرية القديمة: الدين والفنون"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 8, null, 'Social Studies', 'ar', '[
 {"unit":"الجغرافيا","topics":["الوطن العربي: الموقع والمساحة","مظاهر السطح في الوطن العربي","المناخ والأقاليم النباتية","السكان في الوطن العربي","الموارد والأنشطة الاقتصادية"]},
 {"unit":"التاريخ","topics":["مصر في العصر اليوناني الروماني","الفتح الإسلامي لمصر","مصر في العصر الأموي والعباسي","الدولة الطولونية والإخشيدية","الدولة الفاطمية"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 9, null, 'Social Studies', 'ar', '[
 {"unit":"الجغرافيا","topics":["قارات العالم","الموقع والسكان في العالم","الموارد الطبيعية والتنمية","المشكلات البيئية العالمية"]},
 {"unit":"التاريخ","topics":["الدولة الأيوبية","دولة المماليك","الحروب الصليبية","مصر تحت الحكم العثماني","الحملة الفرنسية على مصر"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 10, null, 'History', 'ar', '[
 {"unit":"الحضارات القديمة","topics":["مفهوم التاريخ ومصادره","حضارة مصر القديمة","حضارات الشرق الأدنى","الحضارة اليونانية والرومانية"]},
 {"unit":"العصر الإسلامي","topics":["شبه الجزيرة العربية قبل الإسلام","الدعوة الإسلامية والدولة في المدينة","الخلفاء الراشدون","الدولة الأموية","الدولة العباسية والحضارة الإسلامية"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 10, null, 'Geography', 'ar', '[
 {"unit":"الجغرافيا الطبيعية","topics":["الأرض وحركاتها","الغلاف الصخري والتضاريس","الغلاف الجوي والمناخ","الغلاف المائي"]},
 {"unit":"الجغرافيا البشرية","topics":["توزيع السكان في العالم","الهجرة ونموها","العمران الريفي والحضري","الأنشطة الاقتصادية","الخرائط ومهارات قراءتها"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 10, null, 'Philosophy and Logic', 'ar', '[
 {"unit":"الفلسفة","topics":["ما الفلسفة ولماذا ندرسها","نشأة التفكير الفلسفي","الفلسفة والعلم والدين"]},
 {"unit":"المنطق","topics":["التفكير الصحيح وقواعده","الحد والتعريف","القضية وأنواعها","مغالطات التفكير الشائعة"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 11, 'literary', 'History', 'ar', '[
 {"unit":"مصر الحديثة","topics":["الحملة الفرنسية وأثرها","محمد علي وبناء الدولة الحديثة","خلفاء محمد علي","الاحتلال البريطاني لمصر","الحركة الوطنية المصرية","ثورة 1919"]},
 {"unit":"العالم الحديث","topics":["الثورة الصناعية","الاستعمار الأوروبي","الحرب العالمية الأولى","الحرب العالمية الثانية"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 11, 'literary', 'Geography', 'ar', '[
 {"unit":"جغرافيا التنمية","topics":["مفهوم التنمية ومؤشراتها","الموارد الطبيعية والبشرية","التنمية الزراعية","التنمية الصناعية","التنمية السياحية"]},
 {"unit":"جغرافيا مصر","topics":["الموقع الجغرافي والاستراتيجي","المشروعات القومية","التوزيع السكاني ومشكلاته","التجارة والنقل"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 11, 'literary', 'Philosophy and Logic', 'ar', '[
 {"unit":"الفلسفة","topics":["مفهوم الفلسفة ونشأتها","الفلسفة اليونانية","الفلسفة الإسلامية","الفلسفة الحديثة","مباحث الفلسفة: الوجود والمعرفة والقيم"]},
 {"unit":"المنطق","topics":["مفهوم المنطق وأهميته","التصورات والحدود","القضايا وأنواعها","الاستدلال المباشر","القياس وأشكاله","الاستقراء"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 11, 'literary', 'Psychology and Sociology', 'ar', '[
 {"unit":"علم النفس","topics":["مفهوم علم النفس ومناهجه","الدوافع والحاجات","الإدراك والانتباه","التعلم والذاكرة","الشخصية ونظرياتها","الصحة النفسية"]},
 {"unit":"علم الاجتماع","topics":["مفهوم علم الاجتماع ونشأته","الظاهرة الاجتماعية","التنشئة الاجتماعية","الجماعات والمؤسسات","التغير الاجتماعي","المشكلات الاجتماعية"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 11, 'literary', 'Applied Mathematics', 'ar', '[
 {"unit":"الإحصاء","topics":["جمع البيانات وعرضها","مقاييس النزعة المركزية","مقاييس التشتت","الارتباط والانحدار"]},
 {"unit":"الرياضيات المالية","topics":["النسبة المئوية والفائدة","الأقساط والقروض","الميزانية الشخصية"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 12, 'literary', 'History', 'ar', '[
 {"unit":"مصر في القرن العشرين","topics":["مصر بين الحربين","معاهدة 1936","ثورة 23 يوليو 1952","العدوان الثلاثي 1956","الوحدة المصرية السورية","نكسة 1967 وحرب الاستنزاف","نصر أكتوبر 1973"]},
 {"unit":"القضايا العربية والعالمية","topics":["القضية الفلسطينية","جامعة الدول العربية","الحرب الباردة","حركات التحرر في أفريقيا وآسيا"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 12, 'literary', 'Geography', 'ar', '[
 {"unit":"الجغرافيا السياسية","topics":["مفهوم الجغرافيا السياسية","الدولة ومقوماتها","الحدود السياسية","الأهمية الاستراتيجية لمصر","قناة السويس","المياه ومشكلاتها في الوطن العربي"]},
 {"unit":"الجغرافيا الاقتصادية","topics":["الموارد المعدنية والطاقة","التجارة الدولية","النقل والاتصالات","التكتلات الاقتصادية"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 12, 'literary', 'Philosophy and Logic', 'ar', '[
 {"unit":"الفلسفة","topics":["فلسفة القيم: الحق والخير والجمال","قضايا فلسفية معاصرة","فلسفة العلم","الفلسفة والدين"]},
 {"unit":"المنطق","topics":["المنطق الرمزي","منطق القضايا","الاستدلال الرياضي","مناهج البحث العلمي"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 12, 'literary', 'Psychology and Sociology', 'ar', '[
 {"unit":"علم النفس","topics":["الذكاء والقدرات العقلية","الانفعالات","الإبداع والتفكير","علم النفس التطبيقي","اضطرابات السلوك"]},
 {"unit":"علم الاجتماع","topics":["مناهج البحث الاجتماعي","الثقافة والمجتمع","التنمية والمجتمع","العولمة وأثرها","قضايا الشباب"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 7, null, 'Religion', 'ar', '[
 {"unit":"القرآن الكريم","topics":["سور وآيات مقررة للحفظ","تفسير الآيات","أحكام التلاوة"]},
 {"unit":"العقيدة والعبادات","topics":["أركان الإيمان","الطهارة والصلاة","الصوم والزكاة"]},
 {"unit":"السيرة والأخلاق","topics":["السيرة النبوية","الأحاديث الشريفة","الأخلاق والآداب الإسلامية"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 8, null, 'Religion', 'ar', '[
 {"unit":"القرآن الكريم","topics":["سور وآيات مقررة للحفظ","تفسير الآيات","أحكام التجويد"]},
 {"unit":"العقيدة والعبادات","topics":["الإيمان بالكتب والرسل","الحج والعمرة","المعاملات في الإسلام"]},
 {"unit":"السيرة والأخلاق","topics":["غزوات الرسول","الصحابة وسيرهم","قيم العمل والأمانة"]}]'::jsonb);
select pg_temp.seed_topics('egyptian_national', 9, null, 'Religion', 'ar', '[
 {"unit":"القرآن الكريم","topics":["سور وآيات مقررة للحفظ","تفسير الآيات","أحكام الوقف والابتداء"]},
 {"unit":"العقيدة والعبادات","topics":["الإيمان بالقضاء والقدر","فقه الأسرة","الحلال والحرام في الكسب"]},
 {"unit":"السيرة والأخلاق","topics":["الفتوحات الإسلامية","حقوق الإنسان في الإسلام","التسامح والتعايش"]}]'::jsonb);

-- Arabic and English run on the same strands at every secondary level; the texts change, the strands do not.
insert into public.topics (curriculum_id, grade, stream, subject, unit, name, language, track, sort, family_id)
select 'egyptian_national', lv.grade, lv.stream, 'Arabic', u.unit, t.name, 'ar', 'school',
       (u.ord * 100 + t.ord)::int, null
from (select grade, stream from public.curriculum_levels
      where curriculum_id = 'egyptian_national' and grade >= 10) lv
cross join (values
  ('القراءة والنصوص', array['تحليل النص الشعري','تحليل النص النثري','الأدب والنقد','القراءة المقررة'], 1),
  ('النحو',           array['الإعراب والبناء','الأساليب النحوية','التوابع','الممنوع من الصرف','أسلوب الشرط'], 2),
  ('البلاغة',         array['علم المعاني','علم البيان','علم البديع'], 3),
  ('التعبير',         array['المقال','التلخيص','التعبير الوظيفي'], 4)
) as u(unit, names, ord)
cross join lateral unnest(u.names) with ordinality as t(name, ord)
on conflict do nothing;

insert into public.topics (curriculum_id, grade, stream, subject, unit, name, language, track, sort, family_id)
select 'egyptian_national', lv.grade, lv.stream, 'English', u.unit, t.name, 'en', 'school',
       (u.ord * 100 + t.ord)::int, null
from (select grade, stream from public.curriculum_levels
      where curriculum_id = 'egyptian_national' and grade >= 7) lv
cross join (values
  ('Reading',  array['Reading for main idea','Reading for detail','Vocabulary in context','Set literature reader'], 1),
  ('Grammar',  array['Tenses and time reference','Modals','Passive voice','Reported speech','Conditionals','Relative clauses'], 2),
  ('Writing',  array['Paragraph writing','Letters and emails','Reports and articles','Essay writing'], 3),
  ('Listening and Speaking', array['Everyday functions and dialogue','Pronunciation and stress'], 4)
) as u(unit, names, ord)
cross join lateral unnest(u.names) with ordinality as t(name, ord)
on conflict do nothing;
