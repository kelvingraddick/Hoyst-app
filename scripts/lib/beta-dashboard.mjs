// PostHog HogQL definitions. All rates return their numerator, denominator and pending count.
const appFilter = `properties.platform = 'ios' AND properties.is_internal = false
  AND properties.environment IN ('beta', 'production') AND timestamp >= toDateTime('2026-11-01 15:00:00', 'UTC') AND timestamp <= now()`;
const cohort = `WITH signups AS (
  SELECT person_id, min(timestamp) AS onboarded_at FROM events
  WHERE event = 'onboarding_completed' AND ${appFilter} GROUP BY person_id
), taps AS (
  SELECT person_id, timestamp, properties.mode AS mode, properties.cadence AS cadence FROM events
  WHERE event = 'tap_in_saved' AND properties.outcome IN ('done', 'partial', 'failed') AND ${appFilter}
), activations AS (
  SELECT s.person_id, min(t.timestamp) AS activated_at,
    argMin(t.mode, t.timestamp) AS mode, argMin(t.cadence, t.timestamp) AS cadence
  FROM signups s JOIN taps t ON s.person_id = t.person_id
  WHERE t.timestamp >= s.onboarded_at AND t.timestamp < s.onboarded_at + INTERVAL 7 DAY GROUP BY s.person_id
)`;
const hogql = (name, description, query) => ({
  name,
  description,
  query: {
    kind: 'DataVisualizationNode',
    display: name === 'Onboarded testers' ? 'BoldNumber' : 'ActionsTable',
    source: {kind: 'HogQLQuery', query},
  },
});
export const dashboardDefinition = {
  name: 'Hoyst iOS beta: November 2026',
  description:
    'Public launch starts November 1 at 10 a.m. Eastern. Targets: 25 onboarded by November 8, 50 by November 15. Raw counts and mature cohort rates. Optional analytics can undercount. Website sessions, TestFlight installs and app accounts are separate populations.',
  insights: [
    hogql(
      'Onboarded testers',
      'Unique observed beta accounts. Internal and development activity excluded.',
      `SELECT uniq(person_id) AS onboarded_testers FROM events WHERE event = 'onboarding_completed' AND ${appFilter}`,
    ),
    hogql(
      'Activation: mature seven-day cohorts',
      'Accepted non-skip Tap Ins require an active Commitment membership, so their successful save also verifies setup. Seven elapsed days of observation required.',
      `${cohort}
SELECT countIf(s.onboarded_at + INTERVAL 7 DAY <= now()) AS eligible,
 countIf(s.onboarded_at + INTERVAL 7 DAY <= now() AND a.activated_at IS NOT NULL) AS activated,
 round(100.0 * countIf(s.onboarded_at + INTERVAL 7 DAY <= now() AND a.activated_at IS NOT NULL) / nullIf(countIf(s.onboarded_at + INTERVAL 7 DAY <= now()), 0), 1) AS activation_percent,
 countIf(s.onboarded_at + INTERVAL 7 DAY > now()) AS pending
FROM signups s LEFT JOIN activations a ON s.person_id = a.person_id`,
    ),
    hogql(
      'Second-week repeat use by initial mode and cadence',
      'Window is [activation + 7 days, activation + 14 days). Monthly cadence is reported separately and is not a weekly retention pass/fail test.',
      `${cohort}, returns AS (
SELECT a.person_id, count() AS returns FROM activations a JOIN taps t ON a.person_id = t.person_id
WHERE t.timestamp >= a.activated_at + INTERVAL 7 DAY AND t.timestamp < a.activated_at + INTERVAL 14 DAY GROUP BY a.person_id
)
SELECT a.mode, a.cadence, countIf(a.activated_at + INTERVAL 14 DAY <= now()) AS eligible,
countIf(a.activated_at + INTERVAL 14 DAY <= now() AND coalesce(r.returns, 0) > 0) AS returned,
round(100.0 * countIf(a.activated_at + INTERVAL 14 DAY <= now() AND coalesce(r.returns, 0) > 0) / nullIf(countIf(a.activated_at + INTERVAL 14 DAY <= now()), 0), 1) AS repeat_percent,
countIf(a.activated_at + INTERVAL 14 DAY > now()) AS pending
FROM activations a LEFT JOIN returns r ON a.person_id = r.person_id GROUP BY a.mode, a.cadence`,
    ),
    hogql(
      'Stage reach and Circle requests',
      'Independent distinct-user counts, not an attributed ordered funnel. Requests, accepted memberships and owner review actions remain separate.',
      `SELECT event, uniq(person_id) AS accounts FROM events WHERE ${appFilter} AND event IN ('app_opened','onboarding_started','onboarding_completed','commitment_created','circle_join_requested','circle_joined','circle_join_reviewed','tap_in_saved','invite_opened') GROUP BY event ORDER BY accounts DESC`,
    ),
    hogql(
      'Website campaign sessions and TestFlight clicks',
      'Anonymous browser sessions cannot be joined to TestFlight installs or authenticated app accounts.',
      `SELECT properties.utm_source AS source, properties.utm_medium AS medium, properties.utm_content AS content,
uniqIf(distinct_id, event = 'website_session_started') AS browser_sessions,
uniqIf(distinct_id, event = 'testflight_clicked') AS sessions_clicking_testflight
FROM events WHERE properties.platform = 'web' AND properties.is_internal = false AND timestamp >= toDateTime('2026-11-01 15:00:00', 'UTC') AND event IN ('website_session_started','testflight_clicked') GROUP BY source, medium, content ORDER BY browser_sessions DESC`,
    ),
    hogql(
      'Self-reported discovery',
      'Optional source question after onboarding. Separate from website campaign attribution.',
      `SELECT properties.source AS source, uniq(person_id) AS accounts FROM events WHERE event = 'acquisition_source_selected' AND ${appFilter} GROUP BY source ORDER BY accounts DESC`,
    ),
    hogql(
      'Feedback contact attempts',
      'Opening an email draft or Instagram profile does not prove feedback was sent.',
      `SELECT properties.intent AS intent, properties.channel AS channel, uniq(person_id) AS accounts FROM events WHERE event = 'feedback_contact_opened' AND ${appFilter} GROUP BY intent, channel`,
    ),
  ],
};

