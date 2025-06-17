import { supabaseClient } from './supabaseClient';

/**
 * Premium health tech image pool - 4x larger than before
 */
const PREMIUM_HEALTH_IMAGES = [
  'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1527613426441-4da17471b66d?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1576086213369-97a306d36557?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1559757175-89b19f191e58?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1516549655169-df83a0774514?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1628595351029-c2bf17511435?ixlib=rb-4.0.3&w=800&q=80',
  'https://images.unsplash.com/photo-1576086213369-97a306d36557?ixlib=rb-4.0.3&w=800&q=80'
];

/**
 * Get next unique image in rotation
 */
export async function chooseUniqueImage(contentType: string = 'health_tech'): Promise<string> {
  try {
    const lastIndexStr = await supabaseClient.getBotConfig('last_image_index') || '0';
    const lastIndex = parseInt(lastIndexStr);
    const nextIndex = (lastIndex + 1) % PREMIUM_HEALTH_IMAGES.length;
    const selectedImage = PREMIUM_HEALTH_IMAGES[nextIndex];
    
    await supabaseClient.setBotConfig('last_image_index', nextIndex.toString());
    
    console.log(`🖼️ Selected unique image ${nextIndex + 1}/${PREMIUM_HEALTH_IMAGES.length}`);
    return selectedImage;
  } catch (error) {
    console.error('⚠️ Error selecting unique image:', error);
    return PREMIUM_HEALTH_IMAGES[Math.floor(Math.random() * PREMIUM_HEALTH_IMAGES.length)];
  }
}

export async function resetImageRotation(): Promise<void> {
  try {
    await supabaseClient.setBotConfig('last_image_index', '0');
    console.log('🔄 Image rotation reset');
  } catch (error) {
    console.error('⚠️ Error resetting image rotation:', error);
  }
} 