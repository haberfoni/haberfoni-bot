import { syncSocialMedia } from './src/social.js';
import { getSettingByKey } from './src/db.js';

async function test() {
    console.log('--- SOCIAL SYNC VERIFICATION START ---');
    try {
        const isActive = await getSettingByKey('is_social_auto_post_active');
        const tgToken = await getSettingByKey('telegram_bot_token');
        const metaToken = await getSettingByKey('meta_access_token');
        const pageId = await getSettingByKey('meta_page_id');

        console.log('Settings Check:');
        console.log('- Active:', isActive);
        console.log('- TG Token:', tgToken ? 'PRESENT' : 'MISSING');
        console.log('- Meta Token:', metaToken ? 'PRESENT' : 'MISSING');
        console.log('- Page ID:', pageId);

        if (isActive !== 'true') {
            console.log('ALERT: Auto-post is NOT active in settings!');
        }

        await syncSocialMedia();
        console.log('--- SOCIAL SYNC VERIFICATION END ---');
    } catch (error) {
        console.error('VERIFICATION FAILED:', error);
    }
    process.exit(0);
}

test();