// PostHog displays illustrative placeholder rows for an empty SQL table. Return an
// explicit zero-result row instead, so the pre-launch dashboard cannot resemble real activity.
const emptyRows = {
  'Second-week repeat use by initial mode and cadence':
    "SELECT '(no activated cohorts)' AS mode, '' AS cadence, 0 AS eligible, 0 AS returned, NULL AS repeat_percent, 0 AS pending",
  'Stage reach and Circle requests':
    "SELECT '(no observed stages)' AS event, 0 AS accounts",
  'Website campaign sessions and TestFlight clicks':
    "SELECT '(no campaign activity)' AS source, '' AS medium, '' AS content, 0 AS browser_sessions, 0 AS sessions_clicking_testflight",
  'Self-reported discovery': "SELECT '(no responses)' AS source, 0 AS accounts",
  'Feedback contact attempts':
    "SELECT '(no contact attempts)' AS intent, '' AS channel, 0 AS accounts",
};
for (const insight of dashboardDefinition.insights) {
  if (emptyRows[insight.name]) {
    const original = insight.query.source.query;
    const selectAt = original.lastIndexOf('\nSELECT a.mode');
    const grouped =
      original.startsWith('WITH ') && selectAt > 0
        ? `${original.slice(0, selectAt)}, beta_results AS (${original.slice(
            selectAt,
          )})`
        : `WITH beta_results AS (${original})`;
    insight.query.source.query = `${grouped} SELECT * FROM beta_results UNION ALL ${
      emptyRows[insight.name]
    } WHERE (SELECT count() FROM beta_results) = 0`;
  }
}
