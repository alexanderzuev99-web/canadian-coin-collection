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

class WebsiteFeedTests(unittest.TestCase):
    def test_enrichment_keeps_unknown_variants_unasserted(self):
        c={'url':'https://www.mint.ca/en/company/media-room/2027-01-02-new-2-circulation-coin','title':'A release','evidence':'Circulation'}
        e=m['enrich'](c,'<h1>New $2 circulation coin</h1><meta property="og:image" content="https://www.mint.ca/globalassets/test.png">')
        self.assertEqual(e['year'],2027);self.assertEqual(e['denomination'],'$2');self.assertEqual(len(e['id']),16)
        self.assertNotIn('variants',e);self.assertTrue(e['image'].startswith('https://www.mint.ca/globalassets/'))
    def test_feed_retains_unreviewed_announcements_without_changing_main(self):
        import base64,json
        old={'id':'abcdef0123456789','url':'https://www.mint.ca/en/discover/canadian-commemorative-circulation-program/2027/test','title':'Fixture'}
        calls=[]
        def api(method,path,token,body=None):
            calls.append((method,path,body))
            if method=='GET':return {'sha':'old-sha','content':base64.b64encode(json.dumps({'candidates':[old]}).encode()).decode()}
            return {}
        feed=m['publish_feed']({'checkedAt':'2026-10-31T12:00:00Z','candidates':[]},'owner/repo','fake',api)
        self.assertEqual(feed['candidates'],[old]);self.assertEqual(calls[-1][2]['branch'],'release-feed');self.assertEqual(calls[-1][2]['sha'],'old-sha')

    def test_first_feed_branch_uses_inherited_file_sha(self):
        import base64,json
        from urllib.error import HTTPError
        reads=0;writes=[]
        def api(method,path,token,body=None):
            nonlocal reads
            if method=='GET' and '/contents/' in path:
                reads+=1
                if reads==1:raise HTTPError(path,404,'not found',{},None)
                return {'sha':'inherited-sha','content':base64.b64encode(json.dumps({'candidates':[]}).encode()).decode()}
            if method=='GET' and path.endswith('/heads/release-feed'):raise HTTPError(path,404,'not found',{},None)
            if method=='GET' and path.endswith('/heads/main'):return {'object':{'sha':'main-head'}}
            writes.append((method,path,body));return {}
        m['publish_feed']({'checkedAt':'2026-10-31T12:00:00Z','candidates':[]},'owner/repo','fake',api)
        self.assertEqual(writes[-1][2]['sha'],'inherited-sha');self.assertEqual(writes[-1][2]['branch'],'release-feed')

if __name__=='__main__':unittest.main()
