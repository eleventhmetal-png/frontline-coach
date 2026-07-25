-- Frontline Coach — mark the existing CCW GM pilot testers, plus Ben's own
-- account, as internal.
--
-- The 6 GMs are the CEO-sanctioned internal pilot (see NDA consent letter);
-- bryan8221@gmail.com is Ben's own account, used for testing, not an
-- external beta participant. None of these count against the 30-person
-- external beta cohort. Excluding them here keeps them from counting
-- against the cap enforced in handle_new_user() (see 20260724000000_beta_gate.sql).

update public.profiles
set is_internal_pilot = true
where email in (
  'gtyler338@gmail.com',
  'daniel.horack31@gmail.com',
  'whitechoclate265@gmail.com',
  'spencermlittlejohn@gmail.com',
  'goodenbell22@gmail.com',
  'darielg132@gmail.com',
  'bryan8221@gmail.com'
);
