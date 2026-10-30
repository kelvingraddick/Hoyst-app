import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('audience', Path(__file__).parents[1] / 'scripts/audit-beta-audience.py')
audience = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audience)

def row(email='tester@example.invalid', provider='mailchimp', **updates):
    return dict(provider=provider, email=email, permission_scope='brand', permission_evidence='Explicit brand-news signup', status='subscribed', last_engaged_at='2026-10-01T12:00:00Z', **updates)

class AudienceTests(unittest.TestCase):
    def test_duplicate_selection_and_global_suppression(self):
        older = row(provider='resend')
        newer = row()
        newer['last_engaged_at'] = '2026-10-20T12:00:00Z'
        eligible, review = audience.audit([older, newer])
        self.assertEqual(len(eligible['mailchimp']), 1)
        self.assertEqual(len(eligible['resend']), 0)
        suppressed = row()
        suppressed['status'] = 'unsubscribed'
        eligible, review = audience.audit([older, suppressed])
        self.assertFalse(any(eligible.values()))
        self.assertEqual({r['review_reason'] for r in review}, {'suppressed_in_source'})
    def test_formula_like_email_is_reviewed_without_changing_recipient(self):
        address = '+tester@example.invalid'
        eligible, review = audience.audit([row(email=address)])
        self.assertFalse(any(eligible.values()))
        self.assertEqual(review[0]['email'], address)
        self.assertEqual(review[0]['review_reason'], 'email_needs_manual_import_review')
    def test_registration_and_unknown_permission_never_become_eligible(self):
        registration = row()
        registration['permission_scope'] = 'app_registration'
        eligible, review = audience.audit([registration])
        self.assertFalse(any(eligible.values()))
        self.assertEqual(len(review), 1)
        registration['permission_scope'] = 'brand'
        registration['permission_evidence'] = ''
        self.assertFalse(any(audience.audit([registration])[0].values()))

if __name__ == '__main__':
    unittest.main()
