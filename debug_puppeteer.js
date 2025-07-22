// Puppeteer script to detect console errors in design-docs view
import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`CONSOLE ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.error(`PAGE ERROR: ${err.toString()}`);
    });

    page.on('requestfailed', request => {
        console.error(`REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`);
    });

    try {
        console.log('Navigating to design-docs.html...');
        await page.goto('http://localhost:3000/design-docs.html', {
            waitUntil: 'networkidle2',
        });
        console.log('Page loaded successfully');
        
        // Wait a bit for any dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if nodes are rendered
        const nodeCount = await page.evaluate(() => {
            return document.querySelectorAll('.doc-node').length;
        });
        
        console.log(`Found ${nodeCount} design document nodes on the page`);
        
    } catch (err) {
        console.error(`Navigation failed: ${err.message}`);
    }

    await browser.close();
})();

