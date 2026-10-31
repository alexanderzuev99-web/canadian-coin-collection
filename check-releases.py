#!/usr/bin/env python3
"""Weekly Mint discovery. Creates review issues; never changes the coin catalogue."""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import time
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parent
SOURCES = [
    'https://www.mint.ca/en/company/media-room',
    'https://www.mint.ca/en/discover/canadian-commemorative-circulation-program',
]
PROGRAM = '/en/discover/canadian-commemorative-circulation-program/'


def canonical(url):
    parts = urlsplit(url)
    if parts.scheme != 'https' or parts.hostname not in ('www.mint.ca', 'mint.ca'):
        return None
    path = re.sub(r'^/en-us/', '/en/', parts.path).rstrip('/')
    return urlunsplit(('https', 'www.mint.ca', path, '', ''))


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.current = None
        self.text = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.current = dict(attrs).get('href')
            self.text = []
    def handle_data(self, data):
        if self.current is not None:
            self.text.append(data)
    def handle_endtag(self, tag):
        if tag == 'a' and self.current is not None:
            self.links.append((self.current, ' '.join(' '.join(self.text).split())))
            self.current = None


def discover(html, source):
    parser = Links()
    parser.feed(html)
    result = {}
    for href, title in parser.links:
        url = canonical(urljoin(source, href))
        if not url:
            continue
        path = urlsplit(url).path
        program = path.startswith(PROGRAM)
        media = bool(re.match(r'/en/company/media-room/\d{4}-\d{2}-\d{2}-', path))
        if not program and not media:
            continue
        # Navigation, corporate news, precious-metal-only launches are not candidates.
        text = (path + ' ' + title).lower()
        if media and not re.search(r'circulation|circulating', text):
            continue
        # Do NOT reject a circulation announcement merely because the same page
        # also advertises silver collector versions. Composition needs review.
        title = title or path.rsplit('/', 1)[-1].replace('-', ' ').capitalize()
        result[url] = {'url': url, 'title': title[:240], 'source': source,
                       'evidence': 'Official circulation program entry' if program else 'Official announcement explicitly mentions circulation',
                       'status': 'Needs circulation, composition and variant verification'}
    return result


def fetch(url):
    error = None
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; CanadianCoinCollection/1.0)', 'Accept': 'text/html'}), timeout=40) as response:
                return response.read().decode('utf-8')
        except Exception as exc:
            error = exc
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f'Could not check {url}: {error}')


