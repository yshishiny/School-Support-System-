-- Sixty-nine foreign keys with no covering index.
--
-- Postgres does not index a foreign key for you. Every one of these makes the parent's delete take a sequential
-- scan of the child table, and every join through the key does the same. It has never shown, because the largest
-- table in this database held 459 rows — and it was about to, because the curriculum just went from 190 topics
-- to more than fourteen hundred, with six tables pointing at it.
--
-- This is the performance work that a separate curriculum server would not have done.
create index if not exists access_grants_created_by_fkey_idx on public.access_grants (created_by);
create index if not exists access_grants_student_id_fkey_idx on public.access_grants (student_id);
create index if not exists access_invites_accepted_family_id_fkey_idx on public.access_invites (accepted_family_id);
create index if not exists access_invites_created_by_fkey_idx on public.access_invites (created_by);
create index if not exists allowance_weeks_family_id_fkey_idx on public.allowance_weeks (family_id);
create index if not exists app_errors_family_id_fkey_idx on public.app_errors (family_id);
create index if not exists app_errors_user_id_fkey_idx on public.app_errors (user_id);
create index if not exists assignments_created_by_fkey_idx on public.assignments (created_by);
create index if not exists assignments_subject_id_fkey_idx on public.assignments (subject_id);
create index if not exists attempt_answers_question_id_fkey_idx on public.attempt_answers (question_id);
create index if not exists attempts_quiz_id_fkey_idx on public.attempts (quiz_id);
create index if not exists attention_snapshots_family_id_fkey_idx on public.attention_snapshots (family_id);
create index if not exists chat_archives_student_id_fkey_idx on public.chat_archives (student_id);
create index if not exists chat_archives_uploaded_by_fkey_idx on public.chat_archives (uploaded_by);
create index if not exists checkin_items_assignment_id_fkey_idx on public.checkin_items (assignment_id);
create index if not exists checkpoints_family_id_fkey_idx on public.checkpoints (family_id);
create index if not exists checkpoints_quiz_id_fkey_idx on public.checkpoints (quiz_id);
create index if not exists checkpoints_requested_by_fkey_idx on public.checkpoints (requested_by);
create index if not exists clinician_reports_family_id_fkey_idx on public.clinician_reports (family_id);
create index if not exists coach_reports_family_id_fkey_idx on public.coach_reports (family_id);
create index if not exists consequences_family_id_fkey_idx on public.consequences (family_id);
create index if not exists credit_entries_granted_by_fkey_idx on public.credit_entries (granted_by);
create index if not exists custody_overrides_parent_id_fkey_idx on public.custody_overrides (parent_id);
create index if not exists family_invites_created_by_fkey_idx on public.family_invites (created_by);
create index if not exists family_invites_used_by_fkey_idx on public.family_invites (used_by);
create index if not exists grade_sheets_family_id_fkey_idx on public.grade_sheets (family_id);
create index if not exists hero_images_family_id_fkey_idx on public.hero_images (family_id);
create index if not exists hero_images_uploaded_by_fkey_idx on public.hero_images (uploaded_by);
create index if not exists integrity_followups_family_id_fkey_idx on public.integrity_followups (family_id);
create index if not exists kpi_ticks_family_id_fkey_idx on public.kpi_ticks (family_id);
create index if not exists kpi_ticks_ticked_by_fkey_idx on public.kpi_ticks (ticked_by);
create index if not exists late_compensations_family_id_fkey_idx on public.late_compensations (family_id);
create index if not exists lesson_logs_assignment_id_fkey_idx on public.lesson_logs (assignment_id);
create index if not exists lesson_logs_topic_id_fkey_idx on public.lesson_logs (topic_id);
create index if not exists lesson_questions_session_id_fkey_idx on public.lesson_questions (session_id);
create index if not exists lesson_questions_student_id_fkey_idx on public.lesson_questions (student_id);
create index if not exists lesson_sessions_family_id_fkey_idx on public.lesson_sessions (family_id);
create index if not exists lesson_sessions_quiz_id_fkey_idx on public.lesson_sessions (quiz_id);
create index if not exists lesson_sessions_script_id_fkey_idx on public.lesson_sessions (script_id);
create index if not exists materials_uploaded_by_fkey_idx on public.materials (uploaded_by);
create index if not exists parent_notifications_family_id_fkey_idx on public.parent_notifications (family_id);
create index if not exists places_student_id_fkey_idx on public.places (student_id);
create index if not exists profiles_avatar_image_id_fkey_idx on public.profiles (avatar_image_id);
create index if not exists profiles_banner_image_id_fkey_idx on public.profiles (banner_image_id);
create index if not exists profiles_target_reward_id_fkey_idx on public.profiles (target_reward_id);
create index if not exists quizzes_checkpoint_id_fkey_idx on public.quizzes (checkpoint_id);
create index if not exists quizzes_topic_id_fkey_idx on public.quizzes (topic_id);
create index if not exists redemptions_reward_id_fkey_idx on public.redemptions (reward_id);
create index if not exists redemptions_student_id_fkey_idx on public.redemptions (student_id);
create index if not exists review_queue_question_id_fkey_idx on public.review_queue (question_id);
create index if not exists revision_sheets_family_id_fkey_idx on public.revision_sheets (family_id);
create index if not exists revision_sheets_quiz_id_fkey_idx on public.revision_sheets (quiz_id);
create index if not exists rewards_family_id_fkey_idx on public.rewards (family_id);
create index if not exists safety_alerts_student_id_fkey_idx on public.safety_alerts (student_id);
create index if not exists snap_tasks_student_id_fkey_idx on public.snap_tasks (student_id);
create index if not exists snaps_rater_id_fkey_idx on public.snaps (rater_id);
create index if not exists snaps_reviewed_by_fkey_idx on public.snaps (reviewed_by);
create index if not exists snaps_task_id_fkey_idx on public.snaps (task_id);
create index if not exists source_findings_source_id_fkey_idx on public.source_findings (source_id);
create index if not exists sources_family_id_fkey_idx on public.sources (family_id);
create index if not exists sources_student_id_fkey_idx on public.sources (student_id);
create index if not exists topic_flags_topic_id_fkey_idx on public.topic_flags (topic_id);
create index if not exists topics_family_id_fkey_idx on public.topics (family_id);
create index if not exists wallet_entries_claim_decided_by_fkey_idx on public.wallet_entries (claim_decided_by);
create index if not exists wallet_entries_created_by_fkey_idx on public.wallet_entries (created_by);
create index if not exists whatsapp_imports_family_id_fkey_idx on public.whatsapp_imports (family_id);
create index if not exists whatsapp_imports_imported_by_fkey_idx on public.whatsapp_imports (imported_by);
create index if not exists whatsapp_imports_student_id_fkey_idx on public.whatsapp_imports (student_id);
