import { dbEvents } from './db.js';
import { shareSingleNewsById } from './social.js';

/**
 * Listen for news save events and trigger social sharing immediately
 */
console.log('[SOCIAL] Initializing real-time subscriber...');

dbEvents.on('newsSaved', async (data) => {
    // Small delay to ensure DB transaction is fully committed if needed
    // although pool.execute is usually fine immediately
    setTimeout(async () => {
        try {
            console.log(`[SOCIAL] Immediate Share Triggered for ID ${data.id}: ${data.title}`);
            await shareSingleNewsById(data.id);
        } catch (error) {
            console.error('[SOCIAL] Subscriber Error:', error.message);
        }
    }, 1000); 
});

export default dbEvents;
