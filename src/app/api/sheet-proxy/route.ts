import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sheetUrl = searchParams.get('url');

        if (!sheetUrl) {
            return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
        }

        if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
            return NextResponse.json({ error: 'Invalid Google Sheets URL' }, { status: 400 });
        }

        const sheetIdMatch = sheetUrl.match(/\/d\/(.*?)(\/|$)/);
        if (!sheetIdMatch) {
            return NextResponse.json({ error: 'Could not extract sheet ID from URL' }, { status: 400 });
        }

        const sheetId = sheetIdMatch[1];
        const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

        console.log('Fetching sheet from:', exportUrl);

        return new Promise((resolve) => {
            const req = https.get(exportUrl, (res) => {
                // Handle redirects manually if needed, but gviz usually doesn't redirect as much
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    https.get(res.headers.location, (res2) => {
                        let data = '';
                        res2.on('data', (chunk) => { data += chunk; });
                        res2.on('end', () => {
                            resolve(new NextResponse(data, {
                                status: 200,
                                headers: { 'Content-Type': 'text/csv' },
                            }));
                        });
                    }).on('error', (err) => {
                        console.error('Redirect fetch error:', err);
                        resolve(NextResponse.json({ error: 'Redirect failed' }, { status: 500 }));
                    });
                    return;
                }

                if (res.statusCode !== 200) {
                    resolve(NextResponse.json({ error: 'Failed to fetch sheet' }, { status: res.statusCode || 500 }));
                    return;
                }

                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    resolve(new NextResponse(data, {
                        status: 200,
                        headers: { 'Content-Type': 'text/csv' },
                    }));
                });
            });

            req.on('error', (err) => {
                console.error('HTTPS request error:', err);
                resolve(NextResponse.json({ error: 'Internal server error: ' + err.message }, { status: 500 }));
            });
        });

    } catch (error: any) {
        console.error('Sheet proxy error:', error);
        return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
    }
}
