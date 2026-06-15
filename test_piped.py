import urllib.request, json
instances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.moomoo.me',
    'https://pipedapi.syncpundit.io',
    'https://pipedapi.privacy.com.de'
]
for inst in instances:
    try:
        req = urllib.request.Request(f'{inst}/streams/T26BMqoSjiM', headers={'User-Agent': 'Mozilla/5.0'})
        data = json.loads(urllib.request.urlopen(req, timeout=5).read())
        print(f'{inst} SUCCESS: {len(data.get("videoStreams", []))} streams')
    except Exception as e:
        print(f'{inst} FAILED: {e}')
