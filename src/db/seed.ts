import { addDays, setHours, setMinutes, startOfDay } from 'date-fns'
import { toISODate } from '../lib/date'
import { createMeeting, createNote, createProject, createTask, setTaskStatus } from './actions'
import { db } from './db'

const at = (dayOffset: number, hour: number, minute = 0) =>
  setMinutes(setHours(startOfDay(addDays(new Date(), dayOffset)), hour), minute).getTime()

const on = (dayOffset: number) => toISODate(addDays(new Date(), dayOffset))

/**
 * A small, realistic multi-project workspace so the app has something to say on
 * first open. Everything is dated relative to now, so it never looks stale.
 */
export async function seedSampleWorkspace() {
  if ((await db.projects.count()) > 0) return

  const platform = await createProject({
    name: 'Platform Migration',
    icon: '▲',
    accent: 'indigo',
    description: 'Move the legacy reporting stack onto the new service layer.',
    goal: 'All reports served by the new API, legacy stack switched off.',
  })

  const onboarding = await createProject({
    name: 'Client Onboarding',
    icon: '●',
    accent: 'teal',
    description: 'Standardise how new clients get set up in the first 30 days.',
    goal: 'A repeatable checklist any team member can run without me.',
  })

  const hiring = await createProject({
    name: 'Hiring — Backend',
    icon: '◇',
    accent: 'amber',
    description: 'Fill the open backend engineer role.',
    goal: 'Signed offer, start date agreed.',
    health: 'at-risk',
  })

  const brand = await createProject({
    name: 'Site Refresh',
    icon: '✦',
    accent: 'rose',
    description: 'Refresh the marketing site copy and visual language.',
    goal: 'New homepage and three product pages live.',
    status: 'on-hold',
  })

  // --- tasks -----------------------------------------------------------------
  await createTask({
    title: 'Review migration cutover plan',
    projectId: platform.id,
    priority: 'high',
    due: on(0),
  })
  await createTask({
    title: 'Draft rollback checklist',
    projectId: platform.id,
    priority: 'med',
    due: on(0),
  })
  await createTask({
    title: 'Confirm staging data parity',
    projectId: platform.id,
    priority: 'high',
    due: on(-2),
  })
  await createTask({
    title: 'Write the API deprecation notice',
    projectId: platform.id,
    priority: 'low',
    due: on(4),
  })

  await createTask({
    title: 'Send welcome pack to Aurora',
    projectId: onboarding.id,
    priority: 'high',
    due: on(0),
  })
  await createTask({
    title: 'Turn the onboarding doc into a checklist',
    projectId: onboarding.id,
    priority: 'med',
    due: on(2),
  })
  await createTask({
    title: 'Weekly status update',
    projectId: onboarding.id,
    priority: 'med',
    due: on(1),
    recurrence: { freq: 'weekly', interval: 1 },
  })

  await createTask({
    title: 'Screen the three shortlisted CVs',
    projectId: hiring.id,
    priority: 'high',
    due: on(-1),
  })
  await createTask({
    title: 'Book second-round interview slots',
    projectId: hiring.id,
    priority: 'med',
    due: on(1),
  })

  await createTask({ title: 'Collect homepage copy references', projectId: brand.id, priority: 'low', due: null })
  await createTask({ title: 'Book the dentist', projectId: null, priority: 'low', due: on(3) })

  const done1 = await createTask({
    title: 'Set up the new staging environment',
    projectId: platform.id,
    priority: 'high',
    due: on(-3),
  })
  const done2 = await createTask({
    title: 'Agree the role scorecard',
    projectId: hiring.id,
    priority: 'med',
    due: on(-4),
  })
  await setTaskStatus(done1.id, 'done')
  await setTaskStatus(done2.id, 'done')

  const inProgress = await createTask({
    title: 'Map legacy report fields to the new schema',
    projectId: platform.id,
    priority: 'high',
    due: on(1),
  })
  await setTaskStatus(inProgress.id, 'doing')

  // --- meetings --------------------------------------------------------------
  await createMeeting({
    title: 'Migration cutover sync',
    projectId: platform.id,
    start: at(0, 11, 0),
    durationMin: 45,
    attendees: ['Sam', 'Priya', 'Tom'],
    summary: 'Agree the cutover date and who owns the rollback call.',
    prep: '- Read the cutover plan\n- Bring the open questions list\n- Decide: weekend or weekday switch?',
  })
  await createMeeting({
    title: 'Aurora kickoff',
    projectId: onboarding.id,
    start: at(0, 15, 30),
    durationMin: 60,
    attendees: ['Aurora team', 'Lena'],
    summary: 'First call — walk them through the first 30 days.',
    prep: '- Send the welcome pack beforehand\n- Confirm their technical contact',
  })
  await createMeeting({
    title: 'Second-round interview — backend',
    projectId: hiring.id,
    start: at(2, 10, 0),
    durationMin: 60,
    attendees: ['Candidate', 'Priya'],
    summary: 'System design round.',
    prep: '- Re-read the scorecard\n- Prepare the scaling scenario',
  })
  await createMeeting({
    title: 'Weekly planning',
    projectId: null,
    start: at(1, 9, 0),
    durationMin: 30,
    attendees: [],
    summary: 'Set the week across all projects.',
    prep: '',
  })
  await createMeeting({
    title: 'Migration technical review',
    projectId: platform.id,
    start: at(-3, 14, 0),
    durationMin: 60,
    attendees: ['Sam', 'Tom'],
    summary: 'Walked through the service layer design.',
    prep: '',
    notes:
      '## Decisions\n- Go with the adapter layer rather than a full rewrite.\n- Staging parity is a hard gate before cutover.\n\n## Open questions\n- Who signs off on the rollback?\n',
  })

  // --- notes -----------------------------------------------------------------
  await createNote({
    title: 'Cutover plan (draft)',
    projectId: platform.id,
    body: `# Cutover plan

## Sequence
1. Freeze writes on the legacy stack
2. Run the final sync
3. Flip the DNS entry
4. Smoke-test the top ten reports

## Rollback
If the smoke test fails, flip DNS back — the legacy stack stays warm for 48h.

> Decision (last review): adapter layer, not a rewrite.`,
  })
  await createNote({
    title: 'Onboarding: the first 30 days',
    projectId: onboarding.id,
    body: `# First 30 days

- **Day 0** — welcome pack, contacts exchanged
- **Day 1-3** — access provisioning
- **Week 2** — first review call
- **Week 4** — handover to the account team

Things that keep going wrong: access requests land too late, and nobody owns the week-2 call.`,
  })
  await createNote({
    title: 'Interview scorecard',
    projectId: hiring.id,
    body: `# Backend scorecard

| Area | Weight |
| --- | --- |
| System design | High |
| Debugging | High |
| Communication | Medium |
| Ownership | High |

Ask about a system they had to operate, not just build.`,
  })
  await createNote({
    title: 'Homepage copy — raw ideas',
    projectId: brand.id,
    body: 'Lead with the outcome, not the feature list.\n\n- "Know what to do next."\n- "One place for the work you are actually juggling."',
  })
}
