import unittest
import server

class ServerContracts(unittest.TestCase):
    def test_invalid_query_inputs(self):
        self.assertTrue(callable(getattr(server, 'validate_search', None)), 'validation must be exposed')
        for params in ({'q':['']}, {'q':['x'],'limit':['bad']}, {'q':['x'],'since':['2026-02-30']}, {'q':['x'],'since':['2026-10-30'],'until':['2026-10-01']}):
            with self.assertRaises(ValueError):
                server.validate_search(params)
    def test_filters_and_cursor_forwarded(self):
        self.assertTrue(callable(getattr(server, 'validate_search', None)), 'validation must be exposed')
        params=server.validate_search({'q':[' coffee '],'lang':['en'],'cursor':['next'],'until':['2026-10-30']})
        self.assertEqual(params['q'],'coffee')
        self.assertEqual(params['cursor'],'next')
        self.assertEqual(params['until'],'2026-10-31T00:00:00.000Z')
    def test_local_static_file_allowlist(self):
        self.assertIsInstance(getattr(server,'PUBLIC_FILES',None),dict)
        self.assertNotIn('/server.py',server.PUBLIC_FILES)
        self.assertNotIn('/.env',server.PUBLIC_FILES)
        self.assertIn('/core.js',server.PUBLIC_FILES)

if __name__=='__main__': unittest.main()
