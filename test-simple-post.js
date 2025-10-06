// Simple posting test without OpenAI
const { postNow } = require('./dist/src/posting/postNow');

async function testSimplePost() {
  console.log('🧪 Testing simple post...');
  
  try {
    const result = await postNow({ 
      text: '🎉 Testing xBOT hybrid system! This is a breakthrough moment! 🚀🤖 #xBOT #Success' 
    });
    
    console.log('✅ Post result:', result);
    
    if (result.success) {
      console.log('🎉 SUCCESS! The posting system is working!');
    } else {
      console.log('❌ FAILED:', result.error);
    }
    
  } catch (error) {
    console.error('💥 ERROR:', error.message);
  }
}

testSimplePost();
