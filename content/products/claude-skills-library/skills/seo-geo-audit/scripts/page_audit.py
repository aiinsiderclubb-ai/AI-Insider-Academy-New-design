#!/usr/bin/env python3
"""Collect the facts an SEO and AI-search audit needs from one page.

    python3 page_audit.py https://example.com/services/
    python3 page_audit.py saved-page.html          # a local file, no network

For a URL it also reads /robots.txt (rules for AI crawlers and the sitemap
line) and checks whether /llms.txt exists. It reports facts only; judging
them is the skill's job. Uses the Python standard library, nothing to install.
"""
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

AGENT = "Mozilla/5.0 (compatible; page-audit/1.0)"
AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Bingbot", "CCBot"]
SKIP = {"script", "style", "noscript", "template", "svg"}


class Page(HTMLParser):
    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.title = ""
        self.meta = {}
        self.links = []
        self.headings = []
        self.images = []
        self.jsonld = []
        self.canonical = None
        self.lang = None
        self.hreflang = []
        self.text = []
        self._stack = []
        self._capture = None
        self._buffer = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "br":
            # A line break separates words even when the markup has no space.
            self.handle_data(" ")
            return
        self._stack.append(tag)
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "meta":
            key = (a.get("name") or a.get("property") or "").lower()
            if key:
                self.meta[key] = a.get("content", "")
        elif tag == "link":
            rel = (a.get("rel") or "").lower()
            if "canonical" in rel:
                self.canonical = a.get("href")
            if "alternate" in rel and a.get("hreflang"):
                self.hreflang.append(a.get("hreflang"))
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag == "img":
            self.images.append({"src": a.get("src", ""), "alt": a.get("alt")})
        if tag == "title" or re.fullmatch(r"h[1-6]", tag):
            self._capture, self._buffer = tag, []
        if tag == "script" and (a.get("type") or "").lower() == "application/ld+json":
            self._capture, self._buffer = "jsonld", []

    def handle_endtag(self, tag):
        if self._capture and (tag == self._capture or (self._capture == "jsonld" and tag == "script")):
            content = " ".join("".join(self._buffer).split())
            if self._capture == "title":
                self.title = self.title or content
            elif self._capture == "jsonld":
                self.jsonld.append("".join(self._buffer))
            else:
                self.headings.append({"level": int(self._capture[1]), "text": content})
            self._capture = None
        while self._stack and self._stack.pop() != tag:
            pass

    def handle_data(self, data):
        if self._capture:
            self._buffer.append(data)
        if not SKIP.intersection(self._stack):
            self.text.append(data)


def fetch(url, limit=3_000_000):
    request = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "text/html,*/*"})
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read(limit)
        charset = response.headers.get_content_charset() or "utf-8"
        return response.status, response.geturl(), dict(response.headers), raw.decode(charset, "replace")


def schema_types(blocks):
    types, broken = [], 0

    def walk(node):
        if isinstance(node, dict):
            kind = node.get("@type")
            if isinstance(kind, str):
                types.append(kind)
            elif isinstance(kind, list):
                types.extend(str(k) for k in kind)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    for block in blocks:
        try:
            walk(json.loads(block))
        except ValueError:
            broken += 1
    return sorted(set(types)), broken


def robots_report(origin):
    report = {"found": False, "sitemaps": [], "ai_bots": {}}
    try:
        _, _, _, body = fetch(origin + "/robots.txt", 300_000)
    except (urllib.error.URLError, OSError, ValueError):
        return report
    report["found"] = True
    groups, agents, fresh = {}, [], True
    for line in body.splitlines():
        line = line.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        key, value = [part.strip() for part in line.split(":", 1)]
        key = key.lower()
        if key == "sitemap":
            report["sitemaps"].append(value)
        elif key == "user-agent":
            if not fresh:
                agents, fresh = [], True
            agents.append(value.lower())
            groups.setdefault(value.lower(), [])
        elif key in ("allow", "disallow"):
            fresh = False
            for agent in agents:
                groups[agent].append((key, value))
    for bot in AI_BOTS:
        rules = groups.get(bot.lower())
        source = bot if rules is not None else "*"
        rules = rules if rules is not None else groups.get("*", [])
        blocked = any(kind == "disallow" and value == "/" for kind, value in rules)
        report["ai_bots"][bot] = {"rule_from": source, "blocked_sitewide": blocked}
    return report


