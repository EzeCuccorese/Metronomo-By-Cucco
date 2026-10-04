// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildHeadersFile, parseNginxHeaders } from './cloudflareHeaders';

const securityConf = readFileSync(new URL('./security-headers.conf', import.meta.url), 'utf8');
const nginxConf = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8');
const publicFiles = ['favicon.svg', 'pwa-192x192.png', 'audio/click.wav', 'audio/piano/C2.ogg', 'genres/a.webp', 'instruments/b.webp', 'instruments/sub/c.png'];

/** Headers of the rule whose pattern is `pattern`. */
function ruleHeaders(file: string, pattern: string): Record<string, string> {
    const block = file.split('\n\n').find(b => b.split('\n').find(l => !l.startsWith('#')) === pattern);
    if (!block) throw new Error(`no rule for ${pattern}`);
    return Object.fromEntries(
        block.split('\n').filter(l => l.startsWith('  ')).map(l => {
            const [name, ...value] = l.trim().split(': ');
            return [name, value.join(': ')];
        }),
    );
}

describe('parseNginxHeaders', () => {
    it('reads quoted and bare values, with or without indentation, and ignores comments', () => {
        const conf = '# add_header Ignored "x";\n  add_header A "a b" always;\nadd_header B nosniff always;\n';
        expect(parseNginxHeaders(conf)).toEqual([['A', 'a b'], ['B', 'nosniff']]);
    });
});

describe('Cloudflare _headers parity with nginx', () => {
    const file = buildHeadersFile(securityConf, publicFiles);

    it('applies every nginx security header to all paths, unchanged', () => {
        const all = ruleHeaders(file, '/*');
        const expected = Object.fromEntries(parseNginxHeaders(securityConf));
        expect(Object.keys(expected)).toContain('Content-Security-Policy');
        expect(all).toEqual(expected);
    });

    it('caches fingerprinted assets forever and revalidates the entry points, like nginx', () => {
        expect(nginxConf).toContain('"public, max-age=31536000, immutable"');
        expect(ruleHeaders(file, '/assets/*')['Cache-Control']).toBe('public, max-age=31536000, immutable');
        for (const path of ['/index.html', '/sw.js', '/registerSW.js', '/workbox-*', '/manifest.webmanifest']) {
            expect(ruleHeaders(file, path)['Cache-Control']).toBe('no-cache');
        }
        expect(nginxConf).toMatch(/location ~\* \^\/\(index\\\.html\|sw\\\.js\|registerSW\\\.js\|workbox-\[\^\/\]\+\\\.js\)\$/);
    });

    it('caches audio and non-fingerprinted media for a week, like nginx', () => {
        expect(nginxConf.match(/max-age=604800/g)).toHaveLength(2); // audio + static media
        for (const pattern of ['/audio/*', '/favicon.svg', '/pwa-192x192.png', '/genres/*', '/instruments/*']) {
            expect(ruleHeaders(file, pattern)['Cache-Control']).toBe('public, max-age=604800');
        }
    });

    it('never sets Cache-Control twice for the same path (Cloudflare would join the values)', () => {
        const patterns = file.split('\n').filter(l => l && !l.startsWith('#') && !l.startsWith(' '));
        expect(new Set(patterns).size).toBe(patterns.length);
        expect(patterns.length).toBeLessThanOrEqual(100); // Cloudflare's rule limit
    });
});
