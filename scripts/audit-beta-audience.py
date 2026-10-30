#!/usr/bin/env python3
"""Review normalized marketing exports locally. Never sends or changes subscriptions."""
import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path
import json
import re

SCOPES = {'brand', 'new_products', 'hoyst'}
SUPPRESSED = {'unsubscribed', 'bounced', 'complained', 'cleaned', 'archived', 'non-subscribed'}
FIELDS = ['provider', 'email', 'permission_scope', 'permission_evidence', 'status', 'last_engaged_at']

def timestamp(value):
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return date.replace(tzinfo=date.tzinfo or timezone.utc).timestamp()
    except (ValueError, TypeError):
        return 0

def audit(rows):
    groups = {}
    review = []
    eligible = {'mailchimp': [], 'resend': []}
    for original in rows:
        row = {key: str(original.get(key) or '').strip() for key in FIELDS}
        for key in ['provider', 'email', 'permission_scope', 'status']:
            row[key] = row[key].lower()
        groups.setdefault(row['email'], []).append(row)
    for email, copies in groups.items():
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
            reason = 'invalid_email'
        elif email.startswith(('=', '+', '-', '@')):
            reason = 'email_needs_manual_import_review'
        elif any(row['status'] in SUPPRESSED for row in copies):
            reason = 'suppressed_in_source'
        else:
            candidates = [row for row in copies if row['provider'] in eligible and row['status'] == 'subscribed'
                          and row['permission_scope'] in SCOPES and row['permission_evidence']]
            if candidates:
                # Most recent engagement wins; Mailchimp wins ties. Never infer permission from engagement.
                selected = max(candidates, key=lambda row: (timestamp(row['last_engaged_at']), row['provider'] == 'mailchimp'))
                eligible[selected['provider']].append(selected)
                continue
            reason = 'permission_or_subscription_needs_review'
        review.extend({**row, 'review_reason': reason} for row in copies)
    for rows_out in eligible.values():
        rows_out.sort(key=lambda row: timestamp(row['last_engaged_at']), reverse=True)
    return eligible, review

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inputs', nargs='+', type=Path)
    parser.add_argument('--output', type=Path, default=Path('.beta-private/audience'))
    args = parser.parse_args()
    rows = []
    for path in args.inputs:
        with path.open(newline='', encoding='utf-8-sig') as source:
            reader = csv.DictReader(source)
            if not set(FIELDS).issubset(reader.fieldnames or []):
                raise SystemExit('Normalize the input to the six documented headers first. Raw signup or subscribed status is not permission evidence.')
            rows.extend(reader)
    eligible, review = audit(rows)
    args.output.mkdir(parents=True, exist_ok=True, mode=0o700)
    outputs = {f'eligible-{provider}.csv': (FIELDS, records) for provider, records in eligible.items()}
    outputs['review.csv'] = (FIELDS + ['review_reason'], review)
    for name, (fields, records) in outputs.items():
        path = args.output / name
        with path.open('w', newline='', encoding='utf-8') as target:
            writer = csv.DictWriter(target, fieldnames=fields)
            writer.writeheader()
            # Protect values that could become spreadsheet formulas when opened in Excel.
            writer.writerows({key: "'" + value if value.startswith(('=', '+', '-', '@')) else value for key, value in row.items()} for row in records)
        path.chmod(0o600)
    summary = {'input_rows': len(rows), 'eligible_mailchimp': len(eligible['mailchimp']),
               'eligible_resend': len(eligible['resend']), 'review_rows': len(review)}
    (args.output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary))

if __name__ == '__main__':
    main()
