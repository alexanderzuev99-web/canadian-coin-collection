import runpy
import unittest
m=runpy.run_path('check-releases.py')
class DiscoveryTests(unittest.TestCase):
    def test_scope_and_deduplication(self):
        html='''<a href="/en/company/media-room/2027-01-01-new-circulation-coin">New circulation coin and silver collector edition</a><a href="https://www.mint.ca/en-us/company/media-room/2027-01-01-new-circulation-coin?x=2">Again</a><a href="/en/company/media-room/2027-01-02-silver-collector-coin">Silver collector coin</a><a href="https://evil.example/en/discover/canadian-commemorative-circulation-program/2027/coin">No</a><a href="/en/discover/canadian-commemorative-circulation-program/2027/coin">Coin</a>'''
        found=m['discover'](html,m['SOURCES'][0]);self.assertEqual(len(found),2)
        self.assertTrue(all('mint.ca/en/' in u for u in found))
    def test_closed_issues_never_reopen(self):
        candidate={'url':'https://www.mint.ca/en/discover/canadian-commemorative-circulation-program/2027/example','title':'A coin','evidence':'Official program'}
        calls=[]
        def api(method,path,token,body=None):
            calls.append(method)
            return [{'body':m['marker'](candidate['url']),'state':'closed'}]
        self.assertIsNone(m['publish']([candidate],'owner/repo','fake',api));self.assertEqual(calls,['GET'])
    def test_publish_only_requests_approval(self):
        calls=[]
        def api(method,path,token,body=None):
            calls.append((method,path,body));return [] if method=='GET' else {'html_url':'https://github.com/owner/repo/issues/1'}
        c={'url':'https://www.mint.ca/en/example','title':'Coin <script>','evidence':'Official program'}
        m['publish']([c],'owner/repo','fake',api)
        self.assertEqual([c[0] for c in calls],['GET','POST']);self.assertTrue(calls[-1][1].endswith('/issues'))
        self.assertIn('Owner approves',calls[-1][2]['body']);self.assertIn('No coins have been added',calls[-1][2]['body'])
if __name__=='__main__':unittest.main()