def github(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = Request('https://api.github.com' + path, data=data, method=method, headers={
        'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'CanadianCoinCollection',
        'Content-Type': 'application/json'})
    with urlopen(request, timeout=40) as response:
        return json.load(response)


def marker(url):
    return '<!-- mint-candidate:' + hashlib.sha256(url.encode()).hexdigest() + ' -->'


def review_body(candidates):
    body = ['New official Mint circulation announcements need the collection owner\'s approval.',
            '', '**No coins have been added to the website.** The catalogue, photographs and saved selections are unchanged.', '']
    for candidate in candidates:
        # Escape text from remote pages; URLs only come from the Mint allowlist.
        title = re.sub(r'[\[\]<>`!]', '', candidate['title']).replace('\n', ' ')
        body += [f"### [{title}]({candidate['url']})", candidate['evidence'], marker(candidate['url']), '']
    body += ['Before approving an addition:',
             '- [ ] Confirm it is a Canadian base-metal coin actually released for general circulation (not just legal tender or a collector product).',
             '- [ ] Verify the release date, denomination and composition; exclude silver and collector-only coins.',
             '- [ ] Check existing IDs and the owner\'s exclusions to avoid duplicates.',
             '- [ ] Verify intentional colour/non-colour circulation counterparts and a genuine reverse photograph for each.',
             '- [ ] Prepare English history notes with official source links.',
             '- [ ] Owner approves the exact entries to add.',
             '- [ ] Add with new stable IDs, initially Missing; test existing true AND false selections.',
             '', 'To approve, reply here naming the exact circulation variants you want included, then ask Codex to apply the approved issue. Close the issue to reject it. No comment or label automatically publishes unverified data.']
    return '\n'.join(body)


def publish(candidates, repo, token, api=github):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
        raise ValueError('Invalid repository name')
    seen = set()
    # Closed issues count as reviewed too; rejected candidates must not reappear.
    for page in range(1, 101):
        issues = api('GET', f'/repos/{repo}/issues?state=all&per_page=100&page={page}', token)
        for issue in issues:
            seen.update(re.findall(r'<!-- mint-candidate:[a-f0-9]{64} -->', issue.get('body') or ''))
        if len(issues) < 100:
            break
    else:
        raise RuntimeError('Issue history pagination limit reached; refusing to create duplicates')
    new = [c for c in candidates if marker(c['url']) not in seen]
    if not new:
        return None
    return api('POST', f'/repos/{repo}/issues', token, {
        'title': f"Review new Mint circulation releases · {dt.date.today().isoformat()}",
        'body': review_body(new)})['html_url']


def enrich(candidate, html):
    class Metadata(HTMLParser):
        def __init__(self):
            super().__init__(); self.h1=False; self.title=[]; self.image=''
        def handle_starttag(self, tag, attrs):
            attrs=dict(attrs)
            if tag=='h1': self.h1=True
            if tag=='meta' and attrs.get('property')=='og:image': self.image=attrs.get('content','')
        def handle_endtag(self, tag):
            if tag=='h1': self.h1=False
        def handle_data(self, text):
            if self.h1:self.title.append(text)
    parser=Metadata(); parser.feed(html)
    title=' '.join(' '.join(parser.title).split()) or candidate['title']
    path=urlsplit(candidate['url']).path
    year=re.search(r'/(20[0-9]{2})(?:/|-)',path)
    denomination=re.search(r'\$[12]|(?:5|10|25)[ -]*(?:cents?|¢)', title, re.I)
    denom=denomination.group(0).lower() if denomination else ''
    if denom and not denom.startswith('$'): denom=re.search(r'5|10|25',denom).group(0)+'¢'
    image=canonical(urljoin(candidate['url'],parser.image)) if parser.image else None
    if image and not urlsplit(image).path.startswith('/globalassets/'):image=None
    return {**candidate,'id':hashlib.sha256(candidate['url'].encode()).hexdigest()[:16],
            'title':title[:240], 'name':title[:160], 'year':int(year.group(1)) if year else None,
            'denomination':denom,'image':image or ''}


def publish_feed(report, repo, token, api=github):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repo):raise ValueError('Invalid repository name')
    branch='release-feed'; path=f'/repos/{repo}/contents/new-coins-feed.json'
    try:
        existing=api('GET',path+'?ref='+branch,token)
        previous=json.loads(base64.b64decode(existing['content']))
    except HTTPError as exc:
        if exc.code!=404:raise
        try:api('GET',f'/repos/{repo}/git/ref/heads/{branch}',token)
        except HTTPError as missing:
            if missing.code!=404:raise
            head=api('GET',f'/repos/{repo}/git/ref/heads/main',token)['object']['sha']
            api('POST',f'/repos/{repo}/git/refs',token,{'ref':'refs/heads/'+branch,'sha':head})
        try:
            existing=api('GET',path+'?ref='+branch,token)
            previous=json.loads(base64.b64decode(existing['content']))
        except HTTPError as absent:
            if absent.code!=404:raise
            existing={};previous={'candidates':[]}
    reviewed={canonical(url) for url in json.loads((ROOT/'release-watch.json').read_text())['reviewed_urls']}
    candidates={c['url']:c for c in previous.get('candidates',[]) if canonical(c.get('url','')) and c['url'] not in reviewed}
    candidates.update({c['url']:c for c in report['candidates']})
    feed={'version':1,'checkedAt':report['checkedAt'],'sources':SOURCES,'candidates':list(candidates.values())}
    body={'message':'Refresh official Mint release feed for website review','branch':branch,
          'content':base64.b64encode((json.dumps(feed,ensure_ascii=False,indent=2)+'\n').encode()).decode()}
    if existing.get('sha'):body['sha']=existing['sha']
    api('PUT',path,token,body)
    return feed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish-feed', action='store_true', help='Publish announcements to the website review feed, never to the catalogue')
    parser.add_argument('--publish', action='store_true', help='Create an approval issue using GITHUB_TOKEN')
    parser.add_argument('--fixture-dir', type=Path, help='Read source snapshots for offline testing')
    args = parser.parse_args()
    baseline = json.loads((ROOT / 'release-watch.json').read_text())
    reviewed = {canonical(url) for url in baseline['reviewed_urls']}
    found = {}
    for index, source in enumerate(SOURCES):
        html = (args.fixture_dir / f'source-{index}.html').read_text() if args.fixture_dir else fetch(source)
        items = discover(html, source)
        if not items:
            raise RuntimeError(f'No expected circulation links found at {source}; source format may have changed')
        found.update(items)
    candidates = [c for url, c in sorted(found.items()) if url not in reviewed]
    if args.publish_feed:
        candidates=[enrich(c,fetch(c['url'])) for c in candidates]
    report = {'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'sources': SOURCES,
              'discovered': len(found), 'candidates': candidates, 'catalogueChanged': False}
    Path('release-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n')
    print(f"Checked {len(SOURCES)} Mint sources; {len(found)} circulation links; {len(candidates)} candidate pages need review.")
    if args.publish_feed:
        feed=publish_feed(report,os.environ['GITHUB_REPOSITORY'],os.environ['GITHUB_TOKEN'])
        print(f"Published {len(feed['candidates'])} announcement pages for review on the website. Catalogue unchanged.")
    if args.publish and candidates:
        token = os.environ['GITHUB_TOKEN']
        repo = os.environ['GITHUB_REPOSITORY']
        print(publish(candidates, repo, token) or 'All candidates already have review issues.')
    elif candidates:
        print(review_body(candidates))
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as stream:
            stream.write(f'Checked two official Mint sources. Found {len(candidates)} candidate pages outside the reviewed baseline. No catalogue entries were changed. Review new announcements on the website using New coins. Decisions are personal and do not modify the shared catalogue.\n')


if __name__ == '__main__':
    main()
