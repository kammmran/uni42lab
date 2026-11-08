# Uni42Lab

Static website of **Uni42Lab**, presenting the lab's research areas (chemical engineering, chemoinformatics, fluid mechanics), publications, news and online engineering tools.

Live: https://kammmran.github.io/uni42lab/

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Home and research areas |
| `publications.html` | Publications |
| `news.html` | News |
| `tools.html` | Engineering tools |
| `contact.html` | Contact |
| `heat-exchanger/` | Shell-and-tube heat exchanger tool, with shell, tube and baffle data in `heat-exchanger/data/*.csv` |

## Run locally

```bash
git clone https://github.com/kammmran/uni42lab.git
cd uni42lab
python3 -m http.server 8000   # open http://localhost:8000
```

Serving the folder over HTTP (not `file://`) lets the heat-exchanger tool load its CSV data.