def exists(url):
    try:
        status, final, headers, body = fetch(url, 20_000)
        return status == 200 and "<html" not in body[:500].lower()
    except (urllib.error.URLError, OSError, ValueError):
        return False


def main():
    if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return 2
    target = sys.argv[1]
    remote = re.match(r"^https?://", target) is not None
    out = {"target": target}

    if remote:
        try:
            status, final, headers, html = fetch(target)
        except urllib.error.HTTPError as error:
            print(json.dumps({"target": target, "error": "HTTP %s" % error.code}, ensure_ascii=False))
            return 1
        except (urllib.error.URLError, OSError) as error:
            print(json.dumps({"target": target, "error": str(error)}, ensure_ascii=False))
            return 1
        out.update(status=status, final_url=final, redirected=final.rstrip("/") != target.rstrip("/"))
        out["x_robots_tag"] = headers.get("X-Robots-Tag") or headers.get("x-robots-tag")
    else:
        html = open(target, encoding="utf-8", errors="replace").read()

    page = Page()
    page.feed(html)
    text = " ".join(" ".join(page.text).split())
    words = re.findall(r"[\w'’-]+", text, flags=re.U)
    description = page.meta.get("description", "")
    h1 = [h["text"] for h in page.headings if h["level"] == 1]
    types, broken = schema_types(page.jsonld)

    levels = [h["level"] for h in page.headings]
    skipped = [
        "%s → h%d" % ("h%d" % a, b) for a, b in zip(levels, levels[1:]) if b - a > 1
    ]
    question_headings = [h["text"] for h in page.headings if h["text"].endswith("?")]

    host = urllib.parse.urlparse(out.get("final_url", target)).netloc if remote else ""
    internal = external = 0
    for href in page.links:
        parsed = urllib.parse.urlparse(href)
        if parsed.scheme in ("mailto", "tel", "javascript"):
            continue
        if parsed.netloc and parsed.netloc != host:
            external += 1
        else:
            internal += 1

    out.update({
        "html_bytes": len(html.encode("utf-8")),
        "lang": page.lang,
        "title": {"text": page.title, "length": len(page.title)},
        "meta_description": {"text": description, "length": len(description)},
        "meta_robots": page.meta.get("robots"),
        "canonical": page.canonical,
        "hreflang": page.hreflang,
        "h1": h1,
        "headings": page.headings[:60],
        "heading_levels_skipped": skipped,
        "question_headings": question_headings,
        "words": len(words),
        "first_200_chars": text[:200],
        "images": {
            "total": len(page.images),
            "without_alt": sum(1 for image in page.images if image["alt"] is None),
            "empty_alt": sum(1 for image in page.images if image["alt"] == ""),
        },
        "links": {"internal": internal, "external": external},
        "open_graph": {key: value for key, value in page.meta.items() if key.startswith("og:")},
        "twitter_card": page.meta.get("twitter:card"),
        "structured_data": {"types": types, "blocks": len(page.jsonld), "invalid_blocks": broken},
        "viewport": page.meta.get("viewport"),
    })

    # A page that is nearly empty before scripts run is invisible to crawlers
    # that do not execute JavaScript, which includes most AI crawlers.
    out["rendering"] = {
        "words_in_raw_html": len(words),
        "likely_client_rendered": len(words) < 120 and html.count("<script") > 5,
    }

    if remote:
        parsed = urllib.parse.urlparse(out["final_url"])
        origin = "%s://%s" % (parsed.scheme, parsed.netloc)
        out["robots_txt"] = robots_report(origin)
        out["llms_txt"] = exists(origin + "/llms.txt")
        if not out["robots_txt"]["sitemaps"]:
            out["sitemap_xml_at_default_path"] = exists(origin + "/sitemap.xml")

    print(json.dumps(out, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
