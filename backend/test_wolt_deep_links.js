/**
 * Deeper analysis: which Wolt URLs work and which don't
 * Hypothesis: URLs with slug "item-itemid-xxx" fail, 
 *   URLs with proper slug "rama-gold-72-250-itemid-xxx" work
 */

require('dotenv').config();

async function main() {
    const token = process.env.EXTERNAL_API_TOKEN || '7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5';
    const baseUrl = process.env.EXTERNAL_API_URL || 'http://94.131.88.146:3000';

    const resp = await fetch(`${baseUrl}/api/csv-data/wolt_market_almaty_mapped`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const raw = await resp.json();
    const data = raw.data || [];

    const withUrl = data.filter(r => r.url && r.url.includes('wolt.com'));
    console.log(`Total Wolt records with URLs: ${withUrl.length}`);

    // Split into "item-itemid-xxx" (generic) vs proper slug
    const genericSlug = withUrl.filter(r => {
        const m = r.url.match(/venue\/[^/]+\/(.+)$/);
        return m && m[1].startsWith('item-itemid-');
    });
    const properSlug = withUrl.filter(r => {
        const m = r.url.match(/venue\/[^/]+\/(.+)$/);
        return m && !m[1].startsWith('item-itemid-');
    });

    console.log(`Generic slug (item-itemid-xxx): ${genericSlug.length}`);
    console.log(`Proper slug (name-itemid-xxx): ${properSlug.length}`);

    // Test a few of each
    const testUrl = async (url) => {
        try {
            const r = await fetch(url, { redirect: 'manual' });
            const loc = r.headers.get('location') || '';
            // If redirects to venue root = broken
            const isBroken = r.status === 301 && !loc.includes('itemid-');
            return { status: r.status, redirect: loc, broken: isBroken };
        } catch (e) {
            return { status: 'ERR', redirect: '', broken: true };
        }
    };

    console.log('\n=== Testing GENERIC slug URLs (item-itemid-xxx) ===');
    let genericBroken = 0;
    const genericSample = genericSlug.slice(0, 10);
    for (const r of genericSample) {
        const result = await testUrl(r.url);
        const status = result.broken ? '❌ BROKEN' : '✅ OK';
        console.log(`  ${status} [${result.status}] ${r.title}`);
        if (result.broken) {
            console.log(`    ${r.url} → ${result.redirect}`);
            genericBroken++;
        }
    }

    console.log('\n=== Testing PROPER slug URLs (name-itemid-xxx) ===');
    let properBroken = 0;
    const properSample = properSlug.slice(0, 10);
    for (const r of properSample) {
        const result = await testUrl(r.url);
        const status = result.broken ? '❌ BROKEN' : '✅ OK';
        console.log(`  ${status} [${result.status}] ${r.title}`);
        if (result.broken) {
            console.log(`    ${r.url} → ${result.redirect}`);
            properBroken++;
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Generic slug: ${genericBroken}/${genericSample.length} broken`);
    console.log(`Proper slug: ${properBroken}/${properSample.length} broken`);
    console.log(`\nTotal: ${genericSlug.length} generic + ${properSlug.length} proper = ${withUrl.length}`);
    console.log(`Estimated broken: ~${Math.round(genericBroken/genericSample.length * genericSlug.length)} of ${withUrl.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
