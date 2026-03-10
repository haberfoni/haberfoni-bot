import { scrapeIHA } from './src/scrapers/iha.js';
import { scrapeAA } from './src/scrapers/aa.js';
import { scrapeDHA } from './src/scrapers/dha.js';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { db } from './src/db.js'; // Import shared pool

dotenv.config();

console.log('Bot started. Waiting for schedule or commands...');

// Run immediately on start for testing
runAll();

// Schedule: Every 15 minutes
cron.schedule('*/15 * * * *', () => {
    console.log('Running scheduled scrape...');
    runAll();
});

// Command Polling (Every 10 seconds)
setInterval(async () => {
    await checkCommands();
}, 10000);

async function checkCommands() {
    try {
        const [commands] = await db.execute(
            "SELECT * FROM bot_commands WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 1"
        );

        if (commands && commands.length > 0) {
            const cmd = commands[0];
            console.log(`Received command: ${cmd.command}`);

            // Mark processing
            await db.execute(
                "UPDATE bot_commands SET status = 'PROCESSING', executed_at = NOW() WHERE id = ?",
                [cmd.id]
            );

            if (cmd.command === 'FORCE_RUN') {
                console.log('Executing FORCE RUN...');
                await runAll();
            }

            // Mark completed
            await db.execute(
                "UPDATE bot_commands SET status = 'COMPLETED' WHERE id = ?",
                [cmd.id]
            );
            console.log('Command completed.');
        }
    } catch (error) {
        console.error('Error checking commands:', error);
    }
}

async function runAll() {
    console.log('Starting scrape cycle...');
    try {
        await scrapeIHA();
    } catch (e) { console.error('IHA Error:', e); }

    try {
        await scrapeAA();
    } catch (e) { console.error('AA Error:', e); }

    try {
        await scrapeDHA();
    } catch (e) { console.error('DHA Error:', e); }
    console.log('Scrape cycle finished.');
}
