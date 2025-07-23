// Puppeteer script to detect console errors in architectural view
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
        console.log('Navigating to architectural-view.html...');
        await page.goto('http://localhost:3000/architectural-view.html', {
            waitUntil: 'networkidle2',
        });
        console.log('Page loaded successfully');
        
        // Wait a bit for any dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if architectural canvas exists
        const canvasExists = await page.evaluate(() => {
            return document.getElementById('architecturalCanvas') !== null;
        });
        
        console.log(`Architectural canvas exists: ${canvasExists}`);
        
        // Check for SVG elements
        const svgCount = await page.evaluate(() => {
            return document.querySelectorAll('svg').length;
        });
        
        console.log(`Found ${svgCount} SVG elements on the page`);
        
        // Check for any error messages
        const errorMessages = await page.evaluate(() => {
            const errors = [];
            const consoleElements = document.querySelectorAll('.error, .warning');
            consoleElements.forEach(el => errors.push(el.textContent));
            return errors;
        });
        
        if (errorMessages.length > 0) {
            console.log('Error messages found:', errorMessages);
        }
        
    } catch (err) {
        console.error(`Navigation failed: ${err.message}`);
    }

    await browser.close();
})();

